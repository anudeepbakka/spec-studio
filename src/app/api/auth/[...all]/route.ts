import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { getAuth } from "@/lib/auth/auth";
import { ALLOWED_AUTH_PATHS, authPath, gateSignIn, gateSignUp } from "@/lib/auth/gate";
import { getDeps } from "@/lib/server/deps";

// SPEC §17: the Better Auth handler, behind the gate. Only the paths in ALLOWED_AUTH_PATHS are reachable.
function notFound(): NextResponse {
  return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
}

// A copy of the request with a new JSON body. The old content-length no longer matches, so it is dropped.
function withJsonBody(request: Request, body: unknown): Request {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Request(request.url, { method: "POST", headers, body: JSON.stringify(body) });
}

async function handle(request: NextRequest): Promise<Response> {
  const path = authPath(request.nextUrl.pathname);
  if (!(ALLOWED_AUTH_PATHS as readonly string[]).includes(path)) return notFound();

  const handlers = toNextJsHandler(getAuth());
  const db = getDeps().db;
  const now = new Date();
  try {
    if (request.method === "POST" && path === "/sign-in/username") {
      return await gateSignIn(db, request, () => handlers.POST(request), now);
    }
    if (request.method === "POST" && path === "/sign-up/email") {
      return await gateSignUp(db, request, (body) => handlers.POST(withJsonBody(request, body)), now);
    }
    if (request.method === "GET") return await handlers.GET(request);
    if (request.method === "POST") return await handlers.POST(request);
    return notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
