import type { ReactNode } from "react";

export type Tone = "neutral" | "violet" | "cyan" | "success" | "warning" | "danger" | "must" | "should" | "could";

// SPEC §11 primitive: status and priority badges. Colour is never the only cue: each badge also carries its text.
const TONES: Record<Tone, string> = {
  neutral: "border-border bg-glass text-muted",
  violet: "border-accent/40 bg-accent/15 text-[#ddd6fe]",
  cyan: "border-cyan/40 bg-cyan/10 text-[#a5f3fc]",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  must: "border-priority-must/50 bg-priority-must/10 text-priority-must",
  should: "border-priority-should/50 bg-priority-should/10 text-priority-should",
  could: "border-priority-could/50 bg-priority-could/10 text-priority-could",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
