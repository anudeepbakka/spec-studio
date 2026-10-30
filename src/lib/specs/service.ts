import { ApiError } from "../api/errors";
import { createSpec, deleteSpec, getSpec, listSpecs, reserveLlmRun, updateSpec, type Db } from "../db/repo";
import type { SpecRow } from "../db/schema";
import type { LLMClient } from "../llm/client";
import { buildQuestionsMessages, PROMPT_VERSION } from "../prompts";
import { z } from "zod";
import { QuestionSchema, QuestionsResponseSchema, type Answer, type Question } from "../schemas/questions";

// SPEC §10: the spec steps before generation (draft, questions, answers).
// Each function takes the owner ID, so every read and write is scoped to that owner.

export type SpecDeps = { db: Db; llm: LLMClient; dailyLimit: number };

// The UTC calendar day used for the daily limit (SPEC §10).
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Counts one LLM run against the owner's daily limit. Called before any provider is contacted,
// so a request over the limit never costs a provider call (AC-7).
export async function chargeLlmRun(deps: SpecDeps, ownerId: string): Promise<void> {
  const allowed = await reserveLlmRun(deps.db, ownerId, utcDay(new Date()), deps.dailyLimit);
  if (!allowed) {
    throw new ApiError(
      429,
      "daily_limit",
      `You have used all ${deps.dailyLimit} AI runs for today. The limit resets at 00:00 UTC.`,
    );
  }
}

export async function findOwnedSpec(db: Db, ownerId: string, id: string): Promise<SpecRow> {
  const spec = await getSpec(db, ownerId, id);
  if (!spec) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return spec;
}

// Lists the owner's specs, newest first (SPEC §10).
export async function listOwnedSpecs(deps: SpecDeps, ownerId: string) {
  return listSpecs(deps.db, ownerId);
}

// Deletes one of the owner's specs. Another owner's ID gets the same 404 as a missing one.
export async function deleteOwnedSpec(deps: SpecDeps, ownerId: string, id: string): Promise<void> {
  const deleted = await deleteSpec(deps.db, ownerId, id);
  if (!deleted) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
}

export async function createDraft(deps: SpecDeps, ownerId: string, rawRequest: string) {
  const row = await createSpec(deps.db, ownerId, rawRequest);
  return { id: row.id };
}

// Generates 4 to 8 clarifying questions. This is an LLM run. Existing answers are cleared,
// because they were written for the previous questions.
export async function generateQuestions(deps: SpecDeps, ownerId: string, id: string) {
  const spec = await findOwnedSpec(deps.db, ownerId, id);
  if (spec.status !== "draft" && spec.status !== "questions_ready") {
    throw new ApiError(409, "invalid_state", "Questions cannot be regenerated once answers are saved.");
  }

  await chargeLlmRun(deps, ownerId);

  const result = await deps.llm.generateJson(
    QuestionsResponseSchema,
    buildQuestionsMessages(spec.rawRequest),
  );
  const questions = result.value.questions;

  const updated = await updateSpec(deps.db, ownerId, id, {
    questions,
    answers: null,
    status: "questions_ready",
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
  });
  if (!updated) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return { id, status: "questions_ready" as const, questions };
}

// Saves the user's answers. Any question may be left out or sent as "" (skipped).
export async function saveAnswers(deps: SpecDeps, ownerId: string, id: string, answers: Answer[]) {
  const spec = await findOwnedSpec(deps.db, ownerId, id);
  if (spec.status !== "questions_ready" && spec.status !== "answered") {
    throw new ApiError(409, "invalid_state", "Questions must be generated before they can be answered.");
  }

  // Questions were validated when they were saved, so the stored JSON is parsed again here.
  const questions: Question[] = z.array(QuestionSchema).parse(spec.questions);
  const known = new Set(questions.map((question) => question.id));
  const seen = new Set<string>();
  for (const answer of answers) {
    if (!known.has(answer.questionId)) {
      throw new ApiError(400, "unknown_question", `Unknown question ID "${answer.questionId}".`);
    }
    if (seen.has(answer.questionId)) {
      throw new ApiError(400, "duplicate_answer", `Question "${answer.questionId}" is answered more than once.`);
    }
    seen.add(answer.questionId);
  }

  const updated = await updateSpec(deps.db, ownerId, id, { answers, status: "answered" });
  if (!updated) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return { id, status: "answered" as const };
}
