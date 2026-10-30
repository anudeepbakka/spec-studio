import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { specIdFrom } from "@/lib/api/request";
import { getOwner } from "@/lib/auth/identity";
import { exportMarkdown } from "@/lib/specs/export";
import { getDeps } from "@/lib/server/deps";

type Context = { params: Promise<{ id: string }> };

// GET /api/specs/:id/export: the finished spec as a Markdown download (SPEC §7). No LLM run.
export async function GET(request: NextRequest, context: Context) {
  try {
    const owner = await getOwner(request);
    const id = specIdFrom((await context.params).id);
    const { markdown, filename } = await exportMarkdown(getDeps(), owner, id);
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
