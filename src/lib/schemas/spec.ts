import { z } from "zod";
import { findSpecIntegrityIssues } from "./integrity";

// SPEC §6: the generated spec. IDs follow the fixed formats below.
// Integrity rules (references, cycles, coverage) live in ./integrity.ts.

const storyId = z.string().regex(/^US-\d+$/, "expected an ID like US-1");
const criterionId = z.string().regex(/^AC-\d+\.\d+$/, "expected an ID like AC-1.1");
const edgeCaseId = z.string().regex(/^EC-\d+$/, "expected an ID like EC-1");
const taskId = z.string().regex(/^T-\d+$/, "expected an ID like T-1");

export const AcceptanceCriterionSchema = z.object({
  id: criterionId,
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

export const UserStorySchema = z.object({
  id: storyId,
  role: z.string().min(1),
  want: z.string().min(1),
  benefit: z.string().min(1),
  priority: z.enum(["must", "should", "could"]),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(2),
});

export const EdgeCaseSchema = z.object({
  id: edgeCaseId,
  scenario: z.string().min(1),
  expectedBehavior: z.string().min(1),
  relatedStoryIds: z.array(storyId),
});

export const TaskSchema = z.object({
  id: taskId,
  title: z.string().min(1),
  description: z.string().min(1),
  dependsOn: z.array(taskId),
  relatedStoryIds: z.array(storyId),
  estimate: z.enum(["S", "M", "L"]),
});

export const SpecSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    goals: z.array(z.string().min(1)).min(2).max(5),
    userStories: z.array(UserStorySchema).min(3).max(8),
    edgeCases: z.array(EdgeCaseSchema).min(3),
    openQuestions: z.array(z.string().min(1)),
    tasks: z.array(TaskSchema).min(5).max(15),
  })
  .superRefine((spec, ctx) => {
    for (const issue of findSpecIntegrityIssues(spec)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type UserStory = z.infer<typeof UserStorySchema>;
export type EdgeCase = z.infer<typeof EdgeCaseSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Spec = z.infer<typeof SpecSchema>;
