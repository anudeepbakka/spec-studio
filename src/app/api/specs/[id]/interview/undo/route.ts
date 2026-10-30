import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { ownerIdFrom, specIdFrom } from "@/lib/api/request";
import { interviewUndo } from "@/lib/interview/service";
import { getDeps } from "@/lib/server/deps";

type Context = { params: Promise<{ id: string }> };

// POST /api/specs/:id/interview/undo: removes the last answer and asks that question again (SPEC §10).
export async function POST(request: NextRequest, context: Context) {
  try {
    const ownerId = ownerIdFrom(request);
    const id = specIdFrom((await context.params).id);
    return NextResponse.json(await interviewUndo(getDeps(), ownerId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
