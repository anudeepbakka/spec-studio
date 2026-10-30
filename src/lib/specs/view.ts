import { z } from "zod";
import type { SpecRow } from "../db/schema";
import { AnswerSchema, QuestionSchema, type Answer, type Question } from "../schemas/questions";
import { SpecSchema, type Spec } from "../schemas/spec";

// The spec record as the browser sees it. Stored JSON is parsed back through Zod, so the UI gets typed data.
export type SpecStatus = SpecRow["status"];

export type SpecView = {
  id: string;
  title: string;
  status: SpecStatus;
  rawRequest: string;
  questions: Question[] | null;
  answers: Answer[] | null;
  spec: Spec | null;
  errorMessage: string | null;
  createdAt: string;
};

export function toSpecView(row: SpecRow): SpecView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    rawRequest: row.rawRequest,
    questions: row.questions ? z.array(QuestionSchema).parse(row.questions) : null,
    answers: row.answers ? z.array(AnswerSchema).parse(row.answers) : null,
    spec: row.spec ? SpecSchema.parse(row.spec) : null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}
