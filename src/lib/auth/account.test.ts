import { beforeEach, describe, expect, it } from "vitest";
import { createSpec, getSpec, listSpecs, reserveSpecStart, specsStartedOn, type Db } from "../db/repo";
import { account, session, specs, usage, user } from "../db/schema";
import type { Owner } from "../owner/scope";
import { testDb } from "@/test/db";
import { claimGuestSpecs, countClaimableSpecs, deleteAccountData } from "./account";

// SPEC §17 and AC-21, AC-24: claiming guest specs (idempotent, own cookie only, usage by maximum) and account deletion.
let db: Db;
const DAY = "2026-10-30";
const GUEST_A = "11111111-1111-4111-8111-111111111111";
const GUEST_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";

const guest = (ownerId: string): Owner => ({ kind: "guest", ownerId });

beforeEach(async () => {
  db = await testDb();
  await db.insert(user).values({ id: USER_ID, name: "ada_1", email: "ada_1@users.invalid", username: "ada_1" });
});

describe("claimGuestSpecs", () => {
  it("moves only this cookie's unclaimed specs to the user", async () => {
    await createSpec(db, guest(GUEST_A), "First guest spec");
    await createSpec(db, guest(GUEST_A), "Second guest spec");
    const other = await createSpec(db, guest(GUEST_B), "Another guest's spec");

    expect(await countClaimableSpecs(db, GUEST_A)).toBe(2);
    expect(await claimGuestSpecs(db, USER_ID, GUEST_A, DAY)).toEqual({ moved: 2 });

    const mine = await listSpecs(db, { kind: "user", userId: USER_ID, ownerId: GUEST_A });
    expect(mine).toHaveLength(2);
    expect((await getSpec(db, guest(GUEST_B), other.id))?.userId).toBeNull();
  });

  it("is idempotent: a second claim moves nothing", async () => {
    await createSpec(db, guest(GUEST_A), "Guest spec");
    await claimGuestSpecs(db, USER_ID, GUEST_A, DAY);
    expect(await claimGuestSpecs(db, USER_ID, GUEST_A, DAY)).toEqual({ moved: 0 });
    expect(await countClaimableSpecs(db, GUEST_A)).toBe(0);
  });

  it("takes the larger of the user's and the guest's count for the day, so a claim never resets a limit", async () => {
    await reserveSpecStart(db, `guest:${GUEST_A}`, DAY, 10);
    await reserveSpecStart(db, `guest:${GUEST_A}`, DAY, 10);
    await reserveSpecStart(db, `guest:${GUEST_A}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);

    await claimGuestSpecs(db, USER_ID, GUEST_A, DAY);
    expect(await specsStartedOn(db, `user:${USER_ID}`, DAY)).toBe(5);
  });

  it("raises the user's count to the guest's when the guest used more today", async () => {
    for (let i = 0; i < 4; i++) await reserveSpecStart(db, `guest:${GUEST_A}`, DAY, 10);
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);

    await claimGuestSpecs(db, USER_ID, GUEST_A, DAY);
    expect(await specsStartedOn(db, `user:${USER_ID}`, DAY)).toBe(4);
  });
});

describe("deleteAccountData", () => {
  it("removes the user's specs, usage, sessions and account, and leaves guest specs alone", async () => {
    const userOwner: Owner = { kind: "user", userId: USER_ID, ownerId: GUEST_A };
    await createSpec(db, userOwner, "Signed-in spec");
    await createSpec(db, guest(GUEST_A), "Guest spec in the same browser");
    await reserveSpecStart(db, `user:${USER_ID}`, DAY, 10);
    await db.insert(session).values({
      id: "s1",
      token: "t1",
      userId: USER_ID,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });
    await db.insert(account).values({ id: "a1", accountId: USER_ID, providerId: "credential", userId: USER_ID, password: "hash" });

    await deleteAccountData(db, USER_ID);

    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(session)).toHaveLength(0);
    expect(await db.select().from(account)).toHaveLength(0);
    expect(await db.select().from(usage)).toHaveLength(0);
    const remaining = await db.select().from(specs);
    expect(remaining.map((spec) => spec.title)).toEqual(["Guest spec in the same browser"]);
  });
});
