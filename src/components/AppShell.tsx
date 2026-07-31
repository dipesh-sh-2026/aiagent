import { Link } from "@tanstack/react-router";
import { Search, ImageIcon, Film, Home } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/nexus-logo.png";

const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/research", label: "Research", icon: Search },
    { to: "/image", label: "Image", icon: ImageIcon },
    { to: "/video", label: "Video", icon: Film },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className="aurora-bg min-h-screen flex">
            <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 p-4 border-r border-border/40 glass-panel rounded-none">
                <Link to="/" className="flex items-center gap-2 px-2 py-3 mb-4">
                    <img src={logo} alt="Nexus AI" width={36} height={36} className="rounded-md" />
                    <div className="flex flex-col leading-tight">
                        <span className="font-display text-base font-semibold">Nexus AI</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Agentic platform</span>
                    </div>
                </Link>
                <nav className="flex flex-col gap-1">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <Link
                            key={to}
                            to={to}
                            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                            activeProps={{ className: "!text-foreground bg-white/5 ring-1 ring-primary/30" }}
                            activeOptions={{ exact: to === "/" }}
                        >
                            <Icon className="size-4" />
                            <span>{label}</span>
                        </Link>
                    ))}
                </nav>
                <div className="mt-auto px-2 pb-2 text-[11px] text-muted-foreground/70">
                    v1 · Research · Image · Video
                </div>
            </aside>
            <main className="flex-1 min-w-0">{children}</main>
        </div>
    );
}
