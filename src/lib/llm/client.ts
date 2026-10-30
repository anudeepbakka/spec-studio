import type { ZodType } from "zod";
import { LLMUnavailableError, ProviderError, type ProviderFailure } from "./errors";
import { buildRepairMessages, parseAndValidate } from "./json";
import type { ChatMessage, ChatRequest, LLMProvider } from "./types";

// SPEC §8: ordered fallback, 60s cooldown after 429, JSON validation with one repair.

export type LLMLogEvent = {
  event: "llm_attempt";
  provider: string;
  model: string;
  attempt: number;
  outcome: "ok" | ProviderError["kind"] | "error";
  latencyMs: number;
};

export type LLMClientOptions = {
  providers: LLMProvider[];
  cooldownMs?: number;
  now?: () => number;
  log?: (event: LLMLogEvent) => void;
};

export type GenerateResult<T> = { value: T; provider: string; model: string };

export type GenerateOptions = {
  signal?: AbortSignal;
  // Called with the running character count while the model streams its answer (SPEC §10).
  // The count restarts when the repair call begins.
  onProgress?: (chars: number) => void;
};

const RATE_LIMIT_COOLDOWN_MS = 60_000;

export function createLLMClient(options: LLMClientOptions) {
  const { providers } = options;
  const cooldownMs = options.cooldownMs ?? RATE_LIMIT_COOLDOWN_MS;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((event: LLMLogEvent) => console.info(JSON.stringify(event)));
  const cooldownUntil = new Map<string, number>();
  let attempt = 0;

  // Runs `run` against each provider in order and returns the first success.
  // Provider failures move on to the next provider. Other errors are rethrown.
  async function withFallback<T>(
    run: (provider: LLMProvider) => Promise<T>,
  ): Promise<{ value: T; provider: LLMProvider }> {
    const failures: ProviderFailure[] = [];
    for (const provider of providers) {
      if ((cooldownUntil.get(provider.name) ?? 0) > now()) {
        failures.push({ provider: provider.name, reason: "skipped, cooling down after rate limit" });
        continue;
      }
      try {
        return { value: await run(provider), provider };
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        if (error.kind === "rate_limit") {
          cooldownUntil.set(provider.name, now() + cooldownMs);
        }
        failures.push({ provider: provider.name, reason: error.message });
      }
    }
    throw new LLMUnavailableError(failures);
  }

  // Times one provider call and logs metadata only (never prompts or answers).
  async function timed<T>(provider: LLMProvider, call: () => Promise<T>): Promise<T> {
    attempt += 1;
    const started = now();
    const base = { event: "llm_attempt" as const, provider: provider.name, model: provider.model, attempt };
    try {
      const value = await call();
      log({ ...base, outcome: "ok", latencyMs: now() - started });
      return value;
    } catch (error) {
      const outcome = error instanceof ProviderError ? error.kind : "error";
      log({ ...base, outcome, latencyMs: now() - started });
      throw error;
    }
  }

  async function chat(messages: ChatMessage[], signal?: AbortSignal): Promise<GenerateResult<string>> {
    const { value, provider } = await withFallback((p) => timed(p, () => p.chat({ messages, signal })));
    return { value, provider: provider.name, model: provider.model };
  }

  // Without onProgress, one plain call. With it, the answer is streamed and the running length is reported.
  async function complete(
    provider: LLMProvider,
    req: ChatRequest,
    onProgress?: (chars: number) => void,
  ): Promise<string> {
    if (!onProgress) return provider.chat(req);

    let text = "";
    for await (const chunk of provider.chatStream(req)) {
      text += chunk;
      onProgress(text.length);
    }
    return text;
  }

  // Asks for JSON and validates it. On invalid output, makes one repair call on the
  // same provider. If that also fails, the next provider is tried.
  async function generateJson<T>(
    schema: ZodType<T, unknown>,
    messages: ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<GenerateResult<T>> {
    const { signal, onProgress } = options;
    const { value, provider } = await withFallback(async (p) => {
      const raw = await timed(p, () => complete(p, { messages, json: true, signal }, onProgress));
      const first = parseAndValidate(schema, raw);
      if (first.ok) return first.value;

      const repairedRaw = await timed(p, () =>
        complete(p, { messages: buildRepairMessages(messages, raw, first.errors), json: true, signal }, onProgress),
      );
      const second = parseAndValidate(schema, repairedRaw);
      if (second.ok) return second.value;

      throw new ProviderError(p.name, "invalid_output", "output failed validation after one repair");
    });
    return { value, provider: provider.name, model: provider.model };
  }

  return { chat, generateJson };
}

export type LLMClient = ReturnType<typeof createLLMClient>;
