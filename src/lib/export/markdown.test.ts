import { describe, expect, it } from "vitest";
import { sampleSpec } from "@/test/sample-spec";
import { toMarkdown } from "./markdown";

describe("toMarkdown", () => {
  it("matches the snapshot for a valid spec", () => {
    expect(toMarkdown(sampleSpec)).toMatchSnapshot();
  });

  it("ends with the generated-with footer", () => {
    expect(toMarkdown(sampleSpec).trimEnd().endsWith("Generated with Spec Studio")).toBe(true);
  });

  it("writes None when there are no open questions", () => {
    const markdown = toMarkdown({ ...sampleSpec, openQuestions: [] });
    expect(markdown).toContain("## Open questions\n- None\n");
  });

  it("escapes pipes and keeps table cells on one line", () => {
    const markdown = toMarkdown({
      ...sampleSpec,
      tasks: sampleSpec.tasks.map((task, i) =>
        i === 0 ? { ...task, title: "Store a | b\nin two lines" } : task,
      ),
    });
    expect(markdown).toContain("| T-1 | Store a \\| b in two lines |");
  });
});
