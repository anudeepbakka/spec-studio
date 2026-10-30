import type { Owner } from "../owner/scope";
import { toMarkdown } from "../export/markdown";
import { ApiError } from "../api/errors";
import { SpecSchema } from "../schemas/spec";
import { findOwnedSpec, type SpecDeps } from "./service";

// SPEC §7 and §10: the Markdown export of a finished spec.

// A title such as "Password reset!" becomes "password-reset", so the download name is safe on every OS.
export function exportFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "spec"}.md`;
}

export async function exportMarkdown(
  deps: SpecDeps,
  owner: Owner,
  id: string,
): Promise<{ markdown: string; filename: string }> {
  const row = await findOwnedSpec(deps.db, owner, id);
  if (row.status !== "done" || !row.spec) {
    throw new ApiError(409, "invalid_state", "The spec is not ready to export yet.");
  }
  const spec = SpecSchema.parse(row.spec);
  return { markdown: toMarkdown(spec), filename: exportFilename(spec.title) };
}
