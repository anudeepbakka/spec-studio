import { NextResponse } from "next/server";

// SPEC §10: liveness check for smoke tests and uptime pings. Does not touch the database.
export function GET() {
  return NextResponse.json({ ok: true });
}
