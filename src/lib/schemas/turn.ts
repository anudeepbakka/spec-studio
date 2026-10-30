import { z } from "zod";
import { QuestionSchema } from "./questions";

// SPEC §6: the adaptive interview. The model returns one question per turn. The server assigns its ID.

// SPEC §10: the most turns a single interview can hold.
export const MAX_INTERVIEW_TURNS = 8;

export const CoverageLevelSchema = z.enum(["unknown", "partial", "covered"]);

export const CoverageSchema = z.object({
  usersRoles: CoverageLevelSchema,
  scope: CoverageLevelSchema,
  businessRules: CoverageLevelSchema,
  failureCases: CoverageLevelSchema,
  nonFunctional: CoverageLevelSchema,
  dependencies: CoverageLevelSchema,
});

export const AnswerStatusSchema = z.enum(["answered", "not_sure", "skipped"]);

const QuestionFields = z.object({
  question: z.string().min(1),
  why: z.string().min(1),
  type: z.enum(["text", "choice"]),
  options: z.array(z.string().min(1)).optional(),
});

// A choice question must say what the choices are. The same rule as the stored question (SPEC §6).
function requireOptionsForChoice(
  question: { type: "text" | "choice"; options?: string[] },
  ctx: z.RefinementCtx,
) {
  if (question.type === "choice" && !question.options?.length) {
    ctx.addIssue({ code: "custom", message: "choice question needs options", path: ["options"] });
  }
}

// What the model returns for a question. It has no ID, because the server assigns one.
export const QuestionDraftSchema = QuestionFields.superRefine(requireOptionsForChoice);

// One stored turn: a question, the coverage and facts returned with it, and the answer once it is given.
// A turn with no answer is pending. Only the last turn can be pending.
export const TurnSchema = z.object({
  index: z.number().int().min(1),
  question: QuestionSchema,
  coverage: CoverageSchema,
  knownFacts: z.array(z.string().min(1)).max(8),
  answer: z
    .object({
      text: z.string().max(1000),
      status: AnswerStatusSchema,
    })
    .nullable(),
  answeredAt: z.string().nullable(),
});

// Checks the whole transcript: indexes count up from 1, question IDs are unique, only the last turn can be pending,
// a skipped answer has no text, and the interview is no longer than MAX_INTERVIEW_TURNS.
export const InterviewSchema = z.array(TurnSchema).superRefine((turns, ctx) => {
  if (turns.length > MAX_INTERVIEW_TURNS) {
    ctx.addIssue({ code: "custom", message: `an interview holds at most ${MAX_INTERVIEW_TURNS} turns` });
  }
  const ids = new Set<string>();
  turns.forEach((turn, i) => {
    if (turn.index !== i + 1) {
      ctx.addIssue({ code: "custom", message: `turn ${i + 1} has index ${turn.index}`, path: [i, "index"] });
    }
    if (ids.has(turn.question.id)) {
      ctx.addIssue({ code: "custom", message: `duplicate question ID "${turn.question.id}"`, path: [i, "question", "id"] });
    }
    ids.add(turn.question.id);
    if (turn.answer === null && i !== turns.length - 1) {
      ctx.addIssue({ code: "custom", message: `turn ${turn.index} is unanswered but not the last turn`, path: [i] });
    }
    if (turn.answer?.status === "skipped" && turn.answer.text !== "") {
      ctx.addIssue({ code: "custom", message: `skipped turn ${turn.index} must not have text`, path: [i, "answer"] });
    }
  });
});

// What the model returns for each interview step (SPEC §6, §9). `allowDone` is false before the minimum
// number of resolved turns and on an undo, so "done" then fails validation and goes through the repair path.
export function interviewTurnResponseSchema(options: { allowDone: boolean }) {
  return z
    .object({
      done: z.boolean(),
      reason: z.string().optional(),
      question: QuestionDraftSchema.optional(),
      coverage: CoverageSchema,
      knownFacts: z.array(z.string().min(1)).max(8),
    })
    .superRefine((response, ctx) => {
      if (response.done) {
        if (response.question) {
          ctx.addIssue({ code: "custom", message: "omit question when done is true", path: ["question"] });
        }
        if (!options.allowDone) {
          ctx.addIssue({
            code: "custom",
            message: "done is not allowed yet: ask the next question",
            path: ["done"],
          });
        }
      } else if (!response.question) {
        ctx.addIssue({ code: "custom", message: "question is required when done is false", path: ["question"] });
      }
    });
}

export type Coverage = z.infer<typeof CoverageSchema>;
export type AnswerStatus = z.infer<typeof AnswerStatusSchema>;
export type QuestionDraft = z.infer<typeof QuestionDraftSchema>;
export type Turn = z.infer<typeof TurnSchema>;
export type InterviewTurnResponse = z.infer<ReturnType<typeof interviewTurnResponseSchema>>;
