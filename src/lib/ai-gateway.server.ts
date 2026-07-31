import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ProviderName = "groq" | "gemini" | "openai" | "mistral" | "together";

interface ProviderConfig {
  name: ProviderName;
  baseURL: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {

  gemini: {
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GOOGLE_GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
  },

  groq: {
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
  },

  // Plain OpenAI — used as the fallback for tool-calling routes because
  // Gemini's OpenAI-compatible endpoint doesn't round-trip the
  // `thought_signature` its newer "thinking" models require for
  // multi-turn function calling, which breaks any tool-using
  // conversation past the first turn (400 INVALID_ARGUMENT).
  openai: {
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-4.1-mini",
  },

  mistral: {
    name: "mistral",
    baseURL: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
  },

  together: {
    name: "together",
    baseURL: "https://api.together.xyz/v1",
    apiKeyEnv: "TOGETHER_API_KEY",
    modelEnv: "TOGETHER_MODEL",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  },
};

function getConfig(provider: ProviderName) {
  const cfg = PROVIDERS[provider];

  return {
    ...cfg,
    apiKey: process.env[cfg.apiKeyEnv] ?? "",
    model: process.env[cfg.modelEnv] ?? process.env.AI_MODEL ?? cfg.defaultModel,
  };
}

export function getPrimaryModelName(provider: ProviderName = "groq") {
  return getConfig(provider).model;
}

export function createFreeAiProvider(provider: ProviderName) {
  const cfg = getConfig(provider);

  if (!cfg.apiKey) {
    throw new Error(`Missing ${cfg.apiKeyEnv} environment variable.`);
  }

  return createOpenAICompatible({
    name: cfg.name,
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    headers: {
      "User-Agent": "Nexus-AI",
    },
  });
}

export function createAiProviderWithFallback(
  primary: ProviderName = "groq",
  fallback: ProviderName = "gemini",
) {
  const primaryCfg = getConfig(primary);
  const fallbackCfg = getConfig(fallback);

  if (!primaryCfg.apiKey) {
    throw new Error(`Missing ${primaryCfg.apiKeyEnv}`);
  }

  const primaryProvider = createOpenAICompatible({
    name: primaryCfg.name,
    apiKey: primaryCfg.apiKey,
    baseURL: primaryCfg.baseURL,
    headers: {
      "User-Agent": "Nexus-AI",
    },

    fetch: async (input, init) => {
      try {
        const response = await fetch(input, init);

        if (response.ok) {
          return response;
        }

        console.warn(`[AI] ${primary} returned ${response.status}.`);

        // If no fallback API key exists, return the original response.
        if (!fallbackCfg.apiKey) {
          return response;
        }

        console.warn(`[AI] Falling back from ${primary} to ${fallback}...`);
      } catch (error) {
        console.warn(`[AI] ${primary} request failed:`, error);

        if (!fallbackCfg.apiKey) {
          throw error;
        }
      }

      // Build fallback URL
      const originalUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      const fallbackUrl = originalUrl.replace(primaryCfg.baseURL, fallbackCfg.baseURL);

      // Clone headers
      const headers = new Headers(init?.headers);

      headers.set("Authorization", `Bearer ${fallbackCfg.apiKey}`);

      // Replace model inside request body
      let body = init?.body;

      if (typeof body === "string") {
        try {
          const json = JSON.parse(body);

          json.model = fallbackCfg.model;

          body = JSON.stringify(json);
        } catch {
          // ignore JSON parse errors
        }
      }

      return fetch(fallbackUrl, {
        ...init,
        headers,
        body,
      });
    },
  });

  return primaryProvider;
}

export function createAiProvider() {
  const provider = (process.env.AI_PROVIDER ?? "groq").toLowerCase() as ProviderName;

  return createFreeAiProvider(provider);
}

export function getDefaultModel() {
  const provider = (process.env.AI_PROVIDER ?? "groq").toLowerCase() as ProviderName;

  return getConfig(provider).model;
}
