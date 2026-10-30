import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { ownerIdFrom, readJson, specIdFrom } from "@/lib/api/request";
import { getDeps } from "@/lib/server/deps";
import { SaveAnswersInputSchema } from "@/lib/specs/input";
import { saveAnswers } from "@/lib/specs/service";

type Context = { params: Promise<{ id: string }> };

// PUT /api/specs/:id/answers: replaces the saved answers. No LLM run.
export async function PUT(request: NextRequest, context: Context) {
  try {
    const ownerId = ownerIdFrom(request);
    const id = specIdFrom((await context.params).id);
    const input = await readJson(request, SaveAnswersInputSchema);
    const result = await saveAnswers(getDeps(), ownerId, id, input.answers);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
