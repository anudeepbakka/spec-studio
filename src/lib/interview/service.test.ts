import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { getSpec, updateSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { ProviderError } from "../llm/errors";
import type { ChatRequest, LLMProvider } from "../llm/types";
import { createDraft, type SpecDeps } from "../specs/service";
import { DONE_REPLY, makeTurn, questionReply } from "../../test/interview-fixtures";
import type { Turn } from "../schemas/turn";
import { interviewFinish, interviewNext, interviewUndo } from "./service";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const REQUEST = "Let admins export order history as a CSV file.";

// A provider that replays scripted replies and records every request it receives.
// A reply left out of the script throws, so an unexpected provider call fails the test.
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
  const llm = createLLMClient({ providers: [scripted(replies, sent)], log: () => {} });
  return { db, llm, dailySpecLimit };
}

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  db = instance as unknown as Db;
});

async function newSpec(deps: SpecDeps, owner = OWNER_A): Promise<string> {
  return (await createDraft(deps, owner, REQUEST)).id;
}

describe("interviewNext", () => {
  it("asks the first question, starts the spec, and saves the question", async () => {
    const deps = depsWith([questionReply("Who can export?")]);
    const id = await newSpec(deps);

    const step = await interviewNext(deps, OWNER_A, id);

    expect(step).toMatchObject({ done: false, turn: { index: 1, question: { id: "Q-1", question: "Who can export?" } } });
    const row = await getSpec(db, OWNER_A, id);
    expect(row?.status).toBe("interviewing");
    expect(row?.interview).toHaveLength(1);
  });

  it("returns the pending question on a repeat call without calling the provider (resume)", async () => {
    const deps = depsWith([questionReply("Who can export?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);

    const again = await interviewNext(deps, OWNER_A, id);

    expect(again).toMatchObject({ done: false, turn: { index: 1 } });
    expect(sent).toHaveLength(1);
  });

  it("uses the answer in the next question: the prompt carries the earlier answer", async () => {
    const deps = depsWith([questionReply("Who can export?"), questionReply("Do admins see other teams' orders?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);

    const step = await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "Admins only" });

    expect(step).toMatchObject({ done: false, turn: { index: 2 } });
    const prompt = sent[1]?.messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("Q-1 Who can export?\n  Answer: Admins only");
  });

  it("repairs a done reply that comes before the minimum, then gets a question", async () => {
    const deps = depsWith([DONE_REPLY, questionReply("Who can export?")]);
    const id = await newSpec(deps);

    const step = await interviewNext(deps, OWNER_A, id);

    expect(step).toMatchObject({ done: false, turn: { index: 1 } });
    // The first attempt and its repair both count toward the per-spec cap.
    expect((await getSpec(db, OWNER_A, id))?.llmCalls).toBe(2);
  });

  it("ends the interview when the model says done after four resolved turns", async () => {
    const deps = depsWith([
      questionReply("Q1?"),
      questionReply("Q2?"),
      questionReply("Q3?"),
      questionReply("Q4?"),
      DONE_REPLY,
    ]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    for (let i = 1; i <= 3; i++) {
      await interviewNext(deps, OWNER_A, id, { questionId: `Q-${i}`, answer: `answer ${i}` });
    }
    const step = await interviewNext(deps, OWNER_A, id, { questionId: "Q-4", answer: "answer 4" });

    expect(step.done).toBe(true);
    expect((await getSpec(db, OWNER_A, id))?.status).toBe("interview_done");
  });

  it("forces the end at eight resolved turns without another provider call", async () => {
    const replies = Array.from({ length: 8 }, (_, i) => questionReply(`Q${i + 1}?`));
    const deps = depsWith(replies);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    for (let i = 1; i <= 7; i++) {
      await interviewNext(deps, OWNER_A, id, { questionId: `Q-${i}`, answer: `answer ${i}` });
    }
    const callsBefore = sent.length;

    const step = await interviewNext(deps, OWNER_A, id, { questionId: "Q-8", answer: "answer 8" });

    expect(step.done).toBe(true);
    expect(sent).toHaveLength(callsBefore);
    expect((await getSpec(db, OWNER_A, id))?.status).toBe("interview_done");
  });

  it("skipped and not-sure answers are saved with their status", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("Q3?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "", skipped: true });
    await interviewNext(deps, OWNER_A, id, { questionId: "Q-2", answer: "Maybe", notSure: true });

    const row = await getSpec(db, OWNER_A, id);
    expect((row?.interview as Turn[]).map((turn) => turn.answer)).toEqual([
      { text: "", status: "skipped" },
      { text: "Maybe", status: "not_sure" },
      null,
    ]);
  });

  it("refuses an answer for a question that is no longer current", async () => {
    const deps = depsWith([questionReply("Q1?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);

    const error = await interviewNext(deps, OWNER_A, id, { questionId: "Q-9", answer: "x" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "invalid_state" });
  });

  it("refuses an answer after the interview has ended", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("Q3?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    await interviewFinish(deps, OWNER_A, id).catch(() => undefined);
    await updateSpec(db, OWNER_A, id, { status: "interview_done" });

    const error = await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "x" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409 });
  });

  it("does not charge the daily limit again when a retry follows a failed first question", async () => {
    const deps = depsWith([new ProviderError("groq", "server", "down"), questionReply("Q1?")], 1);
    const id = await newSpec(deps);

    await expect(interviewNext(deps, OWNER_A, id)).rejects.toBeTruthy();
    const step = await interviewNext(deps, OWNER_A, id);

    expect(step).toMatchObject({ done: false, turn: { index: 1 } });
  });

  it("refuses a new spec past the daily limit before any provider call", async () => {
    const deps = depsWith([questionReply("Q1?")], 1);
    const first = await newSpec(deps);
    const second = await newSpec(deps);
    await interviewNext(deps, OWNER_A, first);
    const callsBefore = sent.length;

    const error = await interviewNext(deps, OWNER_A, second).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 429, code: "daily_limit" });
    expect(sent).toHaveLength(callsBefore);
    // Continuing a spec already started does not count again.
    expect(await interviewNext(deps, OWNER_A, first)).toMatchObject({ done: false });
  });

  it("refuses further AI calls once the spec reaches its call cap, before any provider call", async () => {
    const deps = depsWith([questionReply("Q1?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    await updateSpec(db, OWNER_A, id, { llmCalls: 12 });
    const callsBefore = sent.length;

    const error = await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "Admins" }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 429, code: "spec_call_limit" });
    expect(sent).toHaveLength(callsBefore);
  });

  it("refuses legacy specs with 409 legacy_spec", async () => {
    const deps = depsWith([]);
    const id = await newSpec(deps);
    await updateSpec(db, OWNER_A, id, { interview: null, status: "answered" });

    const error = await interviewNext(deps, OWNER_A, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "legacy_spec" });
  });

  it("does not show one owner's spec to another owner", async () => {
    const deps = depsWith([questionReply("Q1?")]);
    const id = await newSpec(deps, OWNER_A);

    const error = await interviewNext(deps, OWNER_B, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe("interviewUndo", () => {
  it("removes the last answer and asks that question again", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("A different Q1?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "Admins" });

    const step = await interviewUndo(deps, OWNER_A, id);

    expect(step).toMatchObject({ done: false, turn: { index: 1, question: { id: "Q-1", question: "A different Q1?" } } });
    expect((await getSpec(db, OWNER_A, id))?.interview).toHaveLength(1);
  });

  it("reopens a finished interview", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("Q3?"), questionReply("Q4?"), questionReply("Q-again?")]);
    const id = await newSpec(deps);
    await updateSpec(db, OWNER_A, id, {
      status: "interview_done",
      interview: [
        makeTurn(1, { text: "a", status: "answered" }),
        makeTurn(2, { text: "b", status: "answered" }),
        makeTurn(3, { text: "c", status: "answered" }),
        makeTurn(4, { text: "d", status: "answered" }),
      ],
    });

    await interviewUndo(deps, OWNER_A, id);

    expect((await getSpec(db, OWNER_A, id))?.status).toBe("interviewing");
  });

  it("is refused when nothing has been answered, and after generation has started", async () => {
    const deps = depsWith([questionReply("Q1?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    expect(await interviewUndo(deps, OWNER_A, id).catch((e: unknown) => e)).toMatchObject({ status: 409 });

    await updateSpec(db, OWNER_A, id, { status: "done" });
    expect(await interviewUndo(deps, OWNER_A, id).catch((e: unknown) => e)).toMatchObject({ status: 409 });
  });
});

describe("interviewFinish", () => {
  it("needs three real answers", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("Q3?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    await interviewNext(deps, OWNER_A, id, { questionId: "Q-1", answer: "a" });
    await interviewNext(deps, OWNER_A, id, { questionId: "Q-2", answer: "b", skipped: true });

    const error = await interviewFinish(deps, OWNER_A, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "too_few_answers" });
  });

  it("ends the interview and drops the pending question", async () => {
    const deps = depsWith([questionReply("Q1?"), questionReply("Q2?"), questionReply("Q3?"), questionReply("Q4?")]);
    const id = await newSpec(deps);
    await interviewNext(deps, OWNER_A, id);
    for (let i = 1; i <= 3; i++) {
      await interviewNext(deps, OWNER_A, id, { questionId: `Q-${i}`, answer: `answer ${i}` });
    }

    const step = await interviewFinish(deps, OWNER_A, id);

    expect(step.done).toBe(true);
    const row = await getSpec(db, OWNER_A, id);
    expect(row?.status).toBe("interview_done");
    expect(row?.interview).toHaveLength(3);
    expect((row?.interview as Turn[]).every((turn) => turn.answer !== null)).toBe(true);
  });
});
