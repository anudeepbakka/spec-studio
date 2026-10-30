import { describe, expect, it } from "vitest";
import { createProvidersFromEnv } from "./registry";

describe("createProvidersFromEnv", () => {
  it("builds providers in LLM_PROVIDERS order", () => {
    const providers = createProvidersFromEnv({
      LLM_PROVIDERS: "gemini,groq",
      GROQ_API_KEY: "k1",
      GROQ_MODEL: "m1",
      GEMINI_API_KEY: "k2",
      GEMINI_MODEL: "m2",
    });
    expect(providers.map((p) => [p.name, p.model])).toEqual([
      ["gemini", "m2"],
      ["groq", "m1"],
    ]);
  });

  it("skips a listed provider that has no API key", () => {
    const providers = createProvidersFromEnv({
      LLM_PROVIDERS: "groq,openrouter",
      GROQ_API_KEY: "k1",
      GROQ_MODEL: "m1",
      OPENROUTER_MODEL: "m2",
    });
    expect(providers.map((p) => p.name)).toEqual(["groq"]);
  });

  it("throws a clear error when a provider has a key but no model", () => {
    expect(() =>
      createProvidersFromEnv({ LLM_PROVIDERS: "groq", GROQ_API_KEY: "k1" }),
    ).toThrow("GROQ_MODEL is required");
  });

  it("throws for an unknown provider name", () => {
    expect(() => createProvidersFromEnv({ LLM_PROVIDERS: "nope" })).toThrow('unknown provider "nope"');
  });

  it("returns no providers when LLM_PROVIDERS is empty", () => {
    expect(createProvidersFromEnv({})).toEqual([]);
  });
});
