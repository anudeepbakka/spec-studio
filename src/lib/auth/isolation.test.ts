import { beforeEach, describe, expect, it } from "vitest";
import { createSpec, deleteSpec, getSpec, listSpecs, reserveSpecCall, updateSpec, type Db } from "../db/repo";
import type { Owner } from "../owner/scope";
import { testDb } from "@/test/db";
import { claimGuestSpecs } from "./account";

// SPEC §17 and AC-22: two signed-in users, and a signed-in user with a guest, cannot see or change each other's specs.
let db: Db;
const COOKIE_A = "11111111-1111-4111-8111-111111111111";
const COOKIE_B = "22222222-2222-4222-8222-222222222222";
const COOKIE_G = "33333333-3333-4333-8333-333333333333";
const ALICE: Owner = { kind: "user", userId: "alice", ownerId: COOKIE_A };
const BOB: Owner = { kind: "user", userId: "bob", ownerId: COOKIE_B };
const GUEST: Owner = { kind: "guest", ownerId: COOKIE_G };

beforeEach(async () => {
  db = await testDb();
  const { user } = await import("../db/schema");
  await db.insert(user).values([
    { id: "alice", name: "alice", email: "alice@users.invalid", username: "alice" },
    { id: "bob", name: "bob", email: "bob@users.invalid", username: "bob" },
  ]);
});

describe("isolation between owners", () => {
  it("a signed-in user's spec is invisible to another user and to a guest", async () => {
    const spec = await createSpec(db, ALICE, "Alice's spec");

    expect((await getSpec(db, ALICE, spec.id))?.id).toBe(spec.id);
    expect(await getSpec(db, BOB, spec.id)).toBeNull();
    expect(await getSpec(db, GUEST, spec.id)).toBeNull();
    expect(await listSpecs(db, BOB)).toHaveLength(0);
    expect(await listSpecs(db, GUEST)).toHaveLength(0);
  });

  it("another user cannot update, generate for, or delete the spec", async () => {
    const spec = await createSpec(db, ALICE, "Alice's spec");

    expect(await updateSpec(db, BOB, spec.id, { title: "Changed" })).toBeNull();
    expect(await reserveSpecCall(db, BOB, spec.id, 12)).toBe(false);
    expect(await deleteSpec(db, BOB, spec.id)).toBe(false);
    expect((await getSpec(db, ALICE, spec.id))?.title).toBe("Alice's spec");
  });

  it("a guest spec with the same cookie is not visible to the signed-in user until it is claimed", async () => {
    const guestSpec = await createSpec(db, { kind: "guest", ownerId: COOKIE_A }, "Made as a guest");

    expect(await getSpec(db, ALICE, guestSpec.id)).toBeNull();
    await claimGuestSpecs(db, "alice", COOKIE_A, new Date().toISOString().slice(0, 10));
    expect((await getSpec(db, ALICE, guestSpec.id))?.id).toBe(guestSpec.id);
    expect(await getSpec(db, { kind: "guest", ownerId: COOKIE_A }, guestSpec.id)).toBeNull();
  });

  it("a guest cannot see a spec that a user created with the same cookie", async () => {
    const spec = await createSpec(db, ALICE, "Created while signed in");
    expect(await getSpec(db, { kind: "guest", ownerId: COOKIE_A }, spec.id)).toBeNull();
  });
});
