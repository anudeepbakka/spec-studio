import { and, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { specScope, type Owner } from "../owner/scope";
import { llmBudget, specs, usage, type NewSpecRow, type SpecRow } from "./schema";
import * as schema from "./schema";

// Repository functions. Every function takes the owner and scopes its query to it (SPEC §5),
// so one owner can never read or delete another owner's spec.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SpecSummary = Pick<SpecRow, "id" | "title" | "status" | "createdAt">;

export async function createSpec(db: Db, owner: Owner, rawRequest: string): Promise<SpecRow> {
  const [row] = await db
    .insert(specs)
    .values({
      ownerId: owner.ownerId,
      userId: owner.kind === "user" ? owner.userId : null,
      title: rawRequest.slice(0, 60),
      rawRequest,
      status: "draft",
      interview: [],
    })
    .returning();
  if (!row) {
    throw new Error("insert into specs returned no row");
  }
  return row;
}

export async function getSpec(db: Db, owner: Owner, id: string): Promise<SpecRow | null> {
  const [row] = await db
    .select()
    .from(specs)
    .where(and(eq(specs.id, id), specScope(owner)))
    .limit(1);
  return row ?? null;
}

export async function listSpecs(db: Db, owner: Owner): Promise<SpecSummary[]> {
  return db
    .select({ id: specs.id, title: specs.title, status: specs.status, createdAt: specs.createdAt })
    .from(specs)
    .where(specScope(owner))
    .orderBy(desc(specs.createdAt));
}

// Updates the owner's spec and bumps updated_at. Returns null when no row matches.
export async function updateSpec(
  db: Db,
  owner: Owner,
  id: string,
  values: Partial<Omit<NewSpecRow, "id" | "ownerId" | "userId" | "createdAt">>,
): Promise<SpecRow | null> {
  const [row] = await db
    .update(specs)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(specs.id, id), specScope(owner)))
    .returning();
  return row ?? null;
}

// Returns true when a row was deleted.
export async function deleteSpec(db: Db, owner: Owner, id: string): Promise<boolean> {
  const deleted = await db
    .delete(specs)
    .where(and(eq(specs.id, id), specScope(owner)))
    .returning({ id: specs.id });
  return deleted.length > 0;
}

// Counts one new spec for the subject's day (UTC, YYYY-MM-DD), unless the day is already at the limit.
// Returns false when the limit is reached. It is one statement, so parallel requests cannot go past the limit.
export async function reserveSpecStart(db: Db, subject: string, day: string, limit: number): Promise<boolean> {
  if (limit < 1) return false;
  const rows = await db
    .insert(usage)
    .values({ subject, day, specsStarted: 1 })
    .onConflictDoUpdate({
      target: [usage.subject, usage.day],
      set: { specsStarted: sql`${usage.specsStarted} + 1` },
      setWhere: sql`${usage.specsStarted} < ${limit}`,
    })
    .returning({ specsStarted: usage.specsStarted });
  return rows.length > 0;
}

// Reserves one AI request on a spec, unless the spec is already at its call cap (SPEC §10).
// It is a conditional update, so two requests at the cap cannot both pass.
export async function reserveSpecCall(db: Db, owner: Owner, id: string, cap: number): Promise<boolean> {
  const rows = await db
    .update(specs)
    .set({ llmCalls: sql`${specs.llmCalls} + 1` })
    .where(and(eq(specs.id, id), specScope(owner), sql`${specs.llmCalls} < ${cap}`))
    .returning({ id: specs.id });
  return rows.length > 0;
}

// Reserves one provider request against the day's global budget (SPEC §10), across all owners.
// Returns false when the budget for the day is used up. The conditional upsert means parallel requests cannot pass it.
export async function reserveGlobalCall(db: Db, day: string, budget: number): Promise<boolean> {
  if (budget < 1) return false;
  const rows = await db
    .insert(llmBudget)
    .values({ day, calls: 1 })
    .onConflictDoUpdate({
      target: llmBudget.day,
      set: { calls: sql`${llmBudget.calls} + 1` },
      setWhere: sql`${llmBudget.calls} < ${budget}`,
    })
    .returning({ calls: llmBudget.calls });
  return rows.length > 0;
}

// New specs the subject has started today (SPEC §10). Zero when the subject has no row yet.
export async function specsStartedOn(db: Db, subject: string, day: string): Promise<number> {
  const [row] = await db
    .select({ specsStarted: usage.specsStarted })
    .from(usage)
    .where(and(eq(usage.subject, subject), eq(usage.day, day)));
  return row?.specsStarted ?? 0;
}
