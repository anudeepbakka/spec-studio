"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Coverage } from "@/lib/schemas/turn";
import { DIMENSION_LABELS } from "@/lib/specs/format";

// SPEC §11: six dimensions, each unknown, partial, or covered. Bars animate when a state changes.
const LEVEL_VALUE = { unknown: 0, partial: 0.5, covered: 1 } as const;
const LEVEL_TEXT = { unknown: "Unknown", partial: "Partial", covered: "Covered" } as const;

export function CoverageMeter({ coverage }: { coverage: Coverage }) {
  const reduced = useReducedMotion();
  return (
    <ul className="space-y-3" aria-label="Coverage of each topic">
      {(Object.keys(DIMENSION_LABELS) as Array<keyof Coverage>).map((key) => {
        const level = coverage[key];
        return (
          <li key={key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{DIMENSION_LABELS[key]}</span>
              <span className={level === "covered" ? "text-success" : level === "partial" ? "text-warning" : "text-muted"}>
                {LEVEL_TEXT[level]}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-glass-strong">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-cyan"
                initial={false}
                animate={{ width: `${LEVEL_VALUE[level] * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
