import { createFileRoute } from "@tanstack/react-router";

function createImageEvent(event: string, payload: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// Maps the UI's size presets to actual pixel dimensions for Pollinations —
// free, keyless image generation, no billing required.
const SIZE_MAP: Record<string, { width: number; height: number }> = {
    "1024x1024": { width: 1024, height: 1024 },
    "1024x1280": { width: 1024, height: 1280 },
    "1024x1536": { width: 1024, height: 1536 },
    "1536x1024": { width: 1536, height: 1024 },
};

// Style keywords appended to the prompt — Pollinations is prompt-driven for
// style, so these work well without needing a paid model.
const STYLE_SUFFIX: Record<string, string> = {
    none: "",
    photorealistic: ", photorealistic, ultra-detailed, professional photography, natural lighting, 85mm lens",
    "digital-art": ", digital art, vibrant colors, highly detailed illustration, trending on artstation",
    anime: ", anime style, cel-shaded, vibrant, Studio Ghibli inspired",
    watercolor: ", watercolor painting, soft brush strokes, visible paper texture, artistic",
    "3d-render": ", 3D render, octane render, cinematic lighting, high detail, unreal engine 5",
    cinematic: ", cinematic still, dramatic lighting, film grain, moody atmosphere, wide aspect",
};

function buildPrompt(prompt: string, style?: string): string {
    const suffix = style ? STYLE_SUFFIX[style] ?? "" : "";
    return `${prompt}${suffix}`;
}

async function generateWithPollinations(prompt: string, size?: string): Promise<{ b64: string; contentType: string }> {
    const dims = SIZE_MAP[size ?? "1024x1024"] ?? SIZE_MAP["1024x1024"];
    const seed = Math.floor(Math.random() * 1_000_000);
    const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${dims.width}&height=${dims.height}&seed=${seed}&nologo=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Pollinations returned ${res.status}: ${txt.slice(0, 200)}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        return { b64: Buffer.from(arrayBuffer).toString("base64"), contentType };
    } finally {
        clearTimeout(timeout);
    }
}

export const Route = createFileRoute("/api/generate-image")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                const { prompt: rawPrompt, size, style } = (await request.json()) as {
                    prompt: string;
                    size?: string;
                    style?: string;
                };
                if (!rawPrompt?.trim()) return new Response("Missing prompt", { status: 400 });

                const prompt = buildPrompt(rawPrompt, style);

                try {
                    const result = await generateWithPollinations(prompt, size);
                    const payload = { b64_json: result.b64, content_type: result.contentType, status: "completed", provider: "pollinations" };
                    const response =
                        createImageEvent("image_generation.partial_image", payload) +
                        createImageEvent("image_generation.completed", payload);

                    return new Response(response, {
                        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Image generation request failed or timed out";
                    const errPayload = { error: { message } };
                    return new Response(createImageEvent("error", errPayload), {
                        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
                    });
                }
            },
        },
    },
});