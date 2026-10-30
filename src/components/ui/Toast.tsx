"use client";

import { AnimatePresence, motion } from "framer-motion";

// SPEC §11 primitive: a short confirmation that appears and goes away. Announced with role="status".
export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm shadow-xl"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
