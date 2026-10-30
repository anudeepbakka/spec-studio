import type { SpecStatus, SpecView } from "./view";

// SPEC §4 and §11: the four wizard steps. The step follows the saved status, so a reload lands on the right step.
export type Step = "request" | "interview" | "generate" | "result";

export function stepFor(status: SpecStatus): Step {
  switch (status) {
    case "draft":
      return "request";
    case "interviewing":
    case "questions_ready":
      return "interview";
    case "interview_done":
    case "answered":
    case "generating":
    case "failed":
      return "generate";
    case "done":
      return "result";
  }
}

// A spec from the v1 question flow. It has no interview, so it can only be read (SPEC §10).
export function isLegacyView(spec: Pick<SpecView, "interview" | "status">): boolean {
  return spec.interview === null && spec.status !== "draft";
}

// Labels for the stepper and status badge. Plain words, so the UI never shows a raw enum value.
export const STEP_LABELS: Record<Step, string> = {
  request: "Request",
  interview: "Interview",
  generate: "Generate",
  result: "Result",
};

export const STATUS_LABELS: Record<SpecStatus, string> = {
  draft: "Draft",
  interviewing: "Interview in progress",
  interview_done: "Ready to generate",
  generating: "Generating",
  done: "Done",
  failed: "Failed",
  questions_ready: "Old question flow",
  answered: "Old question flow",
};
