import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createParser } from "eventsource-parser";
import { AppShell } from "@/components/AppShell";
import { ImageIcon, Loader2, Sparkles, Download } from "lucide-react";

export const Route = createFileRoute("/image")({
    head: () => ({
        meta: [
            { title: "Image Studio — Nexus AI" },
            { name: "description", content: "Generate stunning images with streaming progressive previews." },
        ],
    }),
    component: ImagePage,
});

type GenImage = { id: string; prompt: string; src: string; isFinal: boolean };

const DOCTORS_DAY_PROMPT = `Design a premium, modern Doctors' Day social media poster for UNIC Technology in a 1080×1350 (4:5) format. The design should combine the elegance of Apple, the clean minimalism of Stripe, and the futuristic UI aesthetics of OpenAI.

Use a deep navy blue (#071A3D) to royal blue (#0F4CFF) gradient background with subtle glowing cyan (#00D4FF) accents, soft abstract light waves, glassmorphism elements, and minimal geometric patterns. Add gentle floating medical icons (heartbeat line, cross, stethoscope, ECG waveform, medical shield) integrated with digital circuit lines to symbolize the connection between healthcare and technology.

Place a realistic 3D white medical cross with a glowing cyan edge in the center, surrounded by elegant holographic rings and soft blue light effects. Include a modern stethoscope gracefully wrapped around the medical cross with premium reflections.

At the top, add a small heading:
1 July

Below it, create a bold premium title:
Happy Doctors' Day

Add the following message:

"Today we honor the dedication, compassion, and tireless efforts of every doctor who works selflessly to keep our communities healthy. Thank you for your unwavering commitment to saving lives and inspiring hope every single day."

Use clean white typography with cyan highlights for key words. Maintain generous spacing and a premium corporate layout.

Place the UNIC Technology logo neatly at the top-left corner with enough breathing space.

At the bottom add:

Thank You, Doctors!

"Your care, compassion, and commitment make the world healthier every day."

Add a thin glowing cyan divider line above the footer.

The overall look should feel luxurious, futuristic, trustworthy, and corporate, with soft blue ambient lighting, subtle glass panels, premium shadows, high-end UI styling, and a clean balanced composition. The final poster should look like it was designed by a top branding agency for a leading technology company celebrating healthcare professionals.`;

function ImagePage() {
    const [prompt, setPrompt] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [images, setImages] = useState<GenImage[]>([]);
    const [size, setSize] = useState<"1024x1024" | "1024x1536" | "1536x1024" | "1024x1280">("1024x1024");

    async function generate() {
        const text = prompt.trim();
        if (!text || busy) return;
        setError(null);
        setBusy(true);
        const id = `i${Date.now()}`;
        setImages((prev) => [{ id, prompt: text, src: "", isFinal: false }, ...prev]);

        try {
            const res = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: text, size }),
            });
            if (!res.ok || !res.body) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));

            let sawCompleted = false;
            let streamError: string | undefined;
            const parser = createParser({
                onEvent(evt) {
                    let payload: any;
                    try { payload = JSON.parse(evt.data); } catch { return; }
                    if (evt.event === "error" || payload?.type === "error") {
                        streamError = payload?.error?.message ?? "Image generation failed";
                        return;
                    }
                    if (evt.event !== "image_generation.partial_image" && evt.event !== "image_generation.completed") return;
                    const isFinal = evt.event === "image_generation.completed";
                    const previewSrc = payload?.image_url?.url ?? payload?.url ?? (typeof payload?.b64_json === "string" ? `data:image/png;base64,${payload.b64_json}` : null);
                    if (!previewSrc) return;
                    flushSync(() => {
                        setImages((prev) =>
                            prev.map((im) =>
                                im.id === id
                                    ? { ...im, src: `data:image/png;base64,${payload.b64_json}`, isFinal }
                                    : im,
                            ),
                        );
                    });
                    if (isFinal) sawCompleted = true;
                },
            });

            const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    parser.feed(value);
                }
            } finally {
                reader.cancel().catch(() => { });
            }
            if (streamError) throw new Error(streamError);
            if (!sawCompleted) throw new Error("Stream ended without a completed event");
        } catch (e) {
            setError((e as Error).message);
            setImages((prev) => prev.filter((im) => im.id !== id));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppShell>
            <div className="flex flex-col h-screen">
                <header className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
                    <ImageIcon className="size-5 text-primary" />
                    <div>
                        <h1 className="font-display text-lg font-semibold">Image Studio</h1>
                        <p className="text-xs text-muted-foreground">Streaming previews · openai/gpt-image-2</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-5xl mx-auto">
                        <div className="glass-panel p-4 mb-8">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                placeholder="A cinematic shot of a futuristic city at golden hour, ultra-detailed..."
                                className="w-full bg-transparent resize-none outline-none p-2 text-sm placeholder:text-muted-foreground/60"
                            />
                            <div className="flex items-center gap-3 mt-2">
                                <select
                                    value={size}
                                    onChange={(e) => setSize(e.target.value as typeof size)}
                                    className="bg-white/5 border border-border rounded-md px-3 py-1.5 text-xs outline-none"
                                >
                                    <option value="1024x1024">Square · 1024</option>
                                    <option value="1024x1280">Poster · 1024×1280 (4:5)</option>
                                    <option value="1024x1536">Portrait · 1024×1536</option>
                                    <option value="1536x1024">Landscape · 1536×1024</option>
                                </select>
                                <div className="flex-1" />
                                <button
                                    onClick={() => void generate()}
                                    disabled={busy || !prompt.trim()}
                                    className="inline-flex items-center gap-2 rounded-full brand-gradient text-primary-foreground px-5 py-2 text-sm font-medium shadow-glow disabled:opacity-40 transition"
                                >
                                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                    Generate
                                </button>
                            </div>
                            {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
                        </div>

                        {images.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 text-sm whitespace-pre-wrap max-w-2xl mx-auto">
                                Your generations will appear here.
                                <div className="mt-8 p-6 glass-panel text-left cursor-pointer hover:border-primary/50 transition group" onClick={() => setPrompt(DOCTORS_DAY_PROMPT)}>
                                    <p className="font-semibold text-primary mb-2 flex items-center gap-2">
                                        <Sparkles className="size-3" />
                                        Featured Project: Doctors' Day Poster
                                    </p>
                                    <p className="line-clamp-4 text-xs italic opacity-80">{DOCTORS_DAY_PROMPT}</p>
                                    <div className="mt-4 text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition">Click to load this prompt</div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {images.map((im) => (
                                    <div key={im.id} className="glass-panel overflow-hidden group">
                                        <div className="aspect-square bg-black/40 relative">
                                            {im.src ? (
                                                <img
                                                    src={im.src}
                                                    alt={im.prompt}
                                                    className={`w-full h-full object-cover transition-[filter] duration-500 ${im.isFinal ? "blur-0" : "blur-2xl"}`}
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Loader2 className="size-6 animate-spin text-primary" />
                                                </div>
                                            )}
                                            {im.isFinal && (
                                                <a
                                                    href={im.src}
                                                    download={`nexus-${im.id}.png`}
                                                    className="absolute top-2 right-2 size-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <Download className="size-4" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="p-3 text-xs text-muted-foreground line-clamp-2">{im.prompt}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
