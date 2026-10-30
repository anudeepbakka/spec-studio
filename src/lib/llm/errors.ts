// Typed errors for the LLM layer. Messages are safe to show and log:
// they never include prompts, answers, keys, or response bodies.

export type ProviderErrorKind =
  | "rate_limit"
  | "server"
  | "client"
  | "timeout"
  | "network"
  | "invalid_output";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ProviderFailure = { provider: string; reason: string };

// Thrown when every provider failed or was skipped (SPEC §8). The API maps it to HTTP 503.
export class LLMUnavailableError extends Error {
  constructor(readonly failures: ProviderFailure[]) {
    const summary = failures.map((failure) => `${failure.provider}: ${failure.reason}`).join("; ");
    super(
      failures.length > 0
        ? `All LLM providers failed (${summary})`
        : "No LLM providers are configured",
    );
    this.name = "LLMUnavailableError";
  }
}
