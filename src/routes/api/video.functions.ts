import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
    prompt: z.string().min(1),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
    duration: z.union([z.literal(5), z.literal(10)]).optional(),
});

type GenerateVideoResult =
    | { ok: true; videoUrl: string }
    | { ok: false; error: string };

// A small, widely-available open text-to-video model that's actually servable
// on Hugging Face's free "hf-inference" provider. Low resolution, short clips
// (a few seconds), no real aspect-ratio/duration control — this is the honest
// ceiling of what's free here. Override with HUGGINGFACE_VIDEO_MODEL if you
// find something better.
const HF_MODEL = process.env.HUGGINGFACE_VIDEO_MODEL || "damo-vilab/text-to-video-ms-1.7b";

export const generateVideo = createServerFn({ method: "POST" })
    .validator(inputSchema)
    .handler(async ({ data }): Promise<GenerateVideoResult> => {
        const token = process.env.HUGGINGFACE_API_KEY;
        if (!token) {
            return {
                ok: false,
                error:
                    "No HUGGINGFACE_API_KEY configured. Video uses Hugging Face's free tier: " +
                    "sign up at huggingface.co, create a free 'Read' access token under Settings → Access Tokens, " +
                    "then add HUGGINGFACE_API_KEY=your_token to .env.",
            };
        }

        const controller = new AbortController();
        // Free-tier cold starts can be slow — give it real time before giving up.
        const timeout = setTimeout(() => controller.abort(), 120_000);

        try {
            const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: data.prompt }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const contentType = res.headers.get("content-type") ?? "";

            // HF returns JSON (not video bytes) both for real errors and for the
            // common "model is warming up" cold-start case — surface it plainly
            // instead of pretending it succeeded.
            if (contentType.includes("application/json")) {
                const body = await res.json().catch(() => ({}) as any);
                if (body?.error) {
                    const waitMsg = body.estimated_time
                        ? ` The model is cold-starting on Hugging Face's free tier — try again in about ${Math.ceil(body.estimated_time)}s.`
                        : "";
                    return { ok: false, error: `${body.error}${waitMsg}` };
                }
                return {
                    ok: false,
                    error: `Unexpected response from Hugging Face: ${JSON.stringify(body).slice(0, 300)}`,
                };
            }

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                return { ok: false, error: `Hugging Face returned ${res.status}: ${txt.slice(0, 300)}` };
            }

            const arrayBuffer = await res.arrayBuffer();
            if (arrayBuffer.byteLength === 0) {
                return { ok: false, error: "Hugging Face returned an empty response — try again." };
            }
            const b64 = Buffer.from(arrayBuffer).toString("base64");
            return { ok: true, videoUrl: `data:video/mp4;base64,${b64}` };
        } catch (error) {
            clearTimeout(timeout);
            const message = error instanceof Error ? error.message : "Video generation failed or timed out";
            return {
                ok: false,
                error: `${message} — free-tier video models are genuinely slow/unreliable sometimes. This isn't a bug, it's the trade-off of using a free provider.`,
            };
        }
    });