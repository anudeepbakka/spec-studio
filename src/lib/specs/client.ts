import { z } from "zod";

// Browser-side helpers for the API. They never import server code, so they are safe in client components.

export type ApiFailure = { code: string; message: string };

const FALLBACK_FAILURE: ApiFailure = {
  code: "internal_error",
  message: "Something went wrong. Please try again.",
};

const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

// Reads { error: { code, message } } from a failed response. Anything else gets a generic message.
export async function readApiFailure(response: Response): Promise<ApiFailure> {
  try {
    const parsed = ErrorBodySchema.safeParse(await response.json());
    if (parsed.success) {
      return parsed.data.error;
    }
  } catch {
    // Not JSON, so the generic message is used.
  }
  return FALLBACK_FAILURE;
}

export type SseEvent = { event: string; data: string };

// Splits buffered SSE text into complete events. The last piece, which may be an unfinished event, is returned as `rest`.
export function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event: string | null = null;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice("data:".length).replace(/^ /, ""));
      }
    }
    if (event !== null) {
      events.push({ event, data: data.join("\n") });
    }
  }
  return { events, rest };
}
