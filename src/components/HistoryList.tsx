"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { matchesQuery } from "@/lib/specs/format";
import { STATUS_LABELS } from "@/lib/specs/steps";
import { FIELD_CLASS } from "./ui/Field";
import { SpecCard, type SpecSummary } from "./SpecCard";

// SPEC §11 History: a searchable grid of every spec. The search matches the title and the status label.
export function HistoryList({ specs, now }: { specs: SpecSummary[]; now: string }) {
  const [query, setQuery] = useState("");
  const shown = specs.filter((spec) => matchesQuery(spec.title, STATUS_LABELS[spec.status], query));

  return (
    <div className="space-y-6">
      <label className="relative block">
        <span className="sr-only">Search specs</span>
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or status"
          className={`${FIELD_CLASS} pl-11`}
        />
      </label>
      <p className="text-sm text-muted" aria-live="polite">
        {shown.length === specs.length ? `${specs.length} specs` : `${shown.length} of ${specs.length} specs match`}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{specs.length === 0 ? "No specs yet. Start one from the home page." : "No specs match that search."}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((spec) => (
            <li key={spec.id}>
              <SpecCard spec={spec} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
