import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Film, Loader2, Sparkles } from "lucide-react";
import { generateVideo } from "@/lib/video.functions";

export const Route = createFileRoute("/video")({
    head: () => ({
        meta: [
            { title: "Video Studio — Nexus AI" },
            { name: "description", content: "Turn prompts into cinematic short videos with AI." },
        ],
    }),
    component: VideoPage,
});

function extractVideoUrl(raw: string): string | null {
    try {
        const obj = JSON.parse(raw);
        const candidate =
            obj.video_url ?? obj.videoUrl ?? obj.url ?? obj.data?.[0]?.url ?? obj.data?.url ?? null;
        if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
        const b64 = obj.b64_json ?? obj.data?.[0]?.b64_json;
        if (typeof b64 === "string") return `data:video/mp4;base64,${b64}`;
    } catch { }
    return null;
}

function VideoPage() {
    const [prompt, setPrompt] = useState("");
    const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
    const [duration, setDuration] = useState<5 | 10>(5);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [rawResponse, setRawResponse] = useState<string | null>(null);
    const callGenerate = useServerFn(generateVideo);

    async function submit() {
        const text = prompt.trim();
        if (!text || busy) return;
        setBusy(true);
        setError(null);
        setVideoSrc(null);
        setRawResponse(null);
        try {
            const result = await callGenerate({
                data: { prompt: text, aspectRatio: aspect, duration },
            });
            if (!result.ok) setError(result.error);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    const aspectClass = aspect === "16:9" ? "aspect-video" : aspect === "9:16" ? "aspect-[9/16] max-w-xs mx-auto" : "aspect-square max-w-md mx-auto";

    return (
        <AppShell>
            <div className="flex flex-col h-screen">
                <header className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
                    <Film className="size-5 text-primary" />
                    <div>
                        <h1 className="font-display text-lg font-semibold">Video Studio</h1>
                        <p className="text-xs text-muted-foreground">Prompt-to-video · powered by Lovable AI</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="glass-panel p-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                placeholder="A drone shot flying over a neon-lit cyberpunk city at night, rain glistening on the streets..."
                                className="w-full bg-transparent resize-none outline-none p-2 text-sm placeholder:text-muted-foreground/60"
                            />
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <div className="flex items-center gap-1 text-xs">
                                    <span className="text-muted-foreground mr-1">Aspect</span>
                                    {(["16:9", "9:16", "1:1"] as const).map((a) => (
                                        <button
                                            key={a}
                                            onClick={() => setAspect(a)}
                                            className={`px-2.5 py-1 rounded-md border ${aspect === a ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                                        >{a}</button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                    <span className="text-muted-foreground mr-1">Duration</span>
                                    {[5, 10].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d as 5 | 10)}
                                            className={`px-2.5 py-1 rounded-md border ${duration === d ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                                        >{d}s</button>
                                    ))}
                                </div>
                                <div className="flex-1" />
                                <button
                                    onClick={() => void submit()}
                                    disabled={busy || !prompt.trim()}
                                    className="inline-flex items-center gap-2 rounded-full brand-gradient text-primary-foreground px-5 py-2 text-sm font-medium shadow-glow disabled:opacity-40 transition"
                                >
                                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                    Generate video
                                </button>
                            </div>
                        </div>

                        {busy && (
                            <div className={`glass-panel ${aspectClass} flex items-center justify-center`}>
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Loader2 className="size-8 animate-spin text-primary" />
                                    <p className="text-sm">Rendering your video... this can take a minute.</p>
                                </div>
                            </div>
                        )}

                        {videoSrc && !busy && (
                            <div className="glass-panel overflow-hidden">
                                <video src={videoSrc} controls autoPlay loop className={`w-full ${aspectClass}`} />
                                <div className="p-3 text-xs text-muted-foreground">{prompt}</div>
                            </div>
                        )}

                        {error && (
                            <div className="glass-panel p-4 text-sm text-destructive">
                                <div className="font-medium mb-1">Couldn't generate the video</div>
                                <div className="text-destructive/80 text-xs">{error}</div>
                                {rawResponse && (
                                    <details className="mt-3 text-muted-foreground">
                                        <summary className="cursor-pointer text-xs">Raw response</summary>
                                        <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-60 overflow-auto">{rawResponse}</pre>
                                    </details>
                                )}
                            </div>
                        )}

                        {!busy && !videoSrc && !error && (
                            <div className="text-center text-muted-foreground text-sm py-12">
                                Describe a scene and Nexus will compose a short video for you.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
