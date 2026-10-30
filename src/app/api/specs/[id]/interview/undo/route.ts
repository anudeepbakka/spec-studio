import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { interviewUndo } from "@/lib/interview/service";
import { getDeps } from "@/lib/server/deps";

type Context = { params: Promise<{ id: string }> };

// POST /api/specs/:id/interview/undo: removes the last answer and asks that question again (SPEC §10).
export async function POST(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    return NextResponse.json(await interviewUndo(getDeps(), owner, id));
  } catch (error) {
    return errorResponse(error);
  }
}
