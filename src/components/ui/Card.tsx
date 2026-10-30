import type { HTMLAttributes } from "react";

// SPEC §11 primitive: a glass card with a 1px border and a soft shadow.
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-glass shadow-[var(--shadow-card)] backdrop-blur-md ${className}`}
      {...props}
    />
  );
}
