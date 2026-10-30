"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// SPEC §11 primitive: a short fade and slide-in. Reduced motion gets no movement.
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
