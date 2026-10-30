import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { ownerIdFrom, specIdFrom } from "@/lib/api/request";
import { exportMarkdown } from "@/lib/specs/export";
import { getDeps } from "@/lib/server/deps";

type Context = { params: Promise<{ id: string }> };

// GET /api/specs/:id/export: the finished spec as a Markdown download (SPEC §7). No LLM run.
export async function GET(request: NextRequest, context: Context) {
  try {
    const ownerId = ownerIdFrom(request);
    const id = specIdFrom((await context.params).id);
    const { markdown, filename } = await exportMarkdown(getDeps(), ownerId, id);
    return new NextResponse(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
