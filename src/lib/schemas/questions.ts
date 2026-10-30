import { z } from "zod";

// SPEC §6: a stored question and an answer. Turns (schemas/turn.ts) are the adaptive interview.
// QuestionSchema is also the shape of questions in legacy specs (SPEC §10), which are read-only.

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    why: z.string().min(1),
    type: z.enum(["text", "choice"]),
    options: z.array(z.string().min(1)).optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "choice" && !question.options?.length) {
      ctx.addIssue({
        code: "custom",
        message: `choice question ${question.id} needs options`,
        path: ["options"],
      });
    }
  });

export const AnswerSchema = z.object({
  questionId: z.string().min(1),
  // An empty string means the question was skipped (SPEC §4).
  answer: z.string().max(1000),
});

export type Question = z.infer<typeof QuestionSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
