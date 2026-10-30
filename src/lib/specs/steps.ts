import type { SpecStatus } from "./view";

// SPEC §4 and §11: the four wizard steps. The step follows the saved status, so a reload lands on the right step.
export type Step = "request" | "questions" | "generate" | "result";

export function stepFor(status: SpecStatus): Step {
  switch (status) {
    case "draft":
      return "request";
    case "questions_ready":
      return "questions";
    case "answered":
    case "generating":
    case "failed":
      return "generate";
    case "done":
      return "result";
  }
}

// Labels for the stepper and status badge. Plain words, so the UI never shows a raw enum value.
export const STEP_LABELS: Record<Step, string> = {
  request: "Request",
  questions: "Questions",
  generate: "Generate",
  result: "Result",
};

export const STATUS_LABELS: Record<SpecStatus, string> = {
  draft: "Draft",
  questions_ready: "Questions ready",
  answered: "Answers saved",
  generating: "Generating",
  done: "Done",
  failed: "Failed",
};
