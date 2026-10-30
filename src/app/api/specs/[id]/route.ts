import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { getDeps } from "@/lib/server/deps";
import { deleteOwnedSpec, findOwnedSpec } from "@/lib/specs/service";
import { toSpecView } from "@/lib/specs/view";

type Context = { params: Promise<{ id: string }> };

// GET /api/specs/:id: the full record (SPEC §10).
export async function GET(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    const row = await findOwnedSpec(getDeps().db, owner, id);
    return NextResponse.json(toSpecView(row));
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/specs/:id: removes the owner's spec. No LLM run.
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    await deleteOwnedSpec(getDeps(), owner, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
