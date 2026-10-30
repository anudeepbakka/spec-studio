import { NextResponse } from "next/server";
import { LLMUnavailableError } from "../llm/errors";

// SPEC §10: every API error is { error: { code, message } }. Messages are safe to show.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Drizzle wraps driver errors, so the Postgres SQLSTATE code may sit on `cause`.
function errorSummary(error: unknown): { name: string; code?: string } {
  if (!(error instanceof Error)) return { name: "unknown" };
  const cause = error.cause as { code?: unknown } | undefined;
  const code = (error as { code?: unknown }).code ?? cause?.code;
  return typeof code === "string" ? { name: error.name, code } : { name: error.name };
}

function errorBody(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Maps any thrown value to a JSON error response. Unknown errors never leak details.
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return errorBody(error.status, error.code, error.message);
  }
  if (error instanceof LLMUnavailableError) {
    return errorBody(
      503,
      "llm_unavailable",
      "The AI service is unavailable right now. Please try again in a moment.",
    );
  }
  // Logs the error name and the Postgres code only. Driver messages can include SQL and user text.
  console.error(JSON.stringify({ event: "api_error", error: errorSummary(error) }));
  return errorBody(500, "internal_error", "Something went wrong. Please try again.");
}
