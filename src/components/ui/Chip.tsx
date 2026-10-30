import type { ButtonHTMLAttributes } from "react";

// SPEC §11 primitive: a selectable chip for choice answers and example requests. `pressed` is announced to assistive tech.
export function Chip({
  pressed,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`rounded-full border px-4 py-2 text-left text-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 ${
        pressed ? "border-accent bg-accent/20 text-text" : "border-border bg-glass text-muted hover:bg-glass-strong hover:text-text"
      } ${className}`}
      {...props}
    />
  );
}
