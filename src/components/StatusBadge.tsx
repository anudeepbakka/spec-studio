import { STATUS_LABELS } from "@/lib/specs/steps";
import type { SpecStatus } from "@/lib/specs/view";
import { Badge, type Tone } from "./ui/Badge";

// SPEC §11: every spec status has a tone and a plain label.
const TONE: Record<SpecStatus, Tone> = {
  draft: "neutral",
  interviewing: "violet",
  interview_done: "cyan",
  generating: "warning",
  done: "success",
  failed: "danger",
  questions_ready: "neutral",
  answered: "neutral",
};

export function StatusBadge({ status }: { status: SpecStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}
