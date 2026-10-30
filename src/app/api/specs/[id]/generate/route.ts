import { type NextRequest } from "next/server";
import { describeError, errorResponse } from "@/lib/api/errors";
import { specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { getDeps } from "@/lib/server/deps";
import { runGeneration, startGeneration, type GenerationEvent } from "@/lib/specs/generate";

type Context = { params: Promise<{ id: string }> };

// SPEC §10: Server-Sent Events. Each event is `event: <type>` with a JSON `data:` line.
function formatSse(event: GenerationEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /api/specs/:id/generate: streams progress, then the spec or an error. One LLM run.
export async function POST(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    const deps = getDeps();
    // Refusals (not found, wrong state, daily limit) happen here, before the stream starts.
    const input = await startGeneration(deps, owner, id);

    const abort = new AbortController();
    request.signal.addEventListener("abort", () => abort.abort());
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // The client may already have gone away, so a failed write is ignored.
        const send = (event: GenerationEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSse(event)));
          } catch {
            // The stream is closed.
          }
        };
        runGeneration(deps, owner, id, input, send, abort.signal)
          .catch((error: unknown) => {
            // runGeneration reports its own failures. Anything here is a database error; log its name only.
            describeError(error);
          })
          .finally(() => {
            try {
              controller.close();
            } catch {
              // Already closed by cancel().
            }
          });
      },
      cancel() {
        abort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
