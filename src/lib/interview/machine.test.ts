import { describe, expect, it } from "vitest";
import { makeTurn } from "../../test/interview-fixtures";
import {
  applyAnswer,
  canFinishEarly,
  doneAllowed,
  pendingTurn,
  reachedMaximum,
  undoLast,
  withoutPending,
} from "./machine";

const NOW = new Date("2026-10-30T10:00:00.000Z");

describe("interview rules", () => {
  it("allows done only after four resolved turns", () => {
    const three = [1, 2, 3].map((i) => makeTurn(i, { text: "x", status: "answered" }));
    expect(doneAllowed(three)).toBe(false);
    expect(doneAllowed([...three, makeTurn(4, { text: "x", status: "skipped" })])).toBe(true);
  });

  it("reaches the maximum at eight resolved turns, not before", () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((i) => makeTurn(i, { text: "x", status: "answered" }));
    expect(reachedMaximum(seven)).toBe(false);
    expect(reachedMaximum([...seven, makeTurn(8, { text: "x", status: "answered" })])).toBe(true);
  });

  it("finishes early only with three real answers, not skipped or not-sure ones", () => {
    const twoReal = [
      makeTurn(1, { text: "a", status: "answered" }),
      makeTurn(2, { text: "b", status: "answered" }),
      makeTurn(3, { text: "", status: "skipped" }),
      makeTurn(4, { text: "maybe", status: "not_sure" }),
    ];
    expect(canFinishEarly(twoReal)).toBe(false);
    expect(canFinishEarly([...twoReal, makeTurn(5, { text: "c", status: "answered" })])).toBe(true);
  });

  it("finds the pending turn, which is always the last one", () => {
    const turns = [makeTurn(1, { text: "a", status: "answered" }), makeTurn(2)];
    expect(pendingTurn(turns)?.index).toBe(2);
    expect(pendingTurn([makeTurn(1, { text: "a", status: "answered" })])).toBeNull();
  });
});

describe("applyAnswer", () => {
  it("records an answer on the pending question", () => {
    const turns = [makeTurn(1)];
    const next = applyAnswer(turns, { questionId: "Q-1", answer: "  Admins only  " }, NOW);
    expect(next[0]?.answer).toEqual({ text: "Admins only", status: "answered" });
    expect(next[0]?.answeredAt).toBe(NOW.toISOString());
  });

  it("drops the text of a skipped answer and keeps the text of a not-sure answer", () => {
    const skipped = applyAnswer([makeTurn(1)], { questionId: "Q-1", answer: "ignored", skipped: true }, NOW);
    expect(skipped[0]?.answer).toEqual({ text: "", status: "skipped" });
    const unsure = applyAnswer([makeTurn(1)], { questionId: "Q-1", answer: "maybe", notSure: true }, NOW);
    expect(unsure[0]?.answer).toEqual({ text: "maybe", status: "not_sure" });
  });

  it("refuses an answer with no open question", () => {
    expect(() => applyAnswer([makeTurn(1, { text: "a", status: "answered" })], { questionId: "Q-1", answer: "b" }, NOW)).toThrow(
      "no open question",
    );
  });

  it("refuses an answer for a question that is no longer current", () => {
    expect(() => applyAnswer([makeTurn(1)], { questionId: "Q-9", answer: "b" }, NOW)).toThrow("no longer current");
  });

  it("refuses an empty text answer, and skip and not-sure together", () => {
    expect(() => applyAnswer([makeTurn(1)], { questionId: "Q-1", answer: "   " }, NOW)).toThrow("Type an answer");
    expect(() => applyAnswer([makeTurn(1)], { questionId: "Q-1", answer: "x", skipped: true, notSure: true }, NOW)).toThrow(
      "both skipped and not sure",
    );
  });
});

describe("undoLast and withoutPending", () => {
  it("removes the last resolved turn and any pending turn after it, and asks for that index again", () => {
    const turns = [makeTurn(1, { text: "a", status: "answered" }), makeTurn(2, { text: "b", status: "answered" }), makeTurn(3)];
    const result = undoLast(turns);
    expect(result.turns.map((turn) => turn.index)).toEqual([1]);
    expect(result.reaskIndex).toBe(2);
  });

  it("refuses undo when nothing has been answered", () => {
    expect(() => undoLast([makeTurn(1)])).toThrow("no answer to undo");
  });

  it("drops the pending question on finish", () => {
    const turns = [makeTurn(1, { text: "a", status: "answered" }), makeTurn(2)];
    expect(withoutPending(turns).map((turn) => turn.index)).toEqual([1]);
  });
});
