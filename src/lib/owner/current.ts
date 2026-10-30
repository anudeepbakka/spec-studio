import { cookies } from "next/headers";
import { OWNER_COOKIE, resolveOwnerId } from "./owner";

// For server components. Returns null when the browser has no owner cookie yet,
// which means it has no specs. The proxy sets the cookie on the response, so it is not visible here on the first visit.
export async function currentOwnerId(): Promise<string | null> {
  const store = await cookies();
  const { ownerId, isNew } = resolveOwnerId(store.get(OWNER_COOKIE)?.value);
  return isNew ? null : ownerId;
}
