import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createAiProviderWithFallback } from "@/lib/ai-gateway.server";

// IMPORTANT: This route deliberately does NOT use `tools`/function-calling.
// Smaller Groq-hosted models are unreliable at producing well-formed tool-call
// arguments, which surfaces as: "Failed to call a function. Please adjust your
// prompt. See 'failed_generation' for more details." Asking the model to just
// write HTML/CSS as plain text output sidesteps that failure mode entirely.

const SYSTEM = `You are Nexus Site Builder, an expert frontend engineer and designer.

When asked for a website, page, or component, respond with:
1. One short sentence describing what you built (no more).
2. A single complete, production-quality HTML document in one fenced code block tagged \`\`\`html, containing everything inline: <style> in the <head>, and any needed <script> at the end of <body>. Do not use external CSS/JS files or CDNs unless explicitly asked.

Design standards (apply every time, even if not asked explicitly):
- Modern, polished visual design: a real color palette (not just black/white/gray), consistent spacing scale, clear typographic hierarchy (distinct heading sizes/weights), and intentional layout — not default browser styling.
- Use CSS Flexbox/Grid for layout. Make it responsive with at least one @media breakpoint for mobile.
- Add sensible hover/focus states on interactive elements (buttons, links, cards).
- Use real, coherent placeholder content relevant to the request — no "Lorem ipsum" walls of text, no obviously fake filler.
- Semantic HTML (nav, header, main, section, footer) and accessible markup (alt text, label/for, sufficient color contrast).
- If images are referenced, use placeholder image URLs from https://picsum.photos/ or https://placehold.co/ with sensible dimensions — never broken/empty src attributes.

When the user asks to modify or fix an existing design (e.g. "the CSS is blank", "make it look better"), always output the FULL updated HTML document again in one fenced code block — never a diff, never CSS alone, never "add this to your file". The app only knows how to render a complete document.

Never say a design is "done" if it would render as unstyled or broken HTML — the code you output IS what gets rendered directly in the browser.`;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && error !== null) {
        const maybeError = error as Record<string, unknown>;
        const data = maybeError.data as Record<string, unknown> | undefined;
        const nestedError = data?.error as Record<string, unknown> | undefined;
        const message =
            (typeof maybeError.message === "string" && maybeError.message) ||
            (typeof nestedError?.message === "string" && nestedError.message) ||
            (typeof nestedError?.error === "string" && nestedError.error) ||
            (typeof maybeError.cause === "string" && maybeError.cause);
        if (message) return String(message);
    }
    return String(error ?? "Unknown error");
}

export const Route = createFileRoute("/api/website")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                const body = (await request.json()) as { messages: ChatMessage[] };

                const provider = createAiProviderWithFallback("groq", "gemini");
                const modelName = process.env.GROQ_CODE_MODEL || "llama-3.3-70b-versatile";

                try {
                    const result = streamText({
                        model: provider(modelName),
                        system: SYSTEM,
                        messages: body.messages,
                        // No `tools` here on purpose — see comment above.
                    });

                    return result.toUIMessageStreamResponse({
                        onError: (error) => {
                            const message = getErrorMessage(error);
                            console.error("[website] stream error:", message, error);
                            return message;
                        },
                    });
                } catch (e) {
                    console.error("[website] request setup failed:", e);
                    const message = getErrorMessage(e);
                    return new Response(JSON.stringify({ error: message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    },
});