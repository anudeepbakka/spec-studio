import type { NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { OWNER_COOKIE, resolveOwnerId } from "../owner/owner";
import { ApiError } from "./errors";

// Reads the owner from the cookie. The proxy sets the cookie on the first page visit,
// so a request without one has no owner yet and is refused.
export function ownerIdFrom(request: NextRequest): string {
  const { ownerId, isNew } = resolveOwnerId(request.cookies.get(OWNER_COOKIE)?.value);
  if (isNew) {
    throw new ApiError(401, "owner_required", "Open the app in your browser first, so a session cookie is set.");
  }
  return ownerId;
}

// Spec IDs in the URL must be UUIDs. Anything else is "not found", so Postgres never sees a bad ID.
export function specIdFrom(id: string): string {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    throw new ApiError(404, "not_found", "Spec not found.");
  }
  return parsed.data;
}

// Like readJson, but an empty body is allowed and parses as `{}`. Used where the body is optional (interview next).
export async function readOptionalJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = await request.text();
  if (text.trim() === "") {
    const parsed = schema.safeParse({});
    if (!parsed.success) {
      throw new ApiError(400, "invalid_input", parsed.error.issues[0]?.message ?? "The request is invalid.");
    }
    return parsed.data;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", parsed.error.issues[0]?.message ?? "The request is invalid.");
  }
  return parsed.data;
}

// Parses the JSON body with a Zod schema. Schema messages are written to be shown to users.
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", parsed.error.issues[0]?.message ?? "The request is invalid.");
  }
  return parsed.data;
}
