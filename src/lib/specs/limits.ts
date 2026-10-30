import { ApiError } from "../api/errors";
import { reserveGlobalCall, reserveSpecCall } from "../db/repo";
import type { Owner } from "../owner/scope";
import { utcDay, type SpecDeps } from "./service";

// SPEC §10: the most AI requests one spec may make (questions, undo re-asks, generation, and repairs).
export const MAX_LLM_CALLS_PER_SPEC = 12;

// Returns the hook the LLM client calls before each provider request (SPEC §8 call counting). It reserves one call
// on the spec, then one unit of the global daily budget. Either refusal happens before any provider is contacted.
export function specCallReservation(deps: SpecDeps, owner: Owner, id: string): () => Promise<void> {
  return async () => {
    const reserved = await reserveSpecCall(deps.db, owner, id, MAX_LLM_CALLS_PER_SPEC);
    if (!reserved) {
      throw new ApiError(429, "spec_call_limit", "This spec has used its AI calls. Start a new request.");
    }
    const withinBudget = await reserveGlobalCall(deps.db, utcDay(new Date()), deps.globalCallBudget);
    if (!withinBudget) {
      throw new ApiError(429, "demo_capacity", "Demo capacity reached for today, come back tomorrow.");
    }
  };
}
