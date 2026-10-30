import { ApiError } from "../api/errors";
import { reserveSpecCall } from "../db/repo";
import type { SpecDeps } from "./service";

// SPEC §10: the most AI requests one spec may make (questions, undo re-asks, generation, and repairs).
export const MAX_LLM_CALLS_PER_SPEC = 12;

// Returns the hook the LLM client calls before each request for this spec. It reserves one call,
// or refuses before any provider is contacted (SPEC §8 call counting).
export function specCallReservation(deps: SpecDeps, ownerId: string, id: string): () => Promise<void> {
  return async () => {
    const reserved = await reserveSpecCall(deps.db, ownerId, id, MAX_LLM_CALLS_PER_SPEC);
    if (!reserved) {
      throw new ApiError(429, "spec_call_limit", "This spec has used its AI calls. Start a new request.");
    }
  };
}
