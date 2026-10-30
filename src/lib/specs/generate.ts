import type { Owner } from "../owner/scope";
import { ApiError, describeError } from "../api/errors";
import { updateSpec } from "../db/repo";
import { buildSpecMessages, PROMPT_VERSION } from "../prompts";
import { readTurns } from "../interview/service";
import type { Turn } from "../schemas/turn";
import { SpecSchema, type Spec } from "../schemas/spec";
import { findOwnedSpec, isLegacySpec, type SpecDeps } from "./service";
import { specCallReservation } from "./limits";

// SPEC §10: spec generation. startGeneration runs before the SSE stream opens, so its errors
// can still be returned as normal JSON. runGeneration reports everything else as SSE events.

export type GenerationEvent =
  | { type: "progress"; chars: number }
  | { type: "spec"; spec: Spec }
  | { type: "error"; code: string; message: string };

export type GenerationInput = {
  rawRequest: string;
  turns: Turn[];
};

// A run that has been "generating" longer than this is treated as abandoned (for example, the
// server stopped mid-run), so the user can retry instead of being stuck.
const STALE_GENERATION_MS = 10 * 60_000;

// Checks the interview is finished, then marks the spec as generating. Each LLM request is counted against the spec's call cap.
export async function startGeneration(deps: SpecDeps, owner: Owner, id: string): Promise<GenerationInput> {
  const spec = await findOwnedSpec(deps.db, owner, id);

  if (isLegacySpec(spec)) {
    throw new ApiError(409, "legacy_spec", "This spec was made with the old question flow. It can only be viewed.");
  }
  if (spec.status === "generating") {
    const stale = Date.now() - spec.updatedAt.getTime() > STALE_GENERATION_MS;
    if (!stale) {
      throw new ApiError(409, "already_generating", "This spec is already being generated.");
    }
  } else if (spec.status !== "interview_done" && spec.status !== "done" && spec.status !== "failed") {
    throw new ApiError(409, "invalid_state", "Finish the interview before generating the spec.");
  }

  const input: GenerationInput = { rawRequest: spec.rawRequest, turns: readTurns(spec) };
  await updateSpec(deps.db, owner, id, { status: "generating", errorMessage: null });
  return input;
}

// Runs the LLM call and saves the result. Never throws for generation failures: they are saved
// as status "failed" and sent as an error event. A cancelled run goes back to "interview_done".
export async function runGeneration(
  deps: SpecDeps,
  owner: Owner,
  id: string,
  input: GenerationInput,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const result = await deps.llm.generateJson(SpecSchema, buildSpecMessages(input.rawRequest, input.turns), {
      signal,
      onProgress: (chars) => onEvent({ type: "progress", chars }),
      onRequest: specCallReservation(deps, owner, id),
    });
    await updateSpec(deps.db, owner, id, {
      spec: result.value,
      status: "done",
      errorMessage: null,
      provider: result.provider,
      model: result.model,
      promptVersion: PROMPT_VERSION,
    });
    onEvent({ type: "spec", spec: result.value });
  } catch (error) {
    if (signal?.aborted) {
      await updateSpec(deps.db, owner, id, { status: "interview_done", errorMessage: null });
      return;
    }
    const { code, message } = describeError(error);
    await updateSpec(deps.db, owner, id, { status: "failed", errorMessage: message });
    onEvent({ type: "error", code, message });
  }
}
