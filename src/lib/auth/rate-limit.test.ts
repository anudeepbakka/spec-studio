import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/repo";
import { testDb } from "@/test/db";
import { clearFailures, hitWindow, lockRemainingMs, recordFailure } from "./rate-limit";

// SPEC §17: rate limits. Windowed counters, and the username lockout that doubles and caps at 60 minutes.
let db: Db;
const MINUTE = 60_000;
const T0 = new Date("2026-10-30T12:00:00Z");

beforeEach(async () => {
  db = await testDb();
});

describe("hitWindow", () => {
  it("allows up to the maximum in one window, then refuses", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await hitWindow(db, "ip:1", 20, 15 * MINUTE, T0)).allowed).toBe(true);
    }
    const refused = await hitWindow(db, "ip:1", 20, 15 * MINUTE, T0);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBeGreaterThan(0);
  });

  it("starts a new window after the window has passed", async () => {
    for (let i = 0; i < 5; i++) await hitWindow(db, "ip:2", 5, 60 * MINUTE, T0);
    expect((await hitWindow(db, "ip:2", 5, 60 * MINUTE, T0)).allowed).toBe(false);
    const later = new Date(T0.getTime() + 61 * MINUTE);
    expect((await hitWindow(db, "ip:2", 5, 60 * MINUTE, later)).allowed).toBe(true);
  });

  it("keeps keys apart", async () => {
    for (let i = 0; i < 5; i++) await hitWindow(db, "ip:a", 5, 60 * MINUTE, T0);
    expect((await hitWindow(db, "ip:b", 5, 60 * MINUTE, T0)).allowed).toBe(true);
  });
});

describe("username lockout", () => {
  it("is not locked before 5 failures", async () => {
    for (let i = 0; i < 4; i++) await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(0);
  });

  it("locks for 1 minute at the 5th failure, then doubles", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(1 * MINUTE);

    await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(2 * MINUTE);

    await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(4 * MINUTE);
  });

  it("caps the lock at 60 minutes", async () => {
    for (let i = 0; i < 12; i++) await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(60 * MINUTE);
  });

  it("ends when the time passes", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", new Date(T0.getTime() + 2 * MINUTE))).toBe(0);
  });

  it("a success clears the count, so the next failure starts again", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(db, "signin-user:ada", T0);
    await clearFailures(db, "signin-user:ada");
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(0);
    for (let i = 0; i < 4; i++) await recordFailure(db, "signin-user:ada", T0);
    expect(await lockRemainingMs(db, "signin-user:ada", T0)).toBe(0);
  });
});
