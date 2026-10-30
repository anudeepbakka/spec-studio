import { z } from "zod";
import { ProviderError, type ProviderErrorKind } from "./errors";
import type { ChatRequest, LLMProvider } from "./types";

// SPEC §8: one provider class for every OpenAI-compatible /chat/completions endpoint.

export type OpenAICompatibleConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const ChatResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullish() }) }))
    .min(1),
});

const StreamChunkSchema = z.object({
  choices: z.array(z.object({ delta: z.object({ content: z.string().nullish() }) })),
});

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): LLMProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  async function post(req: ChatRequest, stream: boolean): Promise<Response> {
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const signal = AbortSignal.any(req.signal ? [req.signal, timeout] : [timeout]);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages,
          stream,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal,
      });
    } catch (error) {
      throw toProviderError(config.name, error, req.signal);
    }

    if (!response.ok) {
      throw statusError(config.name, response.status);
    }
    return response;
  }

  async function chat(req: ChatRequest): Promise<string> {
    const response = await post(req, false);

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw toProviderError(config.name, error, req.signal);
    }

    const parsed = ChatResponseSchema.safeParse(body);
    const content = parsed.success ? parsed.data.choices[0].message.content : null;
    if (!content) {
      throw new ProviderError(config.name, "invalid_output", "response had no message content");
    }
    return content;
  }

  // Server-Sent Events: each line is "data: {json}", the stream ends with "data: [DONE]".
  async function* streamChat(req: ChatRequest): AsyncGenerator<string> {
    const response = await post(req, true);
    if (!response.body) {
      throw new ProviderError(config.name, "invalid_output", "response had no body");
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += value;

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");

          if (!line.startsWith("data:")) continue;
          const payload = line.slice("data:".length).trim();
          if (payload === "[DONE]") return;

          const delta = parseDelta(config.name, payload);
          if (delta) yield delta;
        }
      }
    } catch (error) {
      throw toProviderError(config.name, error, req.signal);
    }
  }

  return {
    name: config.name,
    model: config.model,
    chat,
    chatStream: streamChat,
  };
}

function parseDelta(name: string, payload: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new ProviderError(name, "invalid_output", "stream chunk was not valid JSON");
  }

  const parsed = StreamChunkSchema.safeParse(data);
  if (!parsed.success) {
    throw new ProviderError(name, "invalid_output", "stream chunk had an unexpected shape");
  }
  return parsed.data.choices[0]?.delta.content ?? null;
}

function statusError(name: string, status: number): ProviderError {
  const kind: ProviderErrorKind = status === 429 ? "rate_limit" : status >= 500 ? "server" : "client";
  const message = status === 429 ? `rate limited (HTTP ${status})` : `HTTP ${status}`;
  return new ProviderError(name, kind, message);
}

// Maps fetch and stream failures to ProviderErrors. If the caller cancelled,
// the original error is returned so it propagates instead of triggering fallback.
function toProviderError(name: string, error: unknown, callerSignal?: AbortSignal): unknown {
  if (callerSignal?.aborted) return error;
  if (error instanceof ProviderError) return error;

  const errorName =
    typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (errorName === "TimeoutError" || errorName === "AbortError") {
    return new ProviderError(name, "timeout", "timed out");
  }
  return new ProviderError(name, "network", "network error");
}
