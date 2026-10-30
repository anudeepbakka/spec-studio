import type { ZodType } from "zod";
import type { ChatMessage } from "./types";

// Models often wrap JSON in a Markdown code fence. Remove one fence if present.
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return (fenced ? fenced[1] : trimmed).trim();
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

// Parses model output as JSON and validates it with Zod.
// Errors are short, readable lines that the repair prompt can quote back.
export function parseAndValidate<T>(schema: ZodType<T, unknown>, raw: string): ParseResult<T> {
  let data: unknown;
  try {
    data = JSON.parse(stripCodeFences(raw));
  } catch {
    return { ok: false, errors: ["response is not valid JSON"] };
  }

  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}

// SPEC §8: one repair call. It keeps the original task, adds the bad output
// and the validation errors, and asks for corrected JSON only.
export function buildRepairMessages(
  original: ChatMessage[],
  badOutput: string,
  errors: string[],
): ChatMessage[] {
  return [
    ...original,
    { role: "assistant", content: badOutput },
    {
      role: "user",
      content: [
        "Your previous answer was not valid. Validation errors:",
        ...errors.map((error) => `- ${error}`),
        "",
        "Return the corrected JSON only, with no other text.",
      ].join("\n"),
    },
  ];
}
