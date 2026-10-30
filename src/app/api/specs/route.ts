import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { ownerIdFrom, readJson } from "@/lib/api/request";
import { getDeps } from "@/lib/server/deps";
import { CreateSpecInputSchema } from "@/lib/specs/input";
import { createDraft } from "@/lib/specs/service";

// POST /api/specs: creates a draft from the feature request.
export async function POST(request: NextRequest) {
  try {
    const ownerId = ownerIdFrom(request);
    const input = await readJson(request, CreateSpecInputSchema);
    const result = await createDraft(getDeps(), ownerId, input.rawRequest);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
