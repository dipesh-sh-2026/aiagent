import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search, ImageIcon, Film } from "lucide-react";
import logo from "@/assets/nexus-logo.png";
import iconResearch from "@/assets/icon-research.png";
import iconImage from "@/assets/icon-image.png";
import iconVideo from "@/assets/icon-video.png";

export const Route = createFileRoute("/")({
    head: () => ({
        meta: [
            { title: "Nexus AI — Agentic platform for research, image & video" },
            { name: "description", content: "One workspace, three superpowers: AI research with live web sources, streaming image generation, and AI video creation." },
            { property: "og:title", content: "Nexus AI — Agentic platform" },
            { property: "og:description", content: "Research, generate images, and create videos with one agentic AI workspace." },
        ],
    }),
    component: Landing,
});

const capabilities = [
    {
        to: "/research" as const, label: "Research AI", icon: iconResearch, lucide: Search,
        blurb: "Agentic web research with live sources, citations and streaming reasoning."
    },
    {
        to: "/image" as const, label: "Image Generation", icon: iconImage, lucide: ImageIcon,
        blurb: "Generate stunning visuals with progressive previews and multiple models."
    },
    {
        to: "/video" as const, label: "Video Creation", icon: iconVideo, lucide: Film,
        blurb: "Turn prompts into cinematic short videos with aspect-ratio control."
    },
];

function Landing() {
    return (
        <div className="aurora-bg min-h-screen">
            <header className="flex items-center justify-between px-6 md:px-12 py-6">
                <Link to="/" className="flex items-center gap-3">
                    <img src={logo} alt="Nexus AI" width={40} height={40} />
                    <span className="font-display text-lg font-semibold">Nexus AI</span>
                </Link>
                <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                    <Link to="/research" className="hover:text-foreground transition-colors">Research</Link>
                    <Link to="/image" className="hover:text-foreground transition-colors">Image</Link>
                    <Link to="/video" className="hover:text-foreground transition-colors">Video</Link>
                </nav>
            </header>

            <section className="px-6 md:px-12 pt-16 pb-24 max-w-6xl mx-auto">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    Agentic AI · Multi-modal workspace
                </div>
                <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight">
                    One workspace.
                    <br />
                    <span className="gradient-text">Three superpowers.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                    Nexus AI brings together agentic web research, streaming image generation, and AI video creation
                    in a single, beautifully designed surface.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/research"
                        className="inline-flex items-center gap-2 rounded-full brand-gradient text-primary-foreground px-5 py-3 text-sm font-medium shadow-glow hover:opacity-95 transition">
                        Start researching <ArrowRight className="size-4" />
                    </Link>
                    <Link to="/image"
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-3 text-sm hover:bg-white/10 transition">
                        Open image studio
                    </Link>
                </div>
            </section>

            <section className="px-6 md:px-12 pb-24 max-w-6xl mx-auto">
                <div className="grid md:grid-cols-3 gap-5">
                    {capabilities.map(({ to, label, icon, lucide: Icon, blurb }) => (
                        <Link
                            key={to}
                            to={to}
                            className="group glass-panel p-6 hover:ring-1 hover:ring-primary/40 transition-all relative overflow-hidden"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 opacity-30 group-hover:opacity-60 transition-opacity">
                                <img src={icon} alt="" className="w-full h-full object-contain" loading="lazy" />
                            </div>
                            <Icon className="size-6 text-primary mb-4" />
                            <h3 className="font-display text-xl font-semibold">{label}</h3>
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{blurb}</p>
                            <div className="mt-6 inline-flex items-center gap-1 text-xs text-primary group-hover:gap-2 transition-all">
                                Open <ArrowRight className="size-3" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
