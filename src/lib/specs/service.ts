import { ApiError } from "../api/errors";
import { createSpec, getSpec, updateSpec, type Db } from "../db/repo";
import type { SpecRow } from "../db/schema";
import type { LLMClient } from "../llm/client";
import { buildQuestionsMessages, PROMPT_VERSION } from "../prompts";
import { z } from "zod";
import { QuestionSchema, QuestionsResponseSchema, type Answer, type Question } from "../schemas/questions";

// SPEC §10: the spec steps before generation (draft, questions, answers).
// Each function takes the owner ID, so every read and write is scoped to that owner.

export type SpecDeps = { db: Db; llm: LLMClient };

async function findOwnedSpec(db: Db, ownerId: string, id: string): Promise<SpecRow> {
  const spec = await getSpec(db, ownerId, id);
  if (!spec) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return spec;
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
