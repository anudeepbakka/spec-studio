import { createOpenAICompatibleProvider } from "./openai-compatible";
import type { LLMProvider } from "./types";

// SPEC §14: base URLs and the env var names for each provider.
type ProviderSettings = { baseUrl: string; keyVar: string; modelVar: string };

export const PROVIDER_SETTINGS: Record<string, ProviderSettings> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    keyVar: "OPENROUTER_API_KEY",
    modelVar: "OPENROUTER_MODEL",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
  },
};

const DEFAULT_TIMEOUT_MS = 40_000;

// Builds the provider list in LLM_PROVIDERS order.
// A listed provider with no API key is skipped (SPEC §8).
// A listed provider with a key but no model is a configuration error (SPEC §14).
export function createProvidersFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): LLMProvider[] {
  const timeoutMs = Number(env.LLM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const names = (env.LLM_PROVIDERS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const providers: LLMProvider[] = [];
  for (const name of names) {
    const settings = PROVIDER_SETTINGS[name];
    if (!settings) {
      throw new Error(`LLM_PROVIDERS lists unknown provider "${name}". Use groq, openrouter or gemini.`);
    }

    const apiKey = env[settings.keyVar];
    if (!apiKey) continue;

    const model = env[settings.modelVar];
    if (!model) {
      throw new Error(
        `${settings.modelVar} is required because "${name}" is in LLM_PROVIDERS. Fill it from the provider's current model list.`,
      );
    }

    providers.push(
      createOpenAICompatibleProvider({
        name,
        baseUrl: settings.baseUrl,
        apiKey,
        model,
        timeoutMs,
        fetchImpl,
      }),
    );
  }
  return providers;
}
