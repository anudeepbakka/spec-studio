import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "./errors";
import { createOpenAICompatibleProvider } from "./openai-compatible";

const baseConfig = {
  name: "groq",
  baseUrl: "https://example.test/v1/",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 1000,
};
const request = { messages: [{ role: "user" as const, content: "hi" }] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const completion = (content: string) => jsonResponse({ choices: [{ message: { content } }] });

describe("createOpenAICompatibleProvider.chat", () => {
  it("posts to /chat/completions with the key and JSON mode, and returns the content", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion('{"ok":true}'));
    const provider = createOpenAICompatibleProvider({ ...baseConfig, fetchImpl });

    const text = await provider.chat({ ...request, json: true });

    expect(text).toBe('{"ok":true}');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(init?.headers).toMatchObject({ authorization: "Bearer test-key" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
    });
  });

  it("maps HTTP 429 to a rate_limit error", async () => {
    const provider = createOpenAICompatibleProvider({
      ...baseConfig,
      fetchImpl: async () => jsonResponse({}, 429),
    });
    const error = await provider.chat(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("rate_limit");
  });

  it("maps HTTP 5xx to a server error and other 4xx to a client error", async () => {
    const server = createOpenAICompatibleProvider({ ...baseConfig, fetchImpl: async () => jsonResponse({}, 503) });
    const client = createOpenAICompatibleProvider({ ...baseConfig, fetchImpl: async () => jsonResponse({}, 401) });

    await expect(server.chat(request)).rejects.toMatchObject({ kind: "server" });
    await expect(client.chat(request)).rejects.toMatchObject({ kind: "client" });
  });

  it("maps a timeout to a timeout error", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const provider = createOpenAICompatibleProvider({ ...baseConfig, fetchImpl: async () => Promise.reject(timeout) });
    await expect(provider.chat(request)).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps a network failure to a network error", async () => {
    const provider = createOpenAICompatibleProvider({
      ...baseConfig,
      fetchImpl: async () => Promise.reject(new TypeError("fetch failed")),
    });
    await expect(provider.chat(request)).rejects.toMatchObject({ kind: "network" });
  });

  it("treats a response with no message content as invalid output", async () => {
    const provider = createOpenAICompatibleProvider({
      ...baseConfig,
      fetchImpl: async () => jsonResponse({ choices: [{ message: { content: null } }] }),
    });
    await expect(provider.chat(request)).rejects.toMatchObject({ kind: "invalid_output" });
  });
});

describe("createOpenAICompatibleProvider.chatStream", () => {
  it("yields content deltas from SSE lines until [DONE]", async () => {
    const provider = createOpenAICompatibleProvider({
      ...baseConfig,
      fetchImpl: async () =>
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
          'data: {"choices":[{"delta":{}}]}\n',
          "data: [DONE]\n",
          'data: {"choices":[{"delta":{"content":"ignored"}}]}\n',
        ]),
    });

    const parts: string[] = [];
    for await (const part of provider.chatStream(request)) parts.push(part);

    expect(parts).toEqual(["Hel", "lo"]);
  });
});
