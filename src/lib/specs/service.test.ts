import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { getSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { CreateSpecInputSchema, InterviewAnswerInputSchema } from "./input";
import { createDraft, findOwnedSpec, type SpecDeps } from "./service";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const REQUEST = "Let users reset a forgotten password by email link.";

let deps: SpecDeps;

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  const db = instance as unknown as Db;
  deps = { db, llm: createLLMClient({ providers: [], log: () => {} }), dailySpecLimit: 5 };
});

describe("input validation", () => {
  it("accepts a request between 20 and 4000 characters", () => {
    expect(CreateSpecInputSchema.safeParse({ rawRequest: "x".repeat(20) }).success).toBe(true);
    expect(CreateSpecInputSchema.safeParse({ rawRequest: "x".repeat(4000) }).success).toBe(true);
  });

  it("rejects a request outside the limits with a readable message", () => {
    const short = CreateSpecInputSchema.safeParse({ rawRequest: "x".repeat(19) });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe("Describe the request in at least 20 characters.");
    expect(CreateSpecInputSchema.safeParse({ rawRequest: "x".repeat(4001) }).success).toBe(false);
  });

  it("accepts an answer, a skip, and a not-sure answer, and an empty body for the first question", () => {
    expect(InterviewAnswerInputSchema.safeParse({}).success).toBe(true);
    expect(
      InterviewAnswerInputSchema.safeParse({ answer: { questionId: "Q-1", answer: "Admins" } }).success,
    ).toBe(true);
    expect(
      InterviewAnswerInputSchema.safeParse({ answer: { questionId: "Q-1", answer: "", skipped: true } }).success,
    ).toBe(true);
  });

  it("rejects an answer longer than 1000 characters", () => {
    const result = InterviewAnswerInputSchema.safeParse({
      answer: { questionId: "Q-1", answer: "x".repeat(1001) },
    });
    expect(result.success).toBe(false);
  });
});

describe("createDraft", () => {
  it("creates a draft with an empty interview", async () => {
    const { id } = await createDraft(deps, OWNER_A, REQUEST);

    const row = await getSpec(deps.db, OWNER_A, id);
    expect(row).toMatchObject({ status: "draft", interview: [], llmCalls: 0 });
  });

  it("reports a missing spec as not found", async () => {
    const error = await findOwnedSpec(deps.db, OWNER_A, "00000000-0000-4000-8000-000000000000").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 404, code: "not_found" });
  });
});
