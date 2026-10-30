import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { getAuth } from "@/lib/auth/auth";
import { countClaimableSpecs } from "@/lib/auth/account";
import { getOwner } from "@/lib/auth/identity";
import { specsStartedOn } from "@/lib/db/repo";
import { dailyLimitFor, utcDay } from "@/lib/specs/service";
import { usageSubject } from "@/lib/owner/scope";
import { getDeps } from "@/lib/server/deps";

// SPEC §10 and §17: who the browser is, how many guest specs it can keep, and today's limit.
export async function GET(request: NextRequest) {
  try {
    const owner = await getOwner(request);
    const deps = getDeps();
    const session = owner.kind === "user" ? await getAuth().api.getSession({ headers: request.headers }) : null;
    const day = utcDay(new Date());
    return NextResponse.json({
      kind: owner.kind,
      username: session?.user.username ?? undefined,
      guestSpecCount: await countClaimableSpecs(deps.db, owner.ownerId),
      limits: {
        dailySpecs: dailyLimitFor(deps, owner),
        usedToday: await specsStartedOn(deps.db, usageSubject(owner), day),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
