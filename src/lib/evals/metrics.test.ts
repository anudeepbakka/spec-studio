import { describe, expect, it } from "vitest";
import type { Turn } from "../schemas/turn";
import { assumptionCoverage, average, followUpRate, storyTaskCoverage, turnInRange, withinCallCap } from "./metrics";

function turn(index: number, question: string, answer: Turn["answer"]): Turn {
  return {
    index,
    question: { id: `Q-${index}`, question, why: "why", type: "text" },
    coverage: {
      usersRoles: "unknown",
      scope: "unknown",
      businessRules: "unknown",
      failureCases: "unknown",
      nonFunctional: "unknown",
      dependencies: "unknown",
    },
    knownFacts: [],
    answer,
    answeredAt: answer ? "2026-10-30T00:00:00.000Z" : null,
  };
}

describe("followUpRate", () => {
  it("counts a later question that reuses a word from an earlier answer", () => {
    const turns = [
      turn(1, "Who can export the report?", { text: "Finance managers only", status: "answered" }),
      turn(2, "Should finance managers see deleted rows?", { text: "No", status: "answered" }),
      turn(3, "What file size limit applies?", { text: "Unsure", status: "answered" }),
    ];
    expect(followUpRate(turns)).toEqual({ checked: 2, followUps: 1, rate: 0.5 });
  });

  it("ignores short words and stop words", () => {
    const turns = [
      turn(1, "Is it fine?", { text: "Users would like this", status: "answered" }),
      turn(2, "Would users like a banner?", { text: "Yes", status: "answered" }),
    ];
    expect(followUpRate(turns).followUps).toBe(0);
  });

  it("does not count skipped answers as something to refer back to", () => {
    const turns = [
      turn(1, "Which browsers matter?", { text: "", status: "skipped" }),
      turn(2, "Which browsers matter most for mobile?", { text: "Chrome", status: "answered" }),
    ];
    expect(followUpRate(turns).followUps).toBe(0);
  });

  it("returns a null rate with fewer than two turns", () => {
    expect(followUpRate([turn(1, "Who?", null)])).toEqual({ checked: 0, followUps: 0, rate: null });
  });
});

describe("assumptionCoverage", () => {
  it("counts skipped and not-sure turns whose topic appears in the summary or open questions", () => {
    const turns = [
      turn(1, "How long should reset links stay valid?", { text: "", status: "skipped" }),
      turn(2, "Which payment provider is used?", { text: "", status: "not_sure" }),
      turn(3, "Who receives the email?", { text: "The account owner", status: "answered" }),
    ];
    const spec = {
      summary: "Reset links are assumed to stay valid for a short time.",
      openQuestions: ["Which payment provider should be used?"],
    };
    expect(assumptionCoverage(turns, spec)).toEqual({ total: 2, covered: 2, rate: 1 });
  });

  it("reports an uncovered assumption", () => {
    const turns = [turn(1, "How many invites can one admin send?", { text: "", status: "skipped" })];
    expect(assumptionCoverage(turns, { summary: "Delivery is by email only.", openQuestions: [] })).toEqual({
      total: 1,
      covered: 0,
      rate: 0,
    });
  });

  it("returns a null rate when no answer was skipped or unsure", () => {
    const turns = [turn(1, "Who?", { text: "Admins", status: "answered" })];
    expect(assumptionCoverage(turns, { summary: "", openQuestions: [] }).rate).toBeNull();
  });
});

describe("turnInRange", () => {
  it("accepts 4 to 8 resolved turns only", () => {
    expect([3, 4, 8, 9].map(turnInRange)).toEqual([false, true, true, false]);
  });
});

describe("withinCallCap", () => {
  it("allows up to the cap", () => {
    expect(withinCallCap(12, 12)).toBe(true);
    expect(withinCallCap(13, 12)).toBe(false);
  });
});

describe("storyTaskCoverage", () => {
  it("is the share of stories referenced by at least one task", () => {
    const stories = [{ id: "US-1" }, { id: "US-2" }, { id: "US-3" }, { id: "US-4" }];
    const tasks = [{ relatedStoryIds: ["US-1", "US-2"] }, { relatedStoryIds: ["US-4"] }];
    expect(storyTaskCoverage(stories, tasks)).toBe(0.75);
  });

  it("returns null with no stories", () => {
    expect(storyTaskCoverage([], [])).toBeNull();
  });
});

describe("average", () => {
  it("averages values and returns null for an empty list", () => {
    expect(average([2, 4, 6])).toBe(4);
    expect(average([])).toBeNull();
  });
});
