import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { interviewFinish } from "@/lib/interview/service";
import { getDeps } from "@/lib/server/deps";

type Context = { params: Promise<{ id: string }> };

// POST /api/specs/:id/interview/finish: ends the interview early once there are 3 real answers (SPEC §10).
export async function POST(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    return NextResponse.json(await interviewFinish(getDeps(), owner, id));
  } catch (error) {
    return errorResponse(error);
  }
}
