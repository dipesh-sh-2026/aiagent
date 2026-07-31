import { createFileRoute } from "@tanstack/react-router";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { TinyFish } from "@tiny-fish/sdk";

import { createFreeAiProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `
You are Nexus Research.

You are an expert AI research assistant.

Rules:

- Always search the web for factual or current questions.
- Use web_search at most twice per question unless the results genuinely conflict and a third search would resolve it — extra searches add real latency, so don't search "just to be thorough" once you have a clear answer.
- Only use fetch_page when a search snippet is genuinely insufficient to answer confidently — it's much slower than search, so treat it as a last resort, not a default step.
- Verify important facts with multiple sources, but stop as soon as you have enough agreement — don't keep searching after the answer is already clear.
- Prefer official documentation.
- Prefer recent information.
- Never invent citations.
- If search results disagree, explain the disagreement.
- Keep answers concise but complete.
- Return Markdown.
`;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;

    // AI SDK's APICallError carries the raw HTTP response body separately
    // from `.message` (which is often just the generic status text like
    // "Bad Request") — that body usually has the actual provider reason.
    const responseBody = e.responseBody;
    if (typeof responseBody === "string" && responseBody.trim()) {
      try {
        const parsed = JSON.parse(responseBody);
        const nested = parsed?.error;
        if (typeof nested === "string") return nested;
        if (nested && typeof nested.message === "string") return nested.message;
      } catch {
        // not JSON — fall through and use the raw body text below
      }
      return responseBody.slice(0, 500);
    }

    if (typeof e.message === "string" && e.message) {
      return e.message;
    }

    const data = e.data as Record<string, unknown> | undefined;

    if (data && typeof data.error === "object") {
      const nested = data.error as Record<string, unknown>;

      if (typeof nested.message === "string") {
        return nested.message;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

// Groq only — no LLM-level fallback here. Gemini's "thinking" models require a
// thought_signature round-trip on multi-turn tool calls that the OpenAI-compatible
// bridge doesn't carry through, which breaks this route's search/fetch tools on
// the second tool-call round (works fine for the first search, then errors).
// OpenAI isn't an option either (removed intentionally — paid). If Groq itself
// is down, this route will error rather than silently degrade into a broken
// multi-turn state; the search-provider fallback (TinyFish → Firecrawl) below
// still applies independently of this.
const provider = createFreeAiProvider("groq", process.env.GROQ_API_KEY || "");

const MODEL = process.env.GROQ_RESEARCH_MODEL ?? "openai/gpt-oss-120b";

const tinyFish = process.env.TINYFISH_API_KEY ? new TinyFish() : null;

const firecrawlKey = process.env.FIRECRAWL_API_KEY;

const firecrawlAvailable = !!firecrawlKey && !firecrawlKey.includes("placeholder");

const webSearchTool = tool({
  description:
    "Search the live web for current information. Returns a list of results with titles, URLs and snippets. Use this for any factual or time-sensitive question.",
  inputSchema: z.object({
    query: z.string().describe("The search query."),
    recency_minutes: z
      .number()
      .optional()
      .describe("Only return results from the last N minutes, if freshness matters."),
  }),
  execute: async ({ query, recency_minutes }) => {
    try {
      if (tinyFish) {
        const res = await tinyFish.search.query({
          query,
          domain_type: "web",
          recency_minutes,
        });
        return {
          provider: "tinyfish",
          results: res.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            site: r.site_name,
            date: r.date,
          })),
        };
      }

      if (firecrawlAvailable) {
        const { Firecrawl } = await import("@mendable/firecrawl-js");
        const fc = new Firecrawl({ apiKey: firecrawlKey });
        const res = await fc.search(query, { limit: 8 });
        return {
          provider: "firecrawl",
          results: ((res.web ?? []) as { title?: string; url: string; description?: string }[]).map(
            (r) => ({
              title: r.title,
              url: r.url,
              snippet: r.description,
            }),
          ),
        };
      }

      return {
        error: "No search provider configured. Set TINYFISH_API_KEY or FIRECRAWL_API_KEY.",
      };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  },
});

const fetchPageTool = tool({
  description:
    "Fetch and read the full content of a specific URL, returned as clean markdown. Use this to verify claims or pull details a search snippet didn't cover.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch."),
  }),
  execute: async ({ url }) => {
    try {
      if (tinyFish) {
        const res = await tinyFish.fetch.getContents({
          urls: [url],
          format: "markdown",
        });
        return { provider: "tinyfish", url, content: res };
      }

      if (firecrawlAvailable) {
        const { Firecrawl } = await import("@mendable/firecrawl-js");
        const fc = new Firecrawl({ apiKey: firecrawlKey });
        const doc = await fc.scrape(url, { formats: ["markdown"] });
        return { provider: "firecrawl", url, content: doc.markdown };
      }

      return {
        error: "No fetch provider configured. Set TINYFISH_API_KEY or FIRECRAWL_API_KEY.",
      };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  },
});

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages: ChatMessage[] };

        try {
          const result = streamText({
            model: provider(MODEL),
            system: SYSTEM,
            messages: body.messages,
            tools: {
              web_search: webSearchTool,
              fetch_page: fetchPageTool,
            },
            stopWhen: stepCountIs(8),
            // gpt-oss models can leak reasoning content into malformed tool
            // calls at higher reasoning effort — "low" reduces that.
            // reasoning_format: "hidden" is the critical fix here: without it,
            // Groq returns a reasoning_content field that the AI SDK echoes
            // back on the next turn, which Groq then rejects with "property
            // 'reasoning_content' is unsupported" — a known AI SDK/Groq bug.
            // "hidden" stops that field from ever being generated.
            providerOptions: { groq: { reasoning_effort: "low", reasoning_format: "hidden" } },
          });

          return result.toUIMessageStreamResponse({
            onError: (error) => {
              const message = getErrorMessage(error);
              console.error("[research] stream error:", message, error);
              return message;
            },
          });
        } catch (e) {
          console.error("[research] request setup failed:", e);
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