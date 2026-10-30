import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { ApiError } from "../api/errors";
import { OWNER_COOKIE, resolveOwnerId } from "../owner/owner";
import type { Owner } from "../owner/scope";
import { getAuth } from "./auth";

// SPEC §5 and §17: resolves who is acting. A signed-in user is identified by their Better Auth session. A guest is
// identified by the anonymous `ss_owner` cookie. Every spec route, usage check and limit goes through this.

type SessionLookup = (headers: Headers) => Promise<{ user: { id: string } } | null>;

const lookupSession: SessionLookup = async (requestHeaders) => {
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  return result ? { user: { id: result.user.id } } : null;
};

// Returns the owner, or null for a guest with no cookie yet (the proxy sets it on the first page visit).
export async function ownerFrom(
  requestHeaders: Headers,
  cookieValue: string | undefined,
  getSession: SessionLookup = lookupSession,
): Promise<Owner | null> {
  const { ownerId, isNew } = resolveOwnerId(cookieValue);
  const session = await getSession(requestHeaders);
  if (session) {
    return { kind: "user", userId: session.user.id, ownerId };
  }
  if (isNew) {
    return null;
  }
  return { kind: "guest", ownerId };
}

// For route handlers. A request with no owner is refused, so the API never guesses an identity.
export async function getOwner(request: NextRequest): Promise<Owner> {
  const owner = await ownerFrom(request.headers, request.cookies.get(OWNER_COOKIE)?.value);
  if (!owner) {
    throw new ApiError(401, "owner_required", "Open the app in your browser first, so a session cookie is set.");
  }
  return owner;
}

// For server components. Returns null when there is no owner yet, which means there are no specs.
export async function currentOwner(): Promise<Owner | null> {
  const requestHeaders = await headers();
  const store = await cookies();
  return ownerFrom(requestHeaders, store.get(OWNER_COOKIE)?.value);
}

// The signed-in account for server components, or null for a guest (SPEC §11 header, guest banner).
export async function currentUser(): Promise<{ id: string; username: string | null } | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, username: session.user.username ?? null } : null;
}
