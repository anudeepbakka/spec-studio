import { NextResponse, type NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { claimGuestSpecs } from "@/lib/auth/account";
import { getOwner } from "@/lib/auth/identity";
import { getDeps } from "@/lib/server/deps";
import { utcDay } from "@/lib/specs/service";

// POST /api/account/claim-guest-specs: moves this browser's guest specs to the signed-in user (SPEC §17).
// Idempotent. Returns how many specs moved (zero on a second call).
export async function POST(request: NextRequest) {
  try {
    const owner = await getOwner(request);
    if (owner.kind !== "user") {
      throw new ApiError(401, "sign_in_required", "Sign in to keep your guest specs.");
    }
    const result = await claimGuestSpecs(getDeps().db, owner.userId, owner.ownerId, utcDay(new Date()));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
