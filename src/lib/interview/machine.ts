import { ApiError } from "../api/errors";
import { MAX_INTERVIEW_TURNS, type AnswerStatus, type Turn } from "../schemas/turn";

// SPEC §10: the interview rules as pure functions. No database and no LLM here, so every rule is testable on its own.

// The model may say "done" only after this many resolved turns.
export const MIN_RESOLVED_TO_FINISH = 4;

// Finish early needs this many turns with a real answer (not skipped, not "not sure").
export const MIN_REAL_ANSWERS_TO_FINISH = 3;

export type AnswerInput = {
  questionId: string;
  answer: string;
  skipped?: boolean;
  notSure?: boolean;
};

export function resolvedTurns(turns: Turn[]): Turn[] {
  return turns.filter((turn) => turn.answer !== null);
}

// The unanswered question, if there is one. At most one turn can be pending, and it is always the last.
export function pendingTurn(turns: Turn[]): Turn | null {
  const last = turns.at(-1);
  return last && last.answer === null ? last : null;
}

export function realAnswerCount(turns: Turn[]): number {
  return turns.filter((turn) => turn.answer?.status === "answered").length;
}

// True when the model may end the interview, by its own judgement (SPEC §9).
export function doneAllowed(turns: Turn[]): boolean {
  return resolvedTurns(turns).length >= MIN_RESOLVED_TO_FINISH;
}

// True when the interview has reached its maximum and must end without asking again (SPEC §10).
export function reachedMaximum(turns: Turn[]): boolean {
  return resolvedTurns(turns).length >= MAX_INTERVIEW_TURNS;
}

export function canFinishEarly(turns: Turn[]): boolean {
  return realAnswerCount(turns) >= MIN_REAL_ANSWERS_TO_FINISH;
}

export function answerStatus(input: AnswerInput): AnswerStatus {
  if (input.skipped && input.notSure) {
    throw new ApiError(400, "invalid_input", "An answer cannot be both skipped and not sure.");
  }
  if (input.skipped) return "skipped";
  if (input.notSure) return "not_sure";
  return "answered";
}

// Records an answer for the pending question. Skipped answers keep no text.
export function applyAnswer(turns: Turn[], input: AnswerInput, at: Date): Turn[] {
  const pending = pendingTurn(turns);
  if (!pending) {
    throw new ApiError(409, "invalid_state", "There is no open question to answer.");
  }
  if (pending.question.id !== input.questionId) {
    throw new ApiError(409, "invalid_state", "That question is no longer current. Reload to continue.");
  }
  const status = answerStatus(input);
  const text = status === "skipped" ? "" : input.answer.trim();
  if (status === "answered" && text === "") {
    throw new ApiError(400, "invalid_input", "Type an answer, or skip the question.");
  }
  return turns.map((turn) =>
    turn.index === pending.index ? { ...turn, answer: { text, status }, answeredAt: at.toISOString() } : turn,
  );
}

// Removes the last resolved turn and anything after it. The removed question is asked again, so the caller
// generates a new question for the returned index.
export function undoLast(turns: Turn[]): { turns: Turn[]; reaskIndex: number } {
  let lastResolved = -1;
  turns.forEach((turn, i) => {
    if (turn.answer !== null) lastResolved = i;
  });
  if (lastResolved === -1) {
    throw new ApiError(409, "invalid_state", "There is no answer to undo.");
  }
  return { turns: turns.slice(0, lastResolved), reaskIndex: lastResolved + 1 };
}

// Drops the pending question, if there is one. Used when the user finishes early.
export function withoutPending(turns: Turn[]): Turn[] {
  return resolvedTurns(turns);
}
