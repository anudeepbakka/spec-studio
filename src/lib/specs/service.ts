import { ApiError } from "../api/errors";
import { createSpec, deleteSpec, getSpec, listSpecs, reserveSpecStart, updateSpec, type Db } from "../db/repo";
import type { SpecRow } from "../db/schema";
import type { LLMClient } from "../llm/client";
import { usageSubject, type Owner } from "../owner/scope";

// SPEC §10 and §17: spec records and the daily limits on new specs.
// Each function takes the owner, so every read and write is scoped to that owner.

export type SpecDeps = {
  db: Db;
  llm: LLMClient;
  // DAILY_SPEC_LIMIT (guests) and DAILY_SPEC_LIMIT_USER (signed in), new specs per UTC day.
  dailySpecLimit: number;
  dailySpecLimitUser: number;
  // GLOBAL_DAILY_LLM_CALL_BUDGET: provider requests across all owners per UTC day.
  globalCallBudget: number;
};

// The UTC calendar day used for the daily limits (SPEC §10).
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// The limit that applies to this owner (SPEC §17).
export function dailyLimitFor(deps: SpecDeps, owner: Owner): number {
  return owner.kind === "user" ? deps.dailySpecLimitUser : deps.dailySpecLimit;
}

// Counts one new spec against the owner's daily limit. Called when a spec's first question is requested,
// before any provider is contacted, so a request over the limit never costs a provider call (AC-7).
export async function chargeSpecStart(deps: SpecDeps, owner: Owner): Promise<void> {
  const limit = dailyLimitFor(deps, owner);
  const allowed = await reserveSpecStart(deps.db, usageSubject(owner), utcDay(new Date()), limit);
  if (!allowed) {
    const message =
      owner.kind === "user"
        ? `You have started all ${limit} new specs for today. The limit resets at 00:00 UTC.`
        : `You have started all ${limit} new specs for today as a guest. Sign in for a higher daily limit. The limit resets at 00:00 UTC.`;
    throw new ApiError(429, "daily_limit", message);
  }
}

export async function findOwnedSpec(db: Db, owner: Owner, id: string): Promise<SpecRow> {
  const spec = await getSpec(db, owner, id);
  if (!spec) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return spec;
}

// Lists the owner's specs, newest first (SPEC §10).
export async function listOwnedSpecs(deps: SpecDeps, owner: Owner) {
  return listSpecs(deps.db, owner);
}

// Deletes one of the owner's specs. Another owner's ID gets the same 404 as a missing one.
export async function deleteOwnedSpec(deps: SpecDeps, owner: Owner, id: string): Promise<void> {
  const deleted = await deleteSpec(deps.db, owner, id);
  if (!deleted) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
}

export async function createDraft(deps: SpecDeps, owner: Owner, rawRequest: string) {
  const row = await createSpec(deps.db, owner, rawRequest);
  return { id: row.id };
}

// Saves the interview state and the status together. Returns nothing; a missing row is a 404.
export async function saveInterview(
  deps: SpecDeps,
  owner: Owner,
  id: string,
  interview: unknown,
  status: SpecRow["status"],
): Promise<void> {
  const updated = await updateSpec(deps.db, owner, id, { interview, status });
  if (!updated) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
}

// Legacy specs (SPEC §10) come from the v1 question flow. They have no interview, and a draft is not one of them.
export function isLegacySpec(spec: SpecRow): boolean {
  return spec.interview === null && spec.status !== "draft";
}
