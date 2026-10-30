// SPEC §8: the provider interface every LLM backend implements.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  json?: boolean;
  signal?: AbortSignal;
};

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  chat(req: ChatRequest): Promise<string>;
  chatStream(req: ChatRequest): AsyncIterable<string>;
}
