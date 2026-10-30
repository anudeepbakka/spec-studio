import type { Turn } from "../schemas/turn";

// Writes every resolved turn with its answer. Skipped and "not sure" answers are labelled, so the model treats them as assumptions.
export function formatTranscript(turns: Turn[]): string {
  const resolved = turns.filter((turn) => turn.answer !== null);
  if (resolved.length === 0) return "(no questions answered yet)";
  return resolved
    .map((turn) => {
      const answer = turn.answer;
      const text =
        answer?.status === "skipped"
          ? "skipped (treat as an assumption)"
          : answer?.status === "not_sure"
            ? `not sure: ${answer.text || "(no detail)"} (treat as an open question)`
            : (answer?.text ?? "");
      return `- ${turn.question.id} ${turn.question.question}\n  Answer: ${text}`;
    })
    .join("\n");
}
