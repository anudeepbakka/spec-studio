import Link from "next/link";
import { relativeDate } from "@/lib/specs/format";
import type { SpecStatus } from "@/lib/specs/view";
import { Card } from "./ui/Card";
import { DeleteSpecButton } from "./DeleteSpecButton";
import { StatusBadge } from "./StatusBadge";

export type SpecSummary = { id: string; title: string; status: SpecStatus; createdAt: string };

// SPEC §11: a spec in the grid on home and in history. The title links to the spec, and delete sits beside the badge.
// `now` is an ISO time passed from the server, so the server and the browser show the same relative date.
export function SpecCard({ spec, now }: { spec: SpecSummary; now: string }) {
  return (
    <Card className="flex flex-col gap-4 p-5 transition duration-200 hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={spec.status} />
        <DeleteSpecButton id={spec.id} />
      </div>
      <Link
        href={`/specs/${spec.id}`}
        className="line-clamp-2 min-w-0 rounded-md text-base font-semibold leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:text-accent"
      >
        {spec.title}
      </Link>
      <p className="mt-auto text-sm text-muted">
        <time dateTime={spec.createdAt}>{relativeDate(spec.createdAt, new Date(now))}</time>
      </p>
    </Card>
  );
}
