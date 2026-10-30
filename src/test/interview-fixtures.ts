import type { Coverage, Turn } from "@/lib/schemas/turn";

// Shared test data for the interview. Generic examples only, no real company data.
export const COVERAGE: Coverage = {
  usersRoles: "unknown",
  scope: "unknown",
  businessRules: "unknown",
  failureCases: "unknown",
  nonFunctional: "unknown",
  dependencies: "unknown",
};

// A model reply that asks one question.
export function questionReply(text: string, type: "text" | "choice" = "text"): string {
  const question = type === "choice" ? { question: text, why: "Scope", type, options: ["Yes", "No"] } : { question: text, why: "Scope", type };
  return JSON.stringify({ done: false, question, coverage: COVERAGE, knownFacts: ["Feature is about exports"] });
}

// A model reply that ends the interview.
export const DONE_REPLY = JSON.stringify({ done: true, reason: "Enough detail", coverage: COVERAGE, knownFacts: [] });

// Builds a stored turn. Pass an answer to make it resolved.
export function makeTurn(index: number, answer: Turn["answer"] = null): Turn {
  return {
    index,
    question: { id: `Q-${index}`, question: `Question ${index}?`, why: "Scope", type: "text" },
    coverage: COVERAGE,
    knownFacts: [],
    answer,
    answeredAt: answer ? "2026-10-30T10:00:00.000Z" : null,
  };
}
