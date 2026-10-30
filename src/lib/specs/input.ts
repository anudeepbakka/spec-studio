import { z } from "zod";

// SPEC §10: input limits. Messages are shown to the user as they are.

export const CreateSpecInputSchema = z.object({
  rawRequest: z
    .string({ message: "Describe the feature request in text." })
    .min(20, "Describe the request in at least 20 characters.")
    .max(4000, "Keep the request under 4000 characters."),
});

// The answer to the pending question. Skipped and "not sure" are flags, so the text is ignored when skipped.
export const InterviewAnswerInputSchema = z.object({
  answer: z
    .object({
      questionId: z.string().min(1, "Say which question this answer is for."),
      answer: z.string().max(1000, "Keep each answer under 1000 characters."),
      skipped: z.boolean().optional(),
      notSure: z.boolean().optional(),
    })
    .optional(),
});

export type CreateSpecInput = z.infer<typeof CreateSpecInputSchema>;
export type InterviewAnswerInput = z.infer<typeof InterviewAnswerInputSchema>;
