import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { ownerIdFrom, specIdFrom } from "@/lib/api/request";
import { getDeps } from "@/lib/server/deps";
import { generateQuestions } from "@/lib/specs/service";

type Context = { params: Promise<{ id: string }> };

// POST /api/specs/:id/questions: generates clarifying questions (one LLM run).
export async function POST(request: NextRequest, context: Context) {
  try {
    const ownerId = ownerIdFrom(request);
    const id = specIdFrom((await context.params).id);
    const result = await generateQuestions(getDeps(), ownerId, id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
