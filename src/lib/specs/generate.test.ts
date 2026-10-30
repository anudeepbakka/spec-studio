import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { getSpec, updateSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { ProviderError } from "../llm/errors";
import type { LLMProvider } from "../llm/types";
import { PROMPT_VERSION } from "../prompts";
import { sampleSpec } from "../../test/sample-spec";
import { createDraft, generateQuestions, saveAnswers, type SpecDeps } from "./service";
import { startGeneration, runGeneration, type GenerationEvent } from "./generate";
import { exportFilename, exportMarkdown } from "./export";
import { toMarkdown } from "../export/markdown";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const REQUEST = "Let users reset a forgotten password by email link.";

const questions = {
  questions: [
    { id: "Q-1", question: "Who can reset?", why: "Scope", type: "text" },
    { id: "Q-2", question: "Link lifetime?", why: "Security", type: "choice", options: ["15 min", "1 hour"] },
    { id: "Q-3", question: "Notify old email?", why: "Business rule", type: "text" },
    { id: "Q-4", question: "Rate limit?", why: "Abuse", type: "text" },
  ],
};

const validSpecJson = JSON.stringify(sampleSpec);

// Replays scripted replies. chat() returns a reply whole; chatStream() yields it in 10-character chunks.
// A ProviderError entry is thrown instead.
function scriptedProvider(name: string, replies: Array<string | ProviderError>): LLMProvider {
  const next = () => {
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`${name} has no scripted reply left`);
    return reply;
  };
  return {
    name,
    model: `${name}-model`,
    async chat() {
      const reply = next();
      if (reply instanceof ProviderError) throw reply;
      return reply;
    },
    async *chatStream() {
      const reply = next();
      if (reply instanceof ProviderError) throw reply;
      for (let i = 0; i < reply.length; i += 10) {
        yield reply.slice(i, i + 10);
      }
    },
  };
}

let db: Db;

function depsWith(replies: Array<string | ProviderError>, dailyLimit = 10): SpecDeps {
  const llm = createLLMClient({ providers: [scriptedProvider("groq", replies)], log: () => {} });
  return { db, llm, dailyLimit };
}

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  db = instance as unknown as Db;
});

// Creates a spec with questions and answers, ready to generate. Uses one run for the questions.
async function answeredSpec(deps: SpecDeps, owner = OWNER_A) {
  const draft = await createDraft(deps, owner, REQUEST);
  await generateQuestions(deps, owner, draft.id);
  await saveAnswers(deps, owner, draft.id, [{ questionId: "Q-1", answer: "Registered users" }]);
  return draft.id;
}

const questionsJson = JSON.stringify(questions);

async function collect(deps: SpecDeps, id: string, owner = OWNER_A) {
  const input = await startGeneration(deps, owner, id);
  const events: GenerationEvent[] = [];
  await runGeneration(deps, owner, id, input, (event) => events.push(event));
  return events;
}

describe("startGeneration", () => {
  it("refuses a spec that has no answers yet, with a 409 and no run charged", async () => {
    const deps = depsWith([questionsJson]);
    const draft = await createDraft(deps, OWNER_A, REQUEST);
    await generateQuestions(deps, OWNER_A, draft.id);

    const error = await startGeneration(deps, OWNER_A, draft.id).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(409);
    expect((await getSpec(db, OWNER_A, draft.id))?.status).toBe("questions_ready");
  });

  it("returns 404 for another owner's spec", async () => {
    const deps = depsWith([questionsJson]);
    const id = await answeredSpec(deps);

    const error = await startGeneration(deps, OWNER_B, id).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(404);
  });

  it("refuses a second run while one is in progress", async () => {
    const deps = depsWith([questionsJson]);
    const id = await answeredSpec(deps);
    await updateSpec(db, OWNER_A, id, { status: "generating" });

    const error = await startGeneration(deps, OWNER_A, id).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("already_generating");
  });
});

describe("runGeneration", () => {
  it("streams progress, then the spec, and saves it as done", async () => {
    const deps = depsWith([questionsJson, validSpecJson]);
    const id = await answeredSpec(deps);

    const events = await collect(deps, id);

    const progress = events.filter((event) => event.type === "progress");
    expect(progress.length).toBeGreaterThan(1);
    const last = progress[progress.length - 1];
    expect(last).toEqual({ type: "progress", chars: validSpecJson.length });
    expect(events[events.length - 1]).toEqual({ type: "spec", spec: sampleSpec });

    const row = await getSpec(db, OWNER_A, id);
    expect(row?.status).toBe("done");
    expect(row?.spec).toEqual(sampleSpec);
    expect(row?.promptVersion).toBe(PROMPT_VERSION);
  });

  it("repairs invalid output once, then succeeds", async () => {
    const deps = depsWith([questionsJson, "{ not json", validSpecJson]);
    const id = await answeredSpec(deps);

    const events = await collect(deps, id);

    expect(events[events.length - 1]).toEqual({ type: "spec", spec: sampleSpec });
  });

  it("saves the spec as failed with a friendly message when every provider fails", async () => {
    const deps = depsWith([questionsJson, new ProviderError("groq", "server", "HTTP 500")]);
    const id = await answeredSpec(deps);

    const events = await collect(deps, id);

    const error = events[events.length - 1];
    expect(error).toEqual({
      type: "error",
      code: "llm_unavailable",
      message: "The AI service is unavailable right now. Please try again in a moment.",
    });
    const row = await getSpec(db, OWNER_A, id);
    expect(row?.status).toBe("failed");
    expect(row?.errorMessage).toBe(error.type === "error" ? error.message : null);
    expect(row?.spec).toBeNull();
  });

  it("returns the spec to answered when the caller cancels", async () => {
    const deps = depsWith([questionsJson]);
    const id = await answeredSpec(deps);
    // A provider call that fails because the caller aborted, as the real HTTP client does.
    const abortingLlm = createLLMClient({
      providers: [
        {
          name: "groq",
          model: "groq-model",
          chat: () => Promise.reject(new Error("aborted")),
          chatStream: () => ({
            [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error("aborted")) }),
          }),
        },
      ],
      log: () => {},
    });
    const abortingDeps: SpecDeps = { ...deps, llm: abortingLlm };
    const input = await startGeneration(abortingDeps, OWNER_A, id);
    const controller = new AbortController();
    controller.abort();

    await runGeneration(abortingDeps, OWNER_A, id, input, () => {}, controller.signal);

    expect((await getSpec(db, OWNER_A, id))?.status).toBe("answered");
  });

  it("lets a failed spec be generated again", async () => {
    const deps = depsWith([questionsJson, new ProviderError("groq", "server", "HTTP 500"), validSpecJson]);
    const id = await answeredSpec(deps);
    await collect(deps, id);

    const events = await collect(deps, id);

    expect(events[events.length - 1]).toEqual({ type: "spec", spec: sampleSpec });
    expect((await getSpec(db, OWNER_A, id))?.status).toBe("done");
  });
});

describe("daily limit", () => {
  it("returns 429 with no provider call once the owner has used the limit", async () => {
    // Limit of 2: the question run and the first generation use it up.
    const deps = depsWith([questionsJson, validSpecJson], 2);
    const id = await answeredSpec(deps);
    await collect(deps, id);

    const error = await startGeneration(deps, OWNER_A, id).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).code).toBe("daily_limit");
  });

  it("counts question generation too", async () => {
    const deps = depsWith([questionsJson], 0);
    const draft = await createDraft(deps, OWNER_A, REQUEST);

    const error = await generateQuestions(deps, OWNER_A, draft.id).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("daily_limit");
    expect((await getSpec(db, OWNER_A, draft.id))?.status).toBe("draft");
  });

  it("does not let one owner use up another owner's runs", async () => {
    const deps = depsWith([questionsJson, validSpecJson, questionsJson], 2);
    const id = await answeredSpec(deps);
    await collect(deps, id);

    const draft = await createDraft(deps, OWNER_B, REQUEST);
    await expect(generateQuestions(deps, OWNER_B, draft.id)).resolves.toMatchObject({ status: "questions_ready" });
  });
});

describe("exportMarkdown", () => {
  it("returns the Markdown of a finished spec with a safe filename", async () => {
    const deps = depsWith([questionsJson, validSpecJson]);
    const id = await answeredSpec(deps);
    await collect(deps, id);

    const result = await exportMarkdown(deps, OWNER_A, id);

    expect(result.markdown).toBe(toMarkdown(sampleSpec));
    expect(result.filename).toBe(exportFilename(sampleSpec.title));
  });

  it("refuses a spec that is not done yet", async () => {
    const deps = depsWith([questionsJson]);
    const id = await answeredSpec(deps);

    const error = await exportMarkdown(deps, OWNER_A, id).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(409);
  });

  it("returns 404 for another owner's spec", async () => {
    const deps = depsWith([questionsJson, validSpecJson]);
    const id = await answeredSpec(deps);
    await collect(deps, id);

    const error = await exportMarkdown(deps, OWNER_B, id).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(404);
  });
});

describe("exportFilename", () => {
  it("turns a title into a lowercase, dash-separated name", () => {
    expect(exportFilename("Password reset!")).toBe("password-reset.md");
    expect(exportFilename("  ---  ")).toBe("spec.md");
  });
});
