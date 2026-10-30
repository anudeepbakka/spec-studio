import { and, eq, isNull, type SQL } from "drizzle-orm";
import { specs } from "../db/schema";

// SPEC §5 and §17: who is acting. A guest is identified by the `ss_owner` cookie. A signed-in user is identified by
// their account, and the cookie still ties their specs to this browser for claiming.
export type Owner = { kind: "guest"; ownerId: string } | { kind: "user"; userId: string; ownerId: string };

// The key for daily counters (SPEC §5): `guest:<owner_id>` or `user:<user_id>`.
export function usageSubject(owner: Owner): string {
  return owner.kind === "user" ? `user:${owner.userId}` : `guest:${owner.ownerId}`;
}

// The rows an owner may see (SPEC §5). A user's scope is their user_id. A guest's scope is the cookie, and only
// specs that were not claimed. No query may use anything from the request body for identity.
export function specScope(owner: Owner): SQL {
  if (owner.kind === "user") {
    return eq(specs.userId, owner.userId);
  }
  return and(eq(specs.ownerId, owner.ownerId), isNull(specs.userId)) as SQL;
}
