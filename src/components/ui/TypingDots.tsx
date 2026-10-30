"use client";

import { motion, useReducedMotion } from "framer-motion";

// SPEC §11 primitive: three dots shown while the next question is being written. Reduced motion holds them still.
export function TypingDots({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
