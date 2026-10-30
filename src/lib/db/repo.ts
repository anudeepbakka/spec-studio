import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { specs, type NewSpecRow, type SpecRow } from "./schema";
import * as schema from "./schema";

// Repository functions. Every function takes the owner ID and scopes its query to it,
// so one owner can never read or delete another owner's spec.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SpecSummary = Pick<SpecRow, "id" | "title" | "status" | "createdAt">;

export async function createSpec(db: Db, ownerId: string, rawRequest: string): Promise<SpecRow> {
  const [row] = await db
    .insert(specs)
    .values({
      ownerId,
      title: rawRequest.slice(0, 60),
      rawRequest,
      status: "draft",
    })
    .returning();
  if (!row) {
    throw new Error("insert into specs returned no row");
  }
  return row;
}

export async function getSpec(db: Db, ownerId: string, id: string): Promise<SpecRow | null> {
  const [row] = await db
    .select()
    .from(specs)
    .where(and(eq(specs.id, id), eq(specs.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function listSpecs(db: Db, ownerId: string): Promise<SpecSummary[]> {
  return db
    .select({ id: specs.id, title: specs.title, status: specs.status, createdAt: specs.createdAt })
    .from(specs)
    .where(eq(specs.ownerId, ownerId))
    .orderBy(desc(specs.createdAt));
}

// Updates the owner's spec and bumps updated_at. Returns null when no row matches.
export async function updateSpec(
  db: Db,
  ownerId: string,
  id: string,
  values: Partial<Omit<NewSpecRow, "id" | "ownerId" | "createdAt">>,
): Promise<SpecRow | null> {
  const [row] = await db
    .update(specs)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(specs.id, id), eq(specs.ownerId, ownerId)))
    .returning();
  return row ?? null;
}

// Returns true when a row was deleted.
export async function deleteSpec(db: Db, ownerId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(specs)
    .where(and(eq(specs.id, id), eq(specs.ownerId, ownerId)))
    .returning({ id: specs.id });
  return deleted.length > 0;
}
