"use client";

import { motion, useReducedMotion } from "framer-motion";

// SPEC §11 primitive: an animated bar. `value` is between 0 and 1.
export function Progress({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-full overflow-hidden rounded-full bg-glass-strong">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent to-cyan"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}
