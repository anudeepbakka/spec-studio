import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { getSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { LLMUnavailableError, ProviderError } from "../llm/errors";
import type { LLMProvider } from "../llm/types";
import { PROMPT_VERSION } from "../prompts";
import { CreateSpecInputSchema, SaveAnswersInputSchema } from "./input";
import { createDraft, generateQuestions, saveAnswers, type SpecDeps } from "./service";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const REQUEST = "Let users reset a forgotten password by email link.";

const fourQuestions = {
  questions: [
    { id: "Q-1", question: "Who can reset?", why: "Scope", type: "text" },
    { id: "Q-2", question: "Link lifetime?", why: "Security", type: "choice", options: ["15 min", "1 hour"] },
    { id: "Q-3", question: "Notify old email?", why: "Business rule", type: "text" },
    { id: "Q-4", question: "Rate limit?", why: "Abuse", type: "text" },
  ],
};

// A provider that replays scripted replies. A ProviderError entry is thrown.
function scriptedProvider(name: string, replies: Array<string | ProviderError>): LLMProvider {
  return {
    name,
    model: `${name}-model`,
    async chat() {
      const reply = replies.shift();
      if (reply === undefined) throw new Error(`${name} has no scripted reply left`);
      if (reply instanceof ProviderError) throw reply;
      return reply;
    },
    chatStream() {
      throw new Error("not used");
    },
  };
}

let db: Db;

function depsWith(replies: Array<string | ProviderError>): SpecDeps {
  const llm = createLLMClient({ providers: [scriptedProvider("groq", replies)], log: () => {} });
  return { db, llm, dailyLimit: 10 };
}

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  db = instance as unknown as Db;
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

  it("rejects an answer longer than 1000 characters", () => {
    const result = SaveAnswersInputSchema.safeParse({
      answers: [{ questionId: "Q-1", answer: "x".repeat(1001) }],
    });
    expect(result.success).toBe(false);
  });
});

describe("generateQuestions", () => {
  it("saves 4 to 8 valid questions and marks the spec questions_ready", async () => {
    const deps = depsWith([JSON.stringify(fourQuestions)]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    const result = await generateQuestions(deps, OWNER_A, draft.id);

    expect(result.status).toBe("questions_ready");
    expect(result.questions).toHaveLength(4);
    const row = await getSpec(db, OWNER_A, draft.id);
    expect(row?.status).toBe("questions_ready");
    expect(row?.provider).toBe("groq");
    expect(row?.promptVersion).toBe(PROMPT_VERSION);
  });

  it("repairs invalid JSON with one retry", async () => {
    const deps = depsWith(["not json at all", JSON.stringify(fourQuestions)]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    const result = await generateQuestions(deps, OWNER_A, draft.id);

    expect(result.questions).toHaveLength(4);
  });

  it("returns 503 and leaves the draft unchanged when every provider fails", async () => {
    const deps = depsWith([new ProviderError("groq", "server", "HTTP 500")]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    await expect(generateQuestions(deps, OWNER_A, draft.id)).rejects.toBeInstanceOf(LLMUnavailableError);
    expect((await getSpec(db, OWNER_A, draft.id))?.status).toBe("draft");
  });

  it("returns 404 for another owner's spec and makes no LLM call", async () => {
    const deps = depsWith([]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    const error = await generateQuestions(deps, OWNER_B, draft.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});

describe("saveAnswers", () => {
  async function withQuestions() {
    const deps = depsWith([JSON.stringify(fourQuestions)]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);
    await generateQuestions(deps, OWNER_A, draft.id);
    return { deps, id: draft.id };
  }

  it("saves answers, including skipped ones, and marks the spec answered", async () => {
    const { deps, id } = await withQuestions();

    const result = await saveAnswers(deps, OWNER_A, id, [
      { questionId: "Q-1", answer: "Registered users only" },
      { questionId: "Q-2", answer: "" },
    ]);

    expect(result.status).toBe("answered");
    const row = await getSpec(db, OWNER_A, id);
    expect(row?.status).toBe("answered");
    expect(row?.answers).toEqual([
      { questionId: "Q-1", answer: "Registered users only" },
      { questionId: "Q-2", answer: "" },
    ]);
  });

  it("rejects an answer for a question that does not exist", async () => {
    const { deps, id } = await withQuestions();

    const error = await saveAnswers(deps, OWNER_A, id, [{ questionId: "Q-99", answer: "x" }]).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).code).toBe("unknown_question");
  });

  it("rejects the same question answered twice", async () => {
    const { deps, id } = await withQuestions();

    const error = await saveAnswers(deps, OWNER_A, id, [
      { questionId: "Q-1", answer: "a" },
      { questionId: "Q-1", answer: "b" },
    ]).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("duplicate_answer");
  });

  it("rejects answers before questions exist", async () => {
    const deps = depsWith([]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    const error = await saveAnswers(deps, OWNER_A, draft.id, []).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(409);
  });

  it("returns 404 for another owner's spec", async () => {
    const { deps, id } = await withQuestions();

    const error = await saveAnswers(deps, OWNER_B, id, []).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(404);
  });
});
