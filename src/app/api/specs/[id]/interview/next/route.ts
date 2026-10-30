import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { readOptionalJson, specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { interviewNext } from "@/lib/interview/service";
import { getDeps } from "@/lib/server/deps";
import { InterviewAnswerInputSchema } from "@/lib/specs/input";

type Context = { params: Promise<{ id: string }> };

// POST /api/specs/:id/interview/next: saves the answer if one is sent, then returns the pending question,
// the next question, or { done: true }. Safe to repeat: with no answer it returns the pending question (SPEC §10).
export async function POST(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    const input = await readOptionalJson(request, InterviewAnswerInputSchema);
    return NextResponse.json(await interviewNext(getDeps(), owner, id, input.answer));
  } catch (error) {
    return errorResponse(error);
  }
}
