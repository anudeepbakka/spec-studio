import { ApiError } from "../api/errors";
import { createSpec, deleteSpec, getSpec, listSpecs, reserveSpecStart, updateSpec, type Db } from "../db/repo";
import type { SpecRow } from "../db/schema";
import type { LLMClient } from "../llm/client";

// SPEC §10: spec records and the daily limit on new specs.
// Each function takes the owner ID, so every read and write is scoped to that owner.

export type SpecDeps = { db: Db; llm: LLMClient; dailySpecLimit: number };

// The UTC calendar day used for the daily limit (SPEC §10).
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Counts one new spec against the owner's daily limit. Called when a spec's first question is requested,
// before any provider is contacted, so a request over the limit never costs a provider call (AC-7).
export async function chargeSpecStart(deps: SpecDeps, ownerId: string): Promise<void> {
  const allowed = await reserveSpecStart(deps.db, ownerId, utcDay(new Date()), deps.dailySpecLimit);
  if (!allowed) {
    throw new ApiError(
      429,
      "daily_limit",
      `You have started all ${deps.dailySpecLimit} new specs for today. The limit resets at 00:00 UTC.`,
    );
  }
}

export async function findOwnedSpec(db: Db, ownerId: string, id: string): Promise<SpecRow> {
  const spec = await getSpec(db, ownerId, id);
  if (!spec) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return spec;
}

// Lists the owner's specs, newest first (SPEC §10).
export async function listOwnedSpecs(deps: SpecDeps, ownerId: string) {
  return listSpecs(deps.db, ownerId);
}

// Deletes one of the owner's specs. Another owner's ID gets the same 404 as a missing one.
export async function deleteOwnedSpec(deps: SpecDeps, ownerId: string, id: string): Promise<void> {
  const deleted = await deleteSpec(deps.db, ownerId, id);
  if (!deleted) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
}

export async function createDraft(deps: SpecDeps, ownerId: string, rawRequest: string) {
  const row = await createSpec(deps.db, ownerId, rawRequest);
  return { id: row.id };
}

// Saves the interview state and the status together. Returns nothing; a missing row is a 404.
export async function saveInterview(
  deps: SpecDeps,
  ownerId: string,
  id: string,
  interview: unknown,
  status: SpecRow["status"],
): Promise<void> {
  const updated = await updateSpec(deps.db, ownerId, id, { interview, status });
  if (!updated) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
}

// Legacy specs (SPEC §10) come from the v1 question flow. They have no interview, and a draft is not one of them.
export function isLegacySpec(spec: SpecRow): boolean {
  return spec.interview === null && spec.status !== "draft";
}
