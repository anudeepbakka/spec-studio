import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { updateSpec, type Db } from "../db/repo";
import * as schema from "../db/schema";
import { createLLMClient } from "../llm/client";
import { sampleSpec } from "../../test/sample-spec";
import { exportFilename, exportMarkdown } from "./export";
import { createDraft, type SpecDeps } from "./service";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
let deps: SpecDeps;

beforeEach(async () => {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  const db = instance as unknown as Db;
  deps = { db, llm: createLLMClient({ providers: [], log: () => {} }), dailySpecLimit: 5 };
});

describe("exportFilename", () => {
  it("makes a safe, lowercase file name", () => {
    expect(exportFilename("Password reset!")).toBe("password-reset.md");
    expect(exportFilename("!!!")).toBe("spec.md");
  });
});

describe("exportMarkdown", () => {
  it("refuses a spec that is not done yet", async () => {
    const { id } = await createDraft(deps, OWNER_A, "Let users reset a forgotten password by email link.");
    const error = await exportMarkdown(deps, OWNER_A, id).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "invalid_state" });
  });

  it("returns the Markdown of a finished spec", async () => {
    const { id } = await createDraft(deps, OWNER_A, "Let users reset a forgotten password by email link.");
    await updateSpec(deps.db, OWNER_A, id, { status: "done", spec: sampleSpec });
    const result = await exportMarkdown(deps, OWNER_A, id);
    expect(result.filename).toBe("password-reset-by-email.md");
    expect(result.markdown).toContain("Generated with Spec Studio");
  });
});
