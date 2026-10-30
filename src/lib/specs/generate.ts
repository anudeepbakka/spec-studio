import { z } from "zod";
import { ApiError, describeError } from "../api/errors";
import { updateSpec } from "../db/repo";
import { buildSpecMessages, PROMPT_VERSION } from "../prompts";
import { AnswerSchema, QuestionSchema, type Answer, type Question } from "../schemas/questions";
import { SpecSchema, type Spec } from "../schemas/spec";
import { chargeLlmRun, findOwnedSpec, type SpecDeps } from "./service";

// SPEC §10: spec generation. startGeneration runs before the SSE stream opens, so its errors
// can still be returned as normal JSON. runGeneration reports everything else as SSE events.

export type GenerationEvent =
  | { type: "progress"; chars: number }
  | { type: "spec"; spec: Spec }
  | { type: "error"; code: string; message: string };

export type GenerationInput = {
  rawRequest: string;
  questions: Question[];
  answers: Answer[];
};

// A run that has been "generating" longer than this is treated as abandoned (for example, the
// server stopped mid-run), so the user can retry instead of being stuck.
const STALE_GENERATION_MS = 10 * 60_000;

// Checks the spec can be generated, charges one run, and marks it as generating.
export async function startGeneration(deps: SpecDeps, ownerId: string, id: string): Promise<GenerationInput> {
  const spec = await findOwnedSpec(deps.db, ownerId, id);

  if (spec.status === "generating") {
    const stale = Date.now() - spec.updatedAt.getTime() > STALE_GENERATION_MS;
    if (!stale) {
      throw new ApiError(409, "already_generating", "This spec is already being generated.");
    }
  } else if (spec.status !== "answered" && spec.status !== "done" && spec.status !== "failed") {
    throw new ApiError(409, "invalid_state", "Answer the questions before generating the spec.");
  }
  if (!spec.questions || !spec.answers) {
    throw new ApiError(409, "invalid_state", "Answer the questions before generating the spec.");
  }

  const input: GenerationInput = {
    rawRequest: spec.rawRequest,
    questions: z.array(QuestionSchema).parse(spec.questions),
    answers: z.array(AnswerSchema).parse(spec.answers),
  };

  await chargeLlmRun(deps, ownerId);
  await updateSpec(deps.db, ownerId, id, { status: "generating", errorMessage: null });
  return input;
}

// Runs the LLM call and saves the result. Never throws for generation failures: they are saved
// as status "failed" and sent as an error event. A cancelled run goes back to "answered".
export async function runGeneration(
  deps: SpecDeps,
  ownerId: string,
  id: string,
  input: GenerationInput,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const result = await deps.llm.generateJson(SpecSchema, buildSpecMessages(input.rawRequest, input.questions, input.answers), {
      signal,
      onProgress: (chars) => onEvent({ type: "progress", chars }),
    });
    await updateSpec(deps.db, ownerId, id, {
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
      await updateSpec(deps.db, ownerId, id, { status: "answered", errorMessage: null });
      return;
    }
    const { code, message } = describeError(error);
    await updateSpec(deps.db, ownerId, id, { status: "failed", errorMessage: message });
    onEvent({ type: "error", code, message });
  }
}
