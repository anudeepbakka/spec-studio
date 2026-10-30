import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { getSpec, updateSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { ProviderError } from "../llm/errors";
import type { ChatRequest, LLMProvider } from "../llm/types";
import { PROMPT_VERSION } from "../prompts";
import { sampleSpec } from "../../test/sample-spec";
import { makeTurn } from "../../test/interview-fixtures";
import { exportFilename } from "./export";
import { startGeneration, runGeneration, type GenerationEvent } from "./generate";
import { createDraft, type SpecDeps } from "./service";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const REQUEST = "Let users reset a forgotten password by email link.";
const validSpecJson = JSON.stringify(sampleSpec);

// Replays scripted replies. chat() returns a reply whole; chatStream() yields it in 10-character chunks.
function scripted(replies: Array<string | ProviderError>, sent: ChatRequest[]): LLMProvider {
  const take = () => {
    const reply = replies.shift();
    if (reply === undefined) throw new Error("provider called with no scripted reply left");
    if (reply instanceof ProviderError) throw reply;
    return reply;
  };
  return {
    name: "groq",
    model: "groq-model",
    async chat(req) {
      sent.push(req);
      return take();
    },
    async *chatStream(req) {
      sent.push(req);
      const text = take();
      for (let i = 0; i < text.length; i += 10) yield text.slice(i, i + 10);
    },
  };
}

let db: Db;
let sent: ChatRequest[];

function depsWith(replies: Array<string | ProviderError>, dailySpecLimit = 5): SpecDeps {
  sent = [];
  return { db, llm: createLLMClient({ providers: [scripted(replies, sent)], log: () => {} }), dailySpecLimit };
}

// An interview that has ended after four answers, ready to generate.
const finishedInterview = [
  makeTurn(1, { text: "Registered users", status: "answered" }),
  makeTurn(2, { text: "", status: "skipped" }),
  makeTurn(3, { text: "Email link, 15 minutes", status: "answered" }),
  makeTurn(4, { text: "Maybe SMS later", status: "not_sure" }),
];

async function readySpec(deps: SpecDeps, owner = OWNER_A): Promise<string> {
  const { id } = await createDraft(deps, owner, REQUEST);
  await updateSpec(db, owner, id, { interview: finishedInterview, status: "interview_done" });
  return id;
}

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  db = instance as unknown as Db;
});

describe("startGeneration", () => {
  it("refuses a spec whose interview is still running", async () => {
    const deps = depsWith([]);
    const { id } = await createDraft(deps, OWNER_A, REQUEST);
    await updateSpec(db, OWNER_A, id, { status: "interviewing" });

    const error = await startGeneration(deps, OWNER_A, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "invalid_state" });
  });

  it("refuses a legacy spec with 409 legacy_spec", async () => {
    const deps = depsWith([]);
    const { id } = await createDraft(deps, OWNER_A, REQUEST);
    await updateSpec(db, OWNER_A, id, { interview: null, status: "answered" });

    const error = await startGeneration(deps, OWNER_A, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "legacy_spec" });
  });

  it("returns the transcript and marks the spec as generating, without using the daily spec limit", async () => {
    const deps = depsWith([], 0);
    const id = await readySpec(deps);

    const input = await startGeneration(deps, OWNER_A, id);

    expect(input.turns).toHaveLength(4);
    expect((await getSpec(db, OWNER_A, id))?.status).toBe("generating");
  });

  it("does not reveal another owner's spec", async () => {
    const deps = depsWith([]);
    const id = await readySpec(deps, OWNER_A);

    const error = await startGeneration(deps, OWNER_B, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe("runGeneration", () => {
  it("builds the spec from the transcript, saves it, and streams progress then the spec", async () => {
    const deps = depsWith([validSpecJson]);
    const id = await readySpec(deps);
    const input = await startGeneration(deps, OWNER_A, id);
    const events: GenerationEvent[] = [];

    await runGeneration(deps, OWNER_A, id, input, (event) => events.push(event));

    const prompt = sent[0]?.messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("Answer: Registered users");
    expect(prompt).toContain("skipped (treat as an assumption)");
    expect(prompt).toContain("not sure: Maybe SMS later (treat as an open question)");
    expect(events.some((event) => event.type === "progress")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "spec" });

    const row = await getSpec(db, OWNER_A, id);
    expect(row).toMatchObject({ status: "done", promptVersion: PROMPT_VERSION, provider: "groq" });
    expect(row?.spec).toMatchObject({ title: sampleSpec.title });
    expect(exportFilename(sampleSpec.title)).toMatch(/\.md$/);
  });

  it("marks the spec failed with a readable message when output stays invalid", async () => {
    const deps = depsWith(["not json", "still not json"]);
    const id = await readySpec(deps);
    const input = await startGeneration(deps, OWNER_A, id);
    const events: GenerationEvent[] = [];

    await runGeneration(deps, OWNER_A, id, input, (event) => events.push(event));

    expect(events.at(-1)).toMatchObject({ type: "error", code: "llm_unavailable" });
    expect((await getSpec(db, OWNER_A, id))?.status).toBe("failed");
  });

  it("counts a repair as an AI call, and stops at the spec's call cap", async () => {
    const deps = depsWith(["not json", validSpecJson]);
    const id = await readySpec(deps);
    await updateSpec(db, OWNER_A, id, { llmCalls: 11 });
    const input = await startGeneration(deps, OWNER_A, id);
    const events: GenerationEvent[] = [];

    await runGeneration(deps, OWNER_A, id, input, (event) => events.push(event));

    // The first request takes the 12th call. The repair is refused before any provider call.
    expect(sent).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "error", code: "spec_call_limit" });
    const row = await getSpec(db, OWNER_A, id);
    expect(row).toMatchObject({ status: "failed", llmCalls: 12 });
  });

  it("returns a cancelled run to interview_done", async () => {
    // An aborted request surfaces as a failed call. The run must then go back, not to failed.
    const deps = depsWith([new ProviderError("groq", "network", "aborted")]);
    const id = await readySpec(deps);
    const input = await startGeneration(deps, OWNER_A, id);
    const controller = new AbortController();
    controller.abort();

    await runGeneration(deps, OWNER_A, id, input, () => undefined, controller.signal);

    expect((await getSpec(db, OWNER_A, id))?.status).toBe("interview_done");
  });
});
