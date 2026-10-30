import { NextResponse, type NextRequest } from "next/server";
import { OWNER_COOKIE, resolveOwnerId } from "@/lib/owner/owner";

// SPEC §5: sets the anonymous owner cookie on the first visit. Next 16 calls this file "proxy" (formerly "middleware").
export function proxy(request: NextRequest) {
  const { ownerId, isNew } = resolveOwnerId(request.cookies.get(OWNER_COOKIE)?.value);
  const response = NextResponse.next();
  if (isNew) {
    response.cookies.set(OWNER_COOKIE, ownerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  // Skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
