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
2. A single complete, production-quality HTML document in one fenced code block tagged \`\`\`html, containing everything inline: <style> in the <head>, and any needed <script> at the end of <body>. Do not use external CSS/JS files or CDNs unless explicitly asked (Google Fonts links are fine).

Design standards (apply every time, even if not asked explicitly — these are not optional extras, they are the baseline):
- A real, deliberate color palette using CSS custom properties (e.g. --color-primary, --color-bg, --color-surface, --color-text) — never default black-on-white with plain gray section bands.
- A distinctive heading font paired with a clean body font, loaded via Google Fonts (e.g. Space Grotesk + Inter, Fraunces + Karla, Playfair Display + Source Sans 3 — vary the pairing based on the site's personality, don't always default to the same one).
- Generous whitespace and a consistent spacing scale (e.g. --space-1 through --space-6), not cramped default margins.
- At least one visually distinct hero/header section with a background treatment (gradient, subtle pattern, or accent color) — not a plain white block with a heading.
- Cards/sections with real visual weight: border-radius, subtle shadows or borders, hover states that lift or highlight.
- CSS Grid/Flexbox for layout, responsive with at least one @media breakpoint for mobile.
- Real, coherent placeholder content relevant to the request — no "Lorem ipsum", no obviously fake filler.
- Semantic HTML (nav, header, main, section, footer) and accessible markup (alt text, label/for, sufficient contrast).
- Images via https://picsum.photos/WIDTH/HEIGHT or https://placehold.co/WIDTHxHEIGHT — never broken/empty src.

Use this as your structural and quality baseline — adapt the palette, fonts, copy, and content to match what's being asked for, but do not regress below this level of polish:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>[Site Title]</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --color-bg: #0f1115;
    --color-surface: #171a21;
    --color-primary: #6c5ce7;
    --color-accent: #00d4ff;
    --color-text: #e8e9ed;
    --color-text-muted: #9497a3;
    --space-1: 0.5rem; --space-2: 1rem; --space-3: 1.5rem; --space-4: 2.5rem; --space-5: 4rem; --space-6: 6rem;
    --radius: 16px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--color-bg); color: var(--color-text); line-height: 1.6; }
  h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; line-height: 1.15; }
  .container { max-width: 1100px; margin: 0 auto; padding: 0 var(--space-3); }
  header { padding: var(--space-3) 0; }
  nav { display: flex; justify-content: space-between; align-items: center; }
  nav a { color: var(--color-text-muted); text-decoration: none; margin-left: var(--space-3); transition: color 0.2s; }
  nav a:hover { color: var(--color-text); }
  .hero { padding: var(--space-6) 0; background: radial-gradient(circle at 30% 20%, rgba(108,92,231,0.25), transparent 60%); text-align: center; }
  .hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: var(--space-2); }
  .hero p { color: var(--color-text-muted); max-width: 40ch; margin: 0 auto var(--space-3); }
  .btn { display: inline-block; background: var(--color-primary); color: white; padding: 0.8rem 1.8rem; border-radius: 999px; text-decoration: none; font-weight: 500; transition: transform 0.15s, box-shadow 0.15s; }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,92,231,0.4); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); padding: var(--space-5) 0; }
  .card { background: var(--color-surface); border-radius: var(--radius); padding: var(--space-3); border: 1px solid rgba(255,255,255,0.06); transition: transform 0.2s, border-color 0.2s; }
  .card:hover { transform: translateY(-4px); border-color: var(--color-primary); }
  footer { padding: var(--space-4) 0; text-align: center; color: var(--color-text-muted); border-top: 1px solid rgba(255,255,255,0.06); margin-top: var(--space-5); }
  @media (max-width: 640px) { nav { flex-direction: column; gap: var(--space-2); } }
</style>
</head>
<body>
  <div class="container">
    <header><nav><strong>[Brand]</strong><div><a href="#">Link</a><a href="#">Link</a></div></nav></header>
  </div>
  <section class="hero">
    <div class="container">
      <h1>[Headline]</h1>
      <p>[Supporting line]</p>
      <a class="btn" href="#">[Call to action]</a>
    </div>
  </section>
  <div class="container">
    <div class="grid">
      <div class="card"><h3>[Item]</h3><p>[Description]</p></div>
      <div class="card"><h3>[Item]</h3><p>[Description]</p></div>
      <div class="card"><h3>[Item]</h3><p>[Description]</p></div>
    </div>
  </div>
  <footer><div class="container">[Footer text]</div></footer>
</body>
</html>
\`\`\`

This example uses a dark theme — for the actual request, choose light, dark, or colorful based on what fits the subject (an ice cream shop might want a warm cream/pastel palette; a law firm might want navy and gold; a kids' product might want bright saturated colors). The point is the LEVEL of polish (custom fonts, spacing scale, hero treatment, card hover states), not the specific colors.

When the user asks to modify or fix an existing design (e.g. "make it look better"), always output the FULL updated HTML document again in one fenced code block — never a diff, never CSS alone.

Never say a design is "done" if it would render as unstyled or generic — the code you output IS what gets rendered directly in the browser.`;

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
                const modelName = process.env.GROQ_CODE_MODEL || "openai/gpt-oss-120b";

                try {
                    const result = streamText({
                        model: provider(modelName),
                        system: SYSTEM,
                        messages: body.messages,
                        // No `tools` here on purpose — see comment above.
                        // A full styled HTML document (custom fonts, CSS vars, several
                        // sections) runs long — give it real headroom so it doesn't get
                        // cut off mid-<style> block on a default token cap.
                        maxOutputTokens: 4000,
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