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

export const LLM_UNAVAILABLE_MESSAGE = "The AI service is unavailable right now. Please try again in a moment.";

export type ErrorDetails = { status: number; code: string; message: string };

// Maps any thrown value to a status, code and safe message. Unknown errors never leak details.
export function describeError(error: unknown): ErrorDetails {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error instanceof LLMUnavailableError) {
    return { status: 503, code: "llm_unavailable", message: LLM_UNAVAILABLE_MESSAGE };
  }
  // Logs the error name and the Postgres code only. Driver messages can include SQL and user text.
  console.error(JSON.stringify({ event: "api_error", error: errorSummary(error) }));
  return { status: 500, code: "internal_error", message: "Something went wrong. Please try again." };
}

export function errorResponse(error: unknown): NextResponse {
  const { status, code, message } = describeError(error);
  return errorBody(status, code, message);
}
