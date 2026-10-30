import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LLMUnavailableError, ProviderError } from "./errors";
import { createLLMClient } from "./client";
import type { ChatRequest, LLMProvider } from "./types";

// A provider that replays scripted results: a string is a reply, an Error is thrown.
function fakeProvider(name: string, steps: Array<string | Error>) {
  const calls: ChatRequest[] = [];
  const provider: LLMProvider & { calls: ChatRequest[] } = {
    name,
    model: `${name}-model`,
    calls,
    async chat(req) {
      calls.push(req);
      const step = steps.shift();
      if (step === undefined) throw new Error(`${name} has no scripted reply left`);
      if (step instanceof Error) throw step;
      return step;
    },
    chatStream() {
      throw new Error("chatStream is not used in these tests");
    },
  };
  return provider;
}

const schema = z.object({ name: z.string() });
const validJson = JSON.stringify({ name: "ok" });
const messages = [{ role: "user" as const, content: "Make a spec" }];
const quiet = { log: () => {} };

describe("createLLMClient.generateJson", () => {
  it("returns the validated value from the first provider", async () => {
    const a = fakeProvider("a", [validJson]);
    const client = createLLMClient({ providers: [a], ...quiet });

    const result = await client.generateJson(schema, messages);

    expect(result).toEqual({ value: { name: "ok" }, provider: "a", model: "a-model" });
    expect(a.calls).toHaveLength(1);
  });

  it("falls back after a 429 and skips the rate-limited provider during the cooldown", async () => {
    let time = 0;
    const a = fakeProvider("a", [new ProviderError("a", "rate_limit", "rate limited (HTTP 429)")]);
    const b = fakeProvider("b", [validJson, validJson]);
    const client = createLLMClient({ providers: [a, b], now: () => time, ...quiet });

    const first = await client.generateJson(schema, messages);
    expect(first.provider).toBe("b");

    // Still inside the 60 second cooldown: A is not called again.
    time = 59_999;
    const second = await client.generateJson(schema, messages);
    expect(second.provider).toBe("b");
    expect(a.calls).toHaveLength(1);
  });

  it("tries a rate-limited provider again once the 60 second cooldown has passed", async () => {
    let time = 0;
    const a = fakeProvider("a", [new ProviderError("a", "rate_limit", "rate limited (HTTP 429)"), validJson]);
    const b = fakeProvider("b", [validJson]);
    const client = createLLMClient({ providers: [a, b], now: () => time, ...quiet });

    await client.generateJson(schema, messages);
    time = 60_000;
    const result = await client.generateJson(schema, messages);

    expect(result.provider).toBe("a");
  });

  it("makes one repair call after invalid JSON and then succeeds", async () => {
    const a = fakeProvider("a", ["not json", validJson]);
    const client = createLLMClient({ providers: [a], ...quiet });

    const result = await client.generateJson(schema, messages);

    expect(result.provider).toBe("a");
    expect(a.calls).toHaveLength(2);
    const repairMessages = a.calls[1].messages;
    expect(repairMessages.at(-2)).toEqual({ role: "assistant", content: "not json" });
    expect(repairMessages.at(-1)?.content).toContain("response is not valid JSON");
  });

  it("moves to the next provider when the repair also fails", async () => {
    const a = fakeProvider("a", ["not json", "still not json"]);
    const b = fakeProvider("b", [validJson]);
    const client = createLLMClient({ providers: [a, b], ...quiet });

    const result = await client.generateJson(schema, messages);

    expect(result.provider).toBe("b");
    expect(a.calls).toHaveLength(2);
    expect(b.calls).toHaveLength(1);
  });

  it("throws a typed error with a summary per provider when all providers fail", async () => {
    const a = fakeProvider("a", [new ProviderError("a", "server", "HTTP 503")]);
    const b = fakeProvider("b", ["nope", "nope"]);
    const client = createLLMClient({ providers: [a, b], ...quiet });

    const error = await client.generateJson(schema, messages).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LLMUnavailableError);
    expect((error as LLMUnavailableError).failures).toEqual([
      { provider: "a", reason: "HTTP 503" },
      { provider: "b", reason: "output failed validation after one repair" },
    ]);
  });

  it("throws LLMUnavailableError when no providers are configured", async () => {
    const client = createLLMClient({ providers: [], ...quiet });
    await expect(client.generateJson(schema, messages)).rejects.toBeInstanceOf(LLMUnavailableError);
  });

  it("logs metadata for each attempt without prompt or answer text", async () => {
    const events: unknown[] = [];
    const a = fakeProvider("a", ["not json", validJson]);
    const client = createLLMClient({ providers: [a], log: (event) => events.push(event) });

    await client.generateJson(schema, messages);

    expect(events).toEqual([
      expect.objectContaining({ event: "llm_attempt", provider: "a", attempt: 1, outcome: "ok" }),
      expect.objectContaining({ event: "llm_attempt", provider: "a", attempt: 2, outcome: "ok" }),
    ]);
    expect(JSON.stringify(events)).not.toContain("Make a spec");
  });
});
