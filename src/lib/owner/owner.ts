import { randomUUID } from "node:crypto";
import { z } from "zod";

// SPEC §5: anonymous owner identity. The `ss_owner` cookie holds a random UUID.
export const OWNER_COOKIE = "ss_owner";

const ownerIdSchema = z.uuid();

// Returns the owner ID from the cookie, or a fresh one when the cookie is missing or not a UUID.
export function resolveOwnerId(cookieValue: string | undefined): { ownerId: string; isNew: boolean } {
  const parsed = ownerIdSchema.safeParse(cookieValue);
  if (parsed.success) {
    return { ownerId: parsed.data, isNew: false };
  }
  return { ownerId: randomUUID(), isNew: true };
}
