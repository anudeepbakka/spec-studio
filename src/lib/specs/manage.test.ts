import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import type { Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { createDraft, deleteOwnedSpec, findOwnedSpec, listOwnedSpecs, type SpecDeps } from "./service";
import { toSpecView } from "./view";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const REQUEST = "Let users reset a forgotten password by email link.";

let deps: SpecDeps;

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  const db = instance as unknown as Db;
  deps = { db, llm: createLLMClient({ providers: [], log: () => {} }), dailySpecLimit: 5 };
});

describe("owner-scoped list, read and delete", () => {
  it("lists only the owner's specs", async () => {
    const mine = await createDraft(deps, OWNER_A, REQUEST);
    await createDraft(deps, OWNER_B, REQUEST);

    const list = await listOwnedSpecs(deps, OWNER_A);
    expect(list.map((spec) => spec.id)).toEqual([mine.id]);
  });

  it("gives another owner the same not-found error as a missing spec", async () => {
    const { id } = await createDraft(deps, OWNER_A, REQUEST);

    await expect(findOwnedSpec(deps.db, OWNER_B, id)).rejects.toMatchObject({ status: 404, code: "not_found" });
    await expect(deleteOwnedSpec(deps, OWNER_B, id)).rejects.toBeInstanceOf(ApiError);
    await expect(deleteOwnedSpec(deps, OWNER_B, id)).rejects.toMatchObject({ status: 404 });
  });

  it("deletes the owner's spec, and a second delete is not found", async () => {
    const { id } = await createDraft(deps, OWNER_A, REQUEST);

    await deleteOwnedSpec(deps, OWNER_A, id);

    expect(await listOwnedSpecs(deps, OWNER_A)).toEqual([]);
    await expect(deleteOwnedSpec(deps, OWNER_A, id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("toSpecView", () => {
  it("maps a draft row to the browser shape with ISO dates and no empty JSON", async () => {
    const row = await findOwnedSpec(deps.db, OWNER_A, (await createDraft(deps, OWNER_A, REQUEST)).id);

    const view = toSpecView(row);

    expect(view).toMatchObject({ status: "draft", rawRequest: REQUEST, questions: null, answers: null, spec: null });
    expect(view.createdAt).toBe(row.createdAt.toISOString());
  });
});
