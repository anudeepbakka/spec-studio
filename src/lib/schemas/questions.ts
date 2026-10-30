import { z } from "zod";

// SPEC §6: clarifying questions and the user's answers.

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

export const QuestionsResponseSchema = z
  .object({
    questions: z.array(QuestionSchema).min(4).max(8),
  })
  .superRefine((response, ctx) => {
    const seen = new Set<string>();
    response.questions.forEach((question, i) => {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate question ID "${question.id}"`,
          path: ["questions", i, "id"],
        });
      }
      seen.add(question.id);
    });
  });

export const AnswerSchema = z.object({
  questionId: z.string().min(1),
  // An empty string means the question was skipped (SPEC §4).
  answer: z.string().max(1000),
});

export type Question = z.infer<typeof QuestionSchema>;
export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
