import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { getDeps } from "@/lib/server/deps";
import { CreateSpecInputSchema } from "@/lib/specs/input";
import { createDraft, listOwnedSpecs } from "@/lib/specs/service";

// GET /api/specs: the owner's specs, newest first (SPEC §10). Summaries only, no spec JSON.
export async function GET(request: NextRequest) {
  try {
    const owner = await getOwner(request);
    const specs = await listOwnedSpecs(getDeps(), owner);
    return NextResponse.json({
      specs: specs.map((spec) => ({ ...spec, createdAt: spec.createdAt.toISOString() })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/specs: creates a draft from the feature request.
export async function POST(request: NextRequest) {
  try {
    const owner = await getOwner(request);
    const input = await readJson(request, CreateSpecInputSchema);
    const result = await createDraft(getDeps(), owner, input.rawRequest);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
