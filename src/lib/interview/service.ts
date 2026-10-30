import { ApiError } from "../api/errors";
import type { SpecRow } from "../db/schema";
import { buildInterviewMessages } from "../prompts";
import { interviewTurnResponseSchema, InterviewSchema, type Turn } from "../schemas/turn";
import { chargeSpecStart, findOwnedSpec, isLegacySpec, saveInterview, type SpecDeps } from "../specs/service";
import { specCallReservation } from "../specs/limits";
import {
  applyAnswer,
  canFinishEarly,
  doneAllowed,
  pendingTurn,
  reachedMaximum,
  undoLast,
  withoutPending,
  type AnswerInput,
} from "./machine";

// SPEC §10: the adaptive interview. Each call either returns the pending question, or asks the next one, or says the
// interview is done. Every step saves its state first, so a reload or a failed LLM call loses nothing.

export type InterviewStep = { done: false; turn: Turn } | { done: true; reason: string };

// Reads the stored transcript. A spec with no interview yet (a draft) has an empty one.
export function readTurns(spec: SpecRow): Turn[] {
  return spec.interview ? InterviewSchema.parse(spec.interview) : [];
}

// Interview calls are refused for legacy specs and once generation has started.
function assertOpen(spec: SpecRow): void {
  if (isLegacySpec(spec)) {
    throw new ApiError(409, "legacy_spec", "This spec was made with the old question flow. It can only be viewed.");
  }
  if (spec.status === "generating" || spec.status === "done" || spec.status === "failed") {
    throw new ApiError(409, "invalid_state", "The interview is closed because the spec has been generated.");
  }
}

// Asks the LLM for the next question, or for "done". The caller has already saved the answers.
async function askQuestion(deps: SpecDeps, spec: SpecRow, turns: Turn[], allowDone: boolean): Promise<InterviewStep> {
  const result = await deps.llm.generateJson(
    interviewTurnResponseSchema({ allowDone }),
    buildInterviewMessages({ rawRequest: spec.rawRequest, turns, allowDone }),
    { onRequest: specCallReservation(deps, spec.ownerId, spec.id) },
  );
  const response = result.value;

  if (response.done) {
    await saveInterview(deps, spec.ownerId, spec.id, turns, "interview_done");
    return { done: true, reason: response.reason ?? "The interview is complete." };
  }

  // The schema requires a question when done is false, so this cannot be empty.
  const draft = response.question;
  if (!draft) {
    throw new Error("interview response has no question");
  }
  const index = turns.length + 1;
  const turn: Turn = {
    index,
    question: { id: `Q-${index}`, ...draft },
    coverage: response.coverage,
    knownFacts: response.knownFacts,
    answer: null,
    answeredAt: null,
  };
  const next = [...turns, turn];
  await saveInterview(deps, spec.ownerId, spec.id, next, "interviewing");
  return { done: false, turn };
}

// POST /interview/next. Saves the answer if one is sent, then returns the pending question or asks for the next one.
export async function interviewNext(deps: SpecDeps, ownerId: string, id: string, answer?: AnswerInput): Promise<InterviewStep> {
  const spec = await findOwnedSpec(deps.db, ownerId, id);
  assertOpen(spec);
  let turns = readTurns(spec);

  if (answer) {
    if (spec.status === "interview_done") {
      throw new ApiError(409, "invalid_state", "The interview has ended.");
    }
    turns = applyAnswer(turns, answer, new Date());
    if (reachedMaximum(turns)) {
      await saveInterview(deps, ownerId, id, turns, "interview_done");
      return { done: true, reason: "The interview reached its maximum of 8 questions." };
    }
    await saveInterview(deps, ownerId, id, turns, "interviewing");
    return askQuestion(deps, spec, turns, doneAllowed(turns));
  }

  const pending = pendingTurn(turns);
  if (pending) {
    return { done: false, turn: pending };
  }
  if (spec.status === "interview_done") {
    return { done: true, reason: "The interview is complete." };
  }
  if (spec.status === "draft") {
    // The first question starts the spec. Its status moves first, so a retry after a failed call is not charged again.
    await chargeSpecStart(deps, ownerId);
    await saveInterview(deps, ownerId, id, turns, "interviewing");
  }
  return askQuestion(deps, spec, turns, doneAllowed(turns));
}

// POST /interview/undo. Removes the last answered turn and asks that question again. The re-ask cannot end the interview.
export async function interviewUndo(deps: SpecDeps, ownerId: string, id: string): Promise<InterviewStep> {
  const spec = await findOwnedSpec(deps.db, ownerId, id);
  assertOpen(spec);
  if (spec.status === "draft") {
    throw new ApiError(409, "invalid_state", "There is no answer to undo.");
  }
  const { turns } = undoLast(readTurns(spec));
  await saveInterview(deps, ownerId, id, turns, "interviewing");
  return askQuestion(deps, spec, turns, false);
}

// POST /interview/finish. Ends the interview early once there are enough real answers. Drops any pending question.
export async function interviewFinish(deps: SpecDeps, ownerId: string, id: string): Promise<InterviewStep> {
  const spec = await findOwnedSpec(deps.db, ownerId, id);
  assertOpen(spec);
  if (spec.status === "interview_done") {
    return { done: true, reason: "You finished the interview early." };
  }
  const turns = readTurns(spec);
  if (!canFinishEarly(turns)) {
    throw new ApiError(409, "too_few_answers", "Answer at least 3 questions before finishing early.");
  }
  await saveInterview(deps, ownerId, id, withoutPending(turns), "interview_done");
  return { done: true, reason: "You finished the interview early." };
}
