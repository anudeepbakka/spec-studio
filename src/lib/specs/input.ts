import { z } from "zod";
import { AnswerSchema } from "../schemas/questions";

// SPEC §10: input limits. Messages are shown to the user as they are.

export const CreateSpecInputSchema = z.object({
  rawRequest: z
    .string({ message: "Describe the feature request in text." })
    .min(20, "Describe the request in at least 20 characters.")
    .max(4000, "Keep the request under 4000 characters."),
});

export const SaveAnswersInputSchema = z.object({
  answers: z.array(AnswerSchema).max(8, "Too many answers. Send at most 8."),
});

export type CreateSpecInput = z.infer<typeof CreateSpecInputSchema>;
export type SaveAnswersInput = z.infer<typeof SaveAnswersInputSchema>;
