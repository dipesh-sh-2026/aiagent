import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, Send, Globe, Loader2, Eye, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/research")({
    head: () => ({
        meta: [
            { title: "Research AI — Nexus AI" },
            { name: "description", content: "Agentic web research with live sources, citations and streaming reasoning." },
        ],
    }),
    component: ResearchPage,
});

type ToolCall = {
    id: string;
    name: string;
    args?: unknown;
    result?: unknown;
    state: "running" | "done" | "error";
};

type ChatMsg = {
    id: string;
    role: "user" | "assistant";
    text: string;
    tools: ToolCall[];
};

function ResearchPage() {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const idRef = useRef(0);
    const nid = () => `m${++idRef.current}`;

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        const userMsg: ChatMsg = { id: nid(), role: "user", text, tools: [] };
        const asstId = nid();
        const asstMsg: ChatMsg = { id: asstId, role: "assistant", text: "", tools: [] };
        const history = [...messages, userMsg];
        setMessages([...history, asstMsg]);
        setBusy(true);

        try {
            const res = await fetch("/api/research", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history.map((m) => ({ role: m.role, content: m.text })),
                }),
            });
            if (!res.ok || !res.body) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));

            const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
            let buffer = "";
            const updateAsst = (fn: (m: ChatMsg) => ChatMsg) =>
                setMessages((prev) => prev.map((m) => (m.id === asstId ? fn(m) : m)));

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value;
                // UI message stream uses data: lines like SSE OR newline-delimited JSON
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
                    if (payload === "[DONE]" || !payload) continue;
                    let evt: any;
                    try { evt = JSON.parse(payload); } catch { continue; }
                    // Handle AI SDK UI message stream parts
                    const type = evt.type as string | undefined;
                    if (!type) continue;
                    if (type === "text-delta" || type === "text") {
                        const delta = evt.delta ?? evt.text ?? "";
                        if (delta) updateAsst((m) => ({ ...m, text: m.text + delta }));
                    } else if (type.startsWith("tool-input-start") || type === "tool-call") {
                        const tcId = evt.toolCallId ?? evt.id ?? `t${Date.now()}`;
                        const name = evt.toolName ?? evt.name ?? "tool";
                        updateAsst((m) => ({
                            ...m,
                            tools: m.tools.some((t) => t.id === tcId)
                                ? m.tools
                                : [...m.tools, { id: tcId, name, state: "running" }],
                        }));
                    } else if (type === "tool-input-available" || type === "tool-call-input") {
                        const tcId = evt.toolCallId ?? evt.id;
                        updateAsst((m) => ({
                            ...m,
                            tools: m.tools.map((t) => (t.id === tcId ? { ...t, args: evt.input ?? evt.args } : t)),
                        }));
                    } else if (type === "tool-output-available" || type === "tool-result") {
                        const tcId = evt.toolCallId ?? evt.id;
                        updateAsst((m) => ({
                            ...m,
                            tools: m.tools.map((t) =>
                                t.id === tcId ? { ...t, result: evt.output ?? evt.result, state: "done" } : t,
                            ),
                        }));
                    } else if (type === "error") {
                        updateAsst((m) => ({ ...m, text: m.text + `\n\n_Error: ${evt.errorText ?? evt.error ?? "unknown"}_` }));
                    }
                }
            }
        } catch (e) {
            const msg = (e as Error).message;
            setMessages((prev) =>
                prev.map((m) => (m.id === asstId ? { ...m, text: `**Error:** ${msg}` } : m)),
            );
        } finally {
            setBusy(false);
        }
    }, [input, busy, messages]);

    return (
        <AppShell>
            <div className="flex flex-col h-screen">
                <header className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
                    <Search className="size-5 text-primary" />
                    <div>
                        <h1 className="font-display text-lg font-semibold">Research AI</h1>
                        <p className="text-xs text-muted-foreground">Live web sources via agentic search</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.length === 0 && (
                            <div className="text-center py-20">
                                <div className="inline-flex p-3 rounded-2xl glass-panel mb-4">
                                    <Globe className="size-7 text-primary" />
                                </div>
                                <h2 className="font-display text-2xl">Ask anything</h2>
                                <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
                                    Nexus Research will plan, search the web, and synthesize an answer with cited sources.
                                </p>
                                <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
                                    {[
                                        "Latest breakthroughs in fusion energy",
                                        "Compare GPT-5 vs Gemini 3 Pro",
                                        "Top AI startups funded in 2025",
                                    ].map((s) => (
                                        <button key={s} onClick={() => setInput(s)}
                                            className="rounded-full border border-border bg-white/5 px-3 py-1.5 hover:bg-white/10 transition">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((m) => (
                            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                                {m.role === "user" ? (
                                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                                        {m.text}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {m.tools.map((t) => (
                                            <details key={t.id} className="glass-panel px-4 py-2 text-xs">
                                                <summary className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                                                    {t.state === "running" ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
                                                    <span className="font-mono">{t.name}</span>
                                                    {t.args ? (
                                                        <span className="text-foreground/80 truncate">
                                                            {typeof (t.args as any).query === "string" ? (t.args as any).query : JSON.stringify(t.args)}
                                                        </span>
                                                    ) : null}
                                                    <span className="ml-auto text-[10px] uppercase tracking-wide">{t.state}</span>
                                                </summary>
                                                <pre className="mt-2 max-h-60 overflow-auto text-[11px] text-muted-foreground whitespace-pre-wrap">
                                                    {JSON.stringify(t.result ?? t.args, null, 2)}
                                                </pre>
                                            </details>
                                        ))}
                                        {m.text ? (
                                            <div className="prose prose-sm prose-invert max-w-none prose-headings:font-display prose-a:text-primary">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                                            </div>
                                        ) : busy ? (
                                            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="size-3 animate-spin" /> Thinking...
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-t border-border/40 px-6 py-4">
                    <div className="max-w-3xl mx-auto space-y-2">
                        {input.trim() ? (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        <Eye className="size-3" /> Preview
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInput("")}
                                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                                    >
                                        <X className="size-3" /> Clear
                                    </button>
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                                    {input.trim()}
                                </div>
                            </div>
                        ) : null}

                        <form
                            onSubmit={(e) => { e.preventDefault(); void send(); }}
                            className="flex items-end gap-2 glass-panel p-2"
                        >
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                                }}
                                placeholder="Ask Nexus to research..."
                                rows={1}
                                className="flex-1 bg-transparent resize-none outline-none px-3 py-2 text-sm placeholder:text-muted-foreground/60 max-h-40"
                            />
                            <button
                                type="submit"
                                disabled={busy || !input.trim()}
                                className="size-9 shrink-0 inline-flex items-center justify-center rounded-lg brand-gradient text-primary-foreground disabled:opacity-40 transition"
                            >
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
