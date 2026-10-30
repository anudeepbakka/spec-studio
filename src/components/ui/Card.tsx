import type { HTMLAttributes } from "react";

// SPEC §11 primitive: a glass card with a 1px border and a soft shadow.
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-glass shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur-md ${className}`}
      {...props}
    />
  );
}
