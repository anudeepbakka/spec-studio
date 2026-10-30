import { describe, expect, it } from "vitest";
import { sampleSpec } from "@/test/sample-spec";
import { QuestionsResponseSchema, type Question } from "./questions";
import { SpecSchema, type Spec } from "./spec";

// Returns every error message from a failed parse, or [] if the input is valid.
function errorsFor(input: unknown): string[] {
  const result = SpecSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function withSpec(mutate: (spec: Spec) => void): Spec {
  const spec = structuredClone(sampleSpec);
  mutate(spec);
  return spec;
}

describe("SpecSchema", () => {
  it("accepts a valid spec", () => {
    expect(errorsFor(sampleSpec)).toEqual([]);
  });

  it("rejects duplicate user story IDs", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.userStories[1].id = "US-1";
    }));
    expect(errors).toContain('duplicate user story ID "US-1"');
  });

  it("rejects duplicate task IDs", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.tasks[1].id = "T-1";
    }));
    expect(errors).toContain('duplicate task ID "T-1"');
  });

  it("rejects a dependsOn that points at an unknown task", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.tasks[2].dependsOn = ["T-9"];
    }));
    expect(errors).toContain('unknown task "T-9" referenced');
  });

  it("rejects a relatedStoryIds entry that points at an unknown story", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.edgeCases[0].relatedStoryIds = ["US-9"];
    }));
    expect(errors).toContain('unknown user story "US-9" referenced');
  });

  it("rejects a task that depends on itself", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.tasks[0].dependsOn = ["T-1"];
    }));
    expect(errors).toContain('task "T-1" depends on itself');
  });

  it("rejects a dependency cycle and names the cycle", () => {
    const errors = errorsFor(withSpec((spec) => {
      // T-1 depends on T-3, and T-3 -> T-2 -> T-1 already exists ("depends on" edges)
      spec.tasks[0].dependsOn = ["T-3"];
    }));
    expect(errors).toContain("dependency cycle: T-1 -> T-3 -> T-2 -> T-1");
  });

  it("rejects a user story that no task covers", () => {
    const errors = errorsFor(withSpec((spec) => {
      for (const task of spec.tasks) {
        task.relatedStoryIds = task.relatedStoryIds.filter((id) => id !== "US-3");
      }
    }));
    expect(errors).toContain('user story "US-3" is not covered by any task');
  });

  it("rejects a user story with fewer than two acceptance criteria", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.userStories[0].acceptanceCriteria.pop();
    }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects fewer than three edge cases", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.edgeCases.pop();
    }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an ID that does not match the fixed format", () => {
    const errors = errorsFor(withSpec((spec) => {
      spec.userStories[0].acceptanceCriteria[0].id = "AC-1";
    }));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("QuestionsResponseSchema", () => {
  const question = (id: string, type: Question["type"] = "text", options?: string[]): Question => ({
    id,
    question: "Who uses this?",
    why: "Roles decide the permissions.",
    type,
    options,
  });

  it("accepts four to eight questions with unique IDs", () => {
    const questions = ["Q1", "Q2", "Q3", "Q4"].map((id) => question(id));
    expect(QuestionsResponseSchema.safeParse({ questions }).success).toBe(true);
  });

  it("rejects a choice question without options", () => {
    const questions = [
      question("Q1", "choice"),
      question("Q2"),
      question("Q3"),
      question("Q4"),
    ];
    const result = QuestionsResponseSchema.safeParse({ questions });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate question IDs", () => {
    const questions = [question("Q1"), question("Q1"), question("Q3"), question("Q4")];
    const result = QuestionsResponseSchema.safeParse({ questions });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain('duplicate question ID "Q1"');
  });

  it("rejects fewer than four questions", () => {
    const questions = [question("Q1"), question("Q2")];
    expect(QuestionsResponseSchema.safeParse({ questions }).success).toBe(false);
  });
});
