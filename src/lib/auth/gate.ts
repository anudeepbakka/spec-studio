import { NextResponse } from "next/server";
import type { Db } from "../db/repo";
import { normalizeUsername, passwordProblem, placeholderEmail, usernameProblem } from "./rules";
import {
  clearFailures,
  hitWindow,
  lockRemainingMs,
  recordFailure,
  SIGN_IN_IP_MAX,
  SIGN_IN_IP_WINDOW_MS,
  SIGN_UP_IP_MAX,
  SIGN_UP_IP_WINDOW_MS,
} from "./rate-limit";

// SPEC §17: the only Better Auth routes this app exposes. Password reset, email verification and every other
// route are blocked, so they are not reachable even though the library ships them.
export const ALLOWED_AUTH_PATHS = ["/get-session", "/sign-in/username", "/sign-up/email", "/sign-out"] as const;

// The path inside /api/auth, for example "/sign-in/username".
export function authPath(pathname: string): string {
  return pathname.replace(/^\/api\/auth/, "") || "/";
}

// The client address from the platform's forwarded header. Best effort (SPEC §17).
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function rateLimited(retryAfterMs: number): NextResponse {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return NextResponse.json(
    { error: { code: "rate_limited", message: `Too many attempts. Try again in ${minutes} minutes.` } },
    { status: 429 },
  );
}

export function invalidCredentials(): NextResponse {
  return NextResponse.json(
    { error: { code: "invalid_credentials", message: "Invalid username or password" } },
    { status: 401 },
  );
}

// Sign-in: per IP, per username lockout, and a generic error (SPEC §17, AC-19, AC-20).
export async function gateSignIn(
  db: Db,
  request: Request,
  handle: () => Promise<Response>,
  now: Date,
): Promise<Response> {
  const body = await readBody(request);
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const ipCheck = await hitWindow(db, `signin-ip:${clientIp(request.headers)}`, SIGN_IN_IP_MAX, SIGN_IN_IP_WINDOW_MS, now);
  if (!ipCheck.allowed) return rateLimited(ipCheck.retryAfterMs);

  const key = `signin-user:${username}`;
  if (username) {
    const locked = await lockRemainingMs(db, key, now);
    if (locked > 0) return rateLimited(locked);
  }

  const response = await handle();
  if (response.ok) {
    if (username) await clearFailures(db, key);
    return response;
  }
  if (response.status === 401 || response.status === 400) {
    if (username && response.status === 401) await recordFailure(db, key, now);
    return invalidCredentials();
  }
  return response;
}

// Sign-up: the password and username rules, a per-IP limit, and a placeholder address (SPEC §17, AC-18, AC-20).
// `handle` receives the body to send on to Better Auth. The caller chooses the request.
export async function gateSignUp(
  db: Db,
  request: Request,
  handle: (body: { email: string; password: string; name: string; username: string }) => Promise<Response>,
  now: Date,
): Promise<Response> {
  const body = await readBody(request);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const problem = usernameProblem(username) ?? passwordProblem(password);
  if (problem) {
    return NextResponse.json({ error: { code: "invalid_input", message: problem } }, { status: 400 });
  }

  const ipCheck = await hitWindow(db, `signup-ip:${clientIp(request.headers)}`, SIGN_UP_IP_MAX, SIGN_UP_IP_WINDOW_MS, now);
  if (!ipCheck.allowed) return rateLimited(ipCheck.retryAfterMs);

  const response = await handle({ email: placeholderEmail(username), password, name: username, username });
  if (response.ok) return response;
  // Better Auth answers a duplicate username or address with 422. Anything else is a generic refusal.
  if (response.status === 422 || response.status === 409) {
    return NextResponse.json({ error: { code: "username_taken", message: "That username is taken." } }, { status: 409 });
  }
  return NextResponse.json(
    { error: { code: "invalid_input", message: "The account could not be created. Check the details and try again." } },
    { status: 400 },
  );
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.clone().json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
