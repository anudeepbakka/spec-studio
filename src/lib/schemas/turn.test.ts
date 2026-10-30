import { describe, expect, it } from "vitest";
import { COVERAGE, makeTurn } from "../../test/interview-fixtures";
import { interviewTurnResponseSchema, InterviewSchema, TurnSchema } from "./turn";

function messages(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe("TurnSchema", () => {
  it("accepts a pending turn and an answered turn", () => {
    expect(TurnSchema.safeParse(makeTurn(1)).success).toBe(true);
    expect(TurnSchema.safeParse(makeTurn(1, { text: "Admins", status: "answered" })).success).toBe(true);
  });

  it("rejects a choice question without options", () => {
    const turn = makeTurn(1);
    const result = TurnSchema.safeParse({ ...turn, question: { ...turn.question, type: "choice" } });
    expect(result.success).toBe(false);
  });
});

describe("InterviewSchema integrity", () => {
  it("accepts a transcript with indexes 1..n, unique IDs, and a pending last turn", () => {
    const turns = [makeTurn(1, { text: "a", status: "answered" }), makeTurn(2)];
    expect(InterviewSchema.safeParse(turns).success).toBe(true);
  });

  it("rejects a gap in indexes", () => {
    const turns = [makeTurn(1, { text: "a", status: "answered" }), makeTurn(3)];
    expect(messages(InterviewSchema.safeParse(turns))).toContain("turn 2 has index 3");
  });

  it("rejects a duplicate question ID", () => {
    const first = makeTurn(1, { text: "a", status: "answered" });
    const second = { ...makeTurn(2), question: { ...makeTurn(2).question, id: "Q-1" } };
    expect(messages(InterviewSchema.safeParse([first, second]))).toContain('duplicate question ID "Q-1"');
  });

  it("rejects an unanswered turn that is not the last one", () => {
    const turns = [makeTurn(1), makeTurn(2, { text: "a", status: "answered" })];
    expect(messages(InterviewSchema.safeParse(turns))).toContain("turn 1 is unanswered but not the last turn");
  });

  it("rejects text on a skipped answer", () => {
    const turns = [makeTurn(1, { text: "should be empty", status: "skipped" })];
    expect(messages(InterviewSchema.safeParse(turns))).toContain("skipped turn 1 must not have text");
  });

  it("rejects more than eight turns", () => {
    const turns = Array.from({ length: 9 }, (_, i) => makeTurn(i + 1, { text: "a", status: "answered" }));
    expect(messages(InterviewSchema.safeParse(turns))).toContain("an interview holds at most 8 turns");
  });
});

describe("interviewTurnResponseSchema", () => {
  const question = { question: "Who can export?", why: "Access rules", type: "text" };

  it("accepts a question with coverage and known facts", () => {
    const result = interviewTurnResponseSchema({ allowDone: false }).safeParse({
      done: false,
      question,
      coverage: COVERAGE,
      knownFacts: ["Exports are CSV"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects done before the minimum, which sends the model through repair", () => {
    const result = interviewTurnResponseSchema({ allowDone: false }).safeParse({
      done: true,
      coverage: COVERAGE,
      knownFacts: [],
    });
    expect(messages(result)).toContain("done is not allowed yet: ask the next question");
  });

  it("accepts done when allowed, without a question", () => {
    expect(
      interviewTurnResponseSchema({ allowDone: true }).safeParse({ done: true, coverage: COVERAGE, knownFacts: [] }).success,
    ).toBe(true);
  });

  it("rejects done with a question, and a question missing when done is false", () => {
    const schema = interviewTurnResponseSchema({ allowDone: true });
    expect(messages(schema.safeParse({ done: true, question, coverage: COVERAGE, knownFacts: [] }))).toContain(
      "omit question when done is true",
    );
    expect(messages(schema.safeParse({ done: false, coverage: COVERAGE, knownFacts: [] }))).toContain(
      "question is required when done is false",
    );
  });

  it("rejects more than eight known facts", () => {
    const result = interviewTurnResponseSchema({ allowDone: false }).safeParse({
      done: false,
      question,
      coverage: COVERAGE,
      knownFacts: Array.from({ length: 9 }, (_, i) => `fact ${i}`),
    });
    expect(result.success).toBe(false);
  });
});
