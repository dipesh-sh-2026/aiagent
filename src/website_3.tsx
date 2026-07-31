import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Layout, Send, Loader2, Plus, Trash2, MessageSquare, Download, Eye, Code2, Copy, Check, Clock } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import "streamdown/styles.css";

export function WebsiteBuilderPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentId, setCurrentId] = useState<string>("");
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<"preview" | "code">("preview");
    const [copiedCode, setCopiedCode] = useState(false);
    const idRef = useRef(0);
    const nid = () => `m${++idRef.current}`;

    useEffect(() => {
        const loaded = loadSessions();
        setSessions(loaded);
        if (loaded.length > 0) {
            setCurrentId(loaded[0].id);
            setMessages(loaded[0].messages);
        } else {
            setCurrentId(newSessionId());
        }
    }, []);

    useEffect(() => {
        if (!currentId || messages.length === 0) return;
        setSessions((prev) => {
            const title = titleFromMessages(messages);
            const idx = prev.findIndex((s) => s.id === currentId);
            const updated: Session = { id: currentId, title, messages, updatedAt: Date.now() };
            let next: Session[];
            if (idx >= 0) { next = [...prev]; next[idx] = updated; } else { next = [updated, ...prev]; }
            next.sort((a, b) => b.updatedAt - a.updatedAt);
            saveSessions(next);
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, currentId]);

    const startNewChat = useCallback(() => {
        setCurrentId(newSessionId());
        setMessages([]);
        setInput("");
    }, []);

    const openSession = useCallback((s: Session) => {
        setCurrentId(s.id);
        setMessages(s.messages);
        setInput("");
    }, []);

    const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSessions((prev) => {
            const next = prev.filter((s) => s.id !== id);
            saveSessions(next);
            return next;
        });
        if (id === currentId) startNewChat();
    }, [currentId, startNewChat]);

    const latestHtml = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.role !== "assistant") continue;
            const html = extractHtml(m.text);
            if (html) return html;
        }
        return null;
    }, [messages]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        const userMsg: ChatMsg = { id: nid(), role: "user", text };
        const asstId = nid();
        const asstMsg: ChatMsg = { id: asstId, role: "assistant", text: "" };
        const history = [...messages, userMsg];
        setMessages([...history, asstMsg]);
        setBusy(true);
        setView("preview");

        try {
            const res = await fetch("/api/website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.text })) }),
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
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
                    if (payload === "[DONE]" || !payload) continue;
                    let evt: any;
                    try { evt = JSON.parse(payload); } catch { continue; }
                    const type = evt.type as string | undefined;
                    if (!type) continue;
                    if (type === "text-delta" || type === "text") {
                        const delta = evt.delta ?? evt.text ?? "";
                        if (delta) updateAsst((m) => ({ ...m, text: m.text + delta }));
                    } else if (type === "error") {
                        updateAsst((m) => ({ ...m, text: m.text + `\n\n_Error: ${evt.errorText ?? evt.error ?? "unknown"}_` }));
                    }
                }
            }
        } catch (e) {
            const msg = (e as Error).message;
            setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text: `**Error:** ${msg}` } : m)));
        } finally {
            setBusy(false);
        }
    }, [input, busy, messages]);

    const downloadHtml = useCallback(() => {
        if (!latestHtml) return;
        const blob = new Blob([latestHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "site.html";
        a.click();
        URL.revokeObjectURL(url);
    }, [latestHtml]);

    const copyCode = useCallback(() => {
        if (!latestHtml) return;
        navigator.clipboard?.writeText(latestHtml).then(() => {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 1500);
        }).catch(() => { });
    }, [latestHtml]);

    return (
        <AppShell>
            <div className="flex h-screen">
                {/* History sidebar */}
                <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/40 bg-white/[0.02]">
                    <div className="p-3">
                        <button
                            onClick={startNewChat}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
                        >
                            <Plus className="size-4" /> New site
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
                        {sessions.length === 0 && (
                            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                                Your generated sites will appear here.
                            </p>
                        )}
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => openSession(s)}
                                className={`group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${s.id === currentId ? "bg-primary/10 text-foreground" : "hover:bg-white/5 text-muted-foreground"
                                    }`}
                            >
                                <MessageSquare className="size-3.5 shrink-0" />
                                <span className="flex-1 truncate">{s.title}</span>
                                <span
                                    onClick={(e) => deleteSession(s.id, e)}
                                    className="opacity-0 group-hover:opacity-100 transition shrink-0 p-1 rounded hover:bg-white/10"
                                >
                                    <Trash2 className="size-3.5" />
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Chat column */}
                <div className="flex flex-col w-full md:w-[380px] shrink-0 border-r border-border/40">
                    <header className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
                        <Layout className="size-5 text-primary" />
                        <div>
                            <h1 className="font-display text-lg font-semibold">Site Builder</h1>
                            <p className="text-xs text-muted-foreground">Describe it, watch it build</p>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-12 space-y-6">
                                <p className="text-sm text-muted-foreground">
                                    Try: "Landing page for a theme park called Adventure Land, with a hero section, attractions grid, and event cards."
                                </p>
                                {sessions.length > 0 && (
                                    <div className="text-left">
                                        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-2">
                                            <Clock className="size-3" /> Recent
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {sessions.slice(0, 5).map((s) => {
                                                const fullPrompt = s.messages.find((m) => m.role === "user")?.text ?? s.title;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => setInput(fullPrompt)}
                                                        title={fullPrompt}
                                                        className="max-w-[220px] truncate rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                                                    >
                                                        {s.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                                {m.role === "user" ? (
                                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm">
                                        {m.text}
                                    </div>
                                ) : (
                                    <div className="max-w-[95%] text-sm text-muted-foreground">
                                        {(() => {
                                            const preamble = m.text.split("```")[0].trim();
                                            if (preamble) return <p>{preamble}</p>;
                                            if (busy) return (
                                                <div className="inline-flex items-center gap-2">
                                                    <Loader2 className="size-3 animate-spin" /> Building...
                                                </div>
                                            );
                                            return null;
                                        })()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-border/40 p-3">
                        <form
                            onSubmit={(e) => { e.preventDefault(); void send(); }}
                            className="flex items-end gap-2 glass-panel p-2"
                        >
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                                placeholder="Describe the site you want..."
                                rows={2}
                                className="flex-1 bg-transparent resize-none outline-none px-2 py-1.5 text-sm placeholder:text-muted-foreground/60"
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

                {/* Preview / code column */}
                <div className="hidden md:flex flex-col flex-1 min-w-0">
                    <header className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
                            <button
                                onClick={() => setView("preview")}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition ${view === "preview" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Eye className="size-3.5" /> Preview
                            </button>
                            <button
                                onClick={() => setView("code")}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition ${view === "code" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Code2 className="size-3.5" /> Code
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={copyCode}
                                disabled={!latestHtml}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition disabled:opacity-40"
                            >
                                {copiedCode ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                                {copiedCode ? "Copied" : "Copy code"}
                            </button>
                            <button
                                onClick={downloadHtml}
                                disabled={!latestHtml}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition disabled:opacity-40"
                            >
                                <Download className="size-3.5" /> Download .html
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 bg-white">
                        {!latestHtml ? (
                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground bg-background">
                                Nothing built yet — describe a site on the left.
                            </div>
                        ) : view === "preview" ? (
                            <iframe title="Site preview" srcDoc={latestHtml} sandbox="allow-scripts" className="w-full h-full border-0" />
                        ) : (
                            <div className="h-full overflow-auto bg-background p-4">
                                <Streamdown
                                    className="prose prose-sm prose-invert max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-border/40"
                                    plugins={{ code }}
                                >
                                    {`\`\`\`html\n${latestHtml}\n\`\`\``}
                                </Streamdown>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

type ChatMsg = { id: string; role: "user" | "assistant"; text: string };
type Session = { id: string; title: string; messages: ChatMsg[]; updatedAt: number };

const HISTORY_KEY = "nexus-website-history";
const MAX_SESSIONS = 50;

function loadSessions(): Session[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveSessions(sessions: Session[]) {
    try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch {
        // ignore
    }
}

function titleFromMessages(messages: ChatMsg[]): string {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return "New site";
    const text = firstUser.text.trim().replace(/\s+/g, " ");
    return text.length > 48 ? `${text.slice(0, 48)}…` : text || "New site";
}

function newSessionId() {
    return `s${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

