import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
import { createSpec, reserveGlobalCall, type Db } from "../db/repo";
import type { LLMClient } from "../llm/client";
import type { Owner } from "../owner/scope";
import { specCallReservation } from "../specs/limits";
import { chargeSpecStart, type SpecDeps } from "../specs/service";
import { testDb } from "@/test/db";

// SPEC §10 and AC-7, AC-13, AC-23: the daily spec limits, the per-spec call cap, and the global budget.
let db: Db;
const GUEST: Owner = { kind: "guest", ownerId: "11111111-1111-4111-8111-111111111111" };
const USER: Owner = { kind: "user", userId: "alice", ownerId: "22222222-2222-4222-8222-222222222222" };

function depsWith(overrides: Partial<SpecDeps> = {}): SpecDeps {
  const llm = { chat: vi.fn(), generateJson: vi.fn() } as unknown as LLMClient;
  return { db, llm, dailySpecLimit: 1, dailySpecLimitUser: 2, globalCallBudget: 600, ...overrides };
}

async function expectApiError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
}

beforeEach(async () => {
  db = await testDb();
  const { user } = await import("../db/schema");
  await db.insert(user).values({ id: "alice", name: "alice", email: "alice@users.invalid", username: "alice" });
});

describe("daily spec limits", () => {
  it("guests use DAILY_SPEC_LIMIT and get a sign-in suggestion when they reach it", async () => {
    const deps = depsWith({ dailySpecLimit: 1 });
    await chargeSpecStart(deps, GUEST);
    await expectApiError(chargeSpecStart(deps, GUEST), "daily_limit");
    await expect(chargeSpecStart(deps, GUEST)).rejects.toThrow(/Sign in for a higher daily limit/);
  });

  it("signed-in users use DAILY_SPEC_LIMIT_USER", async () => {
    const deps = depsWith({ dailySpecLimit: 1, dailySpecLimitUser: 2 });
    await chargeSpecStart(deps, USER);
    await chargeSpecStart(deps, USER);
    await expectApiError(chargeSpecStart(deps, USER), "daily_limit");
  });
});

describe("AI call limits", () => {
  it("refuses the 13th call on a spec with spec_call_limit, before any provider is contacted", async () => {
    const spec = await createSpec(db, GUEST, "A request");
    const hook = specCallReservation(depsWith(), GUEST, spec.id);
    for (let i = 0; i < 12; i++) await hook();
    await expectApiError(hook(), "spec_call_limit");
  });

  it("refuses with demo_capacity when the global budget for the day is used up", async () => {
    const spec = await createSpec(db, GUEST, "A request");
    const hook = specCallReservation(depsWith({ globalCallBudget: 2 }), GUEST, spec.id);
    await hook();
    await hook();
    await expectApiError(hook(), "demo_capacity");
  });

  it("the global budget counts across owners", async () => {
    expect(await reserveGlobalCall(db, "2026-10-30", 2)).toBe(true);
    expect(await reserveGlobalCall(db, "2026-10-30", 2)).toBe(true);
    expect(await reserveGlobalCall(db, "2026-10-30", 2)).toBe(false);
    expect(await reserveGlobalCall(db, "2026-10-31", 2)).toBe(true);
  });
});
