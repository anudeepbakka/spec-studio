"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// SPEC §11 primitive: reveals text one character at a time. With reduced motion the full text shows at once.
// It starts when mounted. To replay for new text, give it a new key, as InterviewStep does per question.
export function Typewriter({ text, speed = 18 }: { text: string; speed?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, reduced]);

  const finished = reduced || shown >= text.length;
  return (
    <span>
      {reduced ? text : text.slice(0, shown)}
      {!finished && <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-px animate-pulse bg-text align-middle" />}
    </span>
  );
}
