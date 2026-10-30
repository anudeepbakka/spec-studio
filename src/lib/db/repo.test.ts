import type { Owner } from "@/lib/owner/scope";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createSpec, deleteSpec, getSpec, listSpecs, updateSpec, type Db } from "./repo";
import * as schema from "./schema";

const OWNER_A: Owner = { kind: "guest", ownerId: "11111111-1111-4111-8111-111111111111" };
const OWNER_B: Owner = { kind: "guest", ownerId: "22222222-2222-4222-8222-222222222222" };

// A real Postgres (PGlite, in-process) with the migration from drizzle/ applied.
let db: Db;

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  // PGlite and postgres-js share the query API; the cast only bridges their driver types.
  db = instance as unknown as Db;
});

describe("spec repository", () => {
  it("creates a draft with a title from the first 60 chars", async () => {
    const request = "x".repeat(100);
    const row = await createSpec(db, OWNER_A, request);

    expect(row.status).toBe("draft");
    expect(row.title).toBe("x".repeat(60));
    expect(row.rawRequest).toBe(request);
    expect(row.ownerId).toBe(OWNER_A.ownerId);
  });

  it("gets a spec only for its owner", async () => {
    const row = await createSpec(db, OWNER_A, "Add password reset");

    expect((await getSpec(db, OWNER_A, row.id))?.id).toBe(row.id);
    expect(await getSpec(db, OWNER_B, row.id)).toBeNull();
  });

  it("lists only the owner's specs, newest first", async () => {
    const first = await createSpec(db, OWNER_A, "First request");
    const second = await createSpec(db, OWNER_A, "Second request");
    await createSpec(db, OWNER_B, "Someone else's request");

    const list = await listSpecs(db, OWNER_A);

    expect(list.map((s) => s.id)).toEqual([second.id, first.id]);
    expect(list[0]).toEqual({
      id: second.id,
      title: "Second request",
      status: "draft",
      createdAt: second.createdAt,
    });
  });

  it("deletes only the owner's spec", async () => {
    const row = await createSpec(db, OWNER_A, "Bulk delete");

    expect(await deleteSpec(db, OWNER_B, row.id)).toBe(false);
    expect(await getSpec(db, OWNER_A, row.id)).not.toBeNull();

    expect(await deleteSpec(db, OWNER_A, row.id)).toBe(true);
    expect(await getSpec(db, OWNER_A, row.id)).toBeNull();
  });

  it("updates only the owner's spec", async () => {
    const row = await createSpec(db, OWNER_A, "Update scope");

    expect(await updateSpec(db, OWNER_B, row.id, { status: "failed" })).toBeNull();
    const updated = await updateSpec(db, OWNER_A, row.id, { status: "failed", errorMessage: "boom" });

    expect(updated?.status).toBe("failed");
    expect(updated?.errorMessage).toBe("boom");
    expect((await getSpec(db, OWNER_A, row.id))?.status).toBe("failed");
  });
});
