// SPEC §11 primitive: a placeholder block while the result is being written. Decorative, so it is hidden from assistive tech.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-glass-strong ${className}`} />;
}
