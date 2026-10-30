import type { ButtonHTMLAttributes } from "react";

// SPEC §11 primitive. Visible focus ring, disabled state, and four variants.
type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-accent-strong to-accent text-white shadow-[var(--shadow-accent)] hover:brightness-110",
  secondary: "border border-border bg-glass text-text hover:bg-glass-strong",
  ghost: "text-muted hover:bg-glass hover:text-text",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
