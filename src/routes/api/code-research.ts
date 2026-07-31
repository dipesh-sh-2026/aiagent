import { createFileRoute } from "@tanstack/react-router";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createFreeAiProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `You are Nexus Code Research — acting as a principal/staff-level software engineer, not a generic chatbot.
You have access to a web_search tool that performs live web searches.

Search strategy:
- Prefer official documentation (MDN, language/framework docs, API references) first.
- For real-world problems, bugs, and "how do I..." questions, search Stack Overflow and GitHub Issues/Discussions.
- For library internals, usage examples, or "is this maintained" questions, search GitHub repos directly.
- Always search at least once before answering a question that involves a specific library, framework, error message, or API you are not 100% certain about — never invent function names, flags, or config options.
- Prefer recent results over old ones when APIs or best practices may have changed; call out when something is deprecated or has been superseded.

Engineering standards to apply on every answer:
- Correctness first: verify logic and edge cases (empty input, nulls, concurrency, large scale) before presenting a solution as final.
- Security: flag injection risks, secrets in code, unsafe deserialization, missing input validation, or auth/permission gaps — even if not asked.
- Performance: note time/space complexity when relevant, and flag obviously inefficient patterns (e.g. O(n^2) where O(n log n) exists, N+1 queries, unnecessary re-renders).
- Maintainability: prefer clear, idiomatic code for the language/framework in use over clever one-liners. Note naming, structure, or separation-of-concerns issues if they matter.
- Testing: for non-trivial code, suggest what should be unit-tested (edge cases, failure paths), not just the happy path.
- Trade-offs over dogma: when there are multiple valid approaches, briefly state the trade-off (simplicity vs performance, dependency size, learning curve) instead of asserting one "correct" answer.
- Honesty: if you're not sure, say so and search rather than guessing. Never fabricate API surfaces.

When reviewing code the user pastes in:
- Point out actual bugs and risks first, in priority order (correctness/security > performance > style).
- Give a corrected version, not just a description of the problem.
- Don't nitpick pure style preferences unless asked — focus on things that would matter in a real code review.

Answer format:
- Lead with the direct, correct answer, then explain briefly — no throat-clearing.
- Put all code in fenced code blocks with the correct language tag.
- If there are multiple valid approaches, show the recommended one first and mention alternatives with their trade-offs.
- Call out version-specific behavior or breaking changes when relevant.
- End with a "Sources" section as a bullet list of [title](url) links you used.
Be precise and dense with signal — developers reading this want a senior engineer's judgment, not padding.`;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
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

// Sites to bias toward when doing real (non-demo) search.
const PREFERRED_DOMAINS = [
  "stackoverflow.com",
  "github.com",
  "developer.mozilla.org",
  "docs.python.org",
  "npmjs.com",
];

const DEMO_RESULTS = {
  "react hooks": {
    results: [
      { title: "Hooks API Reference – React", url: "https://react.dev/reference/react", snippet: "Hooks let you use different React features from your components..." },
      { title: "useState - React Docs", url: "https://react.dev/reference/react/useState", snippet: "useState is a Hook that lets you add a state variable to your component." },
    ],
  },
};

export const Route = createFileRoute("/api/code-research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages: ChatMessage[] };

        // Groq only — no Gemini fallback here. Gemini's "thinking" models
        // require a thought_signature round-trip on multi-turn tool calls
        // that the OpenAI-compatible bridge doesn't carry, which breaks
        // this route's web_search tool after the first search round.
        const provider = createFreeAiProvider("groq", process.env.GROQ_API_KEY || "");
        const modelName = process.env.GROQ_CODE_MODEL || "openai/gpt-oss-120b";

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        const demoMode = !firecrawlKey || firecrawlKey.includes("placeholder");

        const webSearch = tool({
          description:
            "Search the live web for programming/technical information. Biased toward official docs, Stack Overflow, and GitHub. Returns titles, URLs, and short snippets.",
          inputSchema: z.object({
            query: z.string().describe("The search query — include the language/framework name for best results"),
            limit: z.number().min(1).max(10).optional().describe("Number of results, default 5, max 10"),
          }),
          execute: async ({ query, limit }) => {
            const safeLimit = Math.min(Math.max(limit ?? 5, 1), 10);
            if (demoMode) {
              const lowerQuery = query.toLowerCase();
              for (const [key, data] of Object.entries(DEMO_RESULTS)) {
                if (lowerQuery.includes(key.split(" ")[0])) {
                  return { results: data.results.slice(0, safeLimit), demo: true };
                }
              }
              return {
                results: [
                  {
                    title: `Search results for "${query}"`,
                    url: "https://stackoverflow.com",
                    snippet: "Demo mode: connect a real FIRECRAWL_API_KEY for live doc/StackOverflow/GitHub search.",
                  },
                ],
                demo: true,
              };
            }

            try {
              // Nudge results toward developer-relevant sources.
              const biasedQuery = `${query} (site:stackoverflow.com OR site:github.com OR site:developer.mozilla.org OR docs)`;
              const res = await fetch("https://api.firecrawl.dev/v2/search", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${firecrawlKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: biasedQuery, limit: safeLimit }),
              });
              if (!res.ok) {
                const txt = await res.text().catch(() => "");
                return { error: `Search failed (${res.status}): ${txt.slice(0, 200)}` };
              }
              const data = (await res.json()) as {
                data?: { web?: Array<{ url: string; title: string; description?: string }> } | Array<{ url: string; title: string; description?: string }>;
              };
              const arr = Array.isArray(data.data) ? data.data : data.data?.web ?? [];
              const results = arr.slice(0, safeLimit).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.description ?? "",
                preferred: PREFERRED_DOMAINS.some((d) => r.url.includes(d)),
              }));
              // Preferred domains float to the top.
              results.sort((a, b) => Number(b.preferred) - Number(a.preferred));
              return { results };
            } catch (e) {
              return { error: `Search exception: ${(e as Error).message}` };
            }
          },
        });

        try {
          const result = streamText({
            model: provider(modelName),
            system: SYSTEM,
            messages: body.messages,
            tools: { web_search: webSearch },
            stopWhen: stepCountIs(6),
            // gpt-oss models can leak reasoning content into malformed
            // tool calls at higher reasoning effort — "low" reduces that.
            providerOptions: { groq: { reasoning_effort: "low" } },
          });

          return result.toUIMessageStreamResponse({
            onError: (error) => {
              const message = getErrorMessage(error);
              console.error("[code-research] stream error:", message, error);
              return message;
            },
          });
        } catch (e) {
          console.error("[code-research] request setup failed:", e);
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