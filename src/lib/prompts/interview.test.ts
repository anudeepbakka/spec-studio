import { describe, expect, it } from "vitest";
import { makeTurn } from "../../test/interview-fixtures";
import { buildInterviewMessages, buildSpecMessages } from "./index";

const REQUEST = "Let admins export order history as CSV.";

describe("buildInterviewMessages", () => {
  it("includes the full transcript, with skipped and not-sure answers labelled", () => {
    const turns = [
      makeTurn(1, { text: "Admins only", status: "answered" }),
      makeTurn(2, { text: "", status: "skipped" }),
      makeTurn(3, { text: "Maybe weekly", status: "not_sure" }),
      makeTurn(4),
    ];
    const [, user] = buildInterviewMessages({ rawRequest: REQUEST, turns, allowDone: true });
    expect(user?.content).toContain("Q-1 Question 1?\n  Answer: Admins only");
    expect(user?.content).toContain("Q-2 Question 2?\n  Answer: skipped (treat as an assumption)");
    expect(user?.content).toContain("not sure: Maybe weekly (treat as an open question)");
    expect(user?.content).not.toContain("Question 4?");
  });

  it("tells the model not to finish before the minimum", () => {
    const turns = [makeTurn(1)];
    const [, user] = buildInterviewMessages({ rawRequest: REQUEST, turns, allowDone: false });
    expect(user?.content).toContain("Do not set done to true. Ask the next question.");
  });

  it("says nothing has been answered when the transcript is empty", () => {
    const [, user] = buildInterviewMessages({ rawRequest: REQUEST, turns: [], allowDone: false });
    expect(user?.content).toContain("(no questions answered yet)");
  });
});

describe("buildSpecMessages", () => {
  it("builds the spec prompt from the full transcript too", () => {
    const turns = [makeTurn(1, { text: "Admins only", status: "answered" }), makeTurn(2, { text: "", status: "skipped" })];
    const [, user] = buildSpecMessages(REQUEST, turns);
    expect(user?.content).toContain("Admins only");
    expect(user?.content).toContain("skipped (treat as an assumption)");
  });
});
