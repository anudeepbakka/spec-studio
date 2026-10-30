"use client";

import { useState } from "react";
import type { Spec } from "@/lib/schemas/spec";
import { SpecSections } from "./SpecSections";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

type Props = {
  id: string;
  spec: Spec;
  busy: boolean;
  // Legacy specs are read-only, so they have no regenerate action (SPEC §10).
  readOnly?: boolean;
  onRegenerate: () => void;
};

// SPEC §11 Result: the finished spec with copy, download, and regenerate.
export function ResultStep({ id, spec, busy, readOnly = false, onRegenerate }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // The Markdown comes from the export endpoint, so copy and download produce the same file (SPEC §7).
  async function copyMarkdown() {
    setCopyState("idle");
    try {
      const response = await fetch(`/api/specs/${id}/export`, { cache: "no-store" });
      if (!response.ok) throw new Error("export failed");
      await navigator.clipboard.writeText(await response.text());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="space-y-6">
      <p className="text-base">{spec.summary}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={copyMarkdown} className={PRIMARY_BUTTON}>
          Copy Markdown
        </button>
        <a href={`/api/specs/${id}/export`} download className={SECONDARY_BUTTON}>
          Download .md
        </a>
        {!readOnly && (
          <button type="button" disabled={busy} onClick={onRegenerate} className={SECONDARY_BUTTON}>
            Regenerate
          </button>
        )}
        <span role="status" className="text-sm text-neutral-700">
          {copyState === "copied" && "Copied to clipboard."}
          {copyState === "failed" && "Copy failed. Use Download .md instead."}
        </span>
      </div>
      <SpecSections spec={spec} />
    </section>
  );
}
