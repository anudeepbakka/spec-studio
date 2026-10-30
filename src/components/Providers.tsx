"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// SPEC §11: motion follows the user's reduced-motion setting everywhere (framer-motion reads it per component).
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
