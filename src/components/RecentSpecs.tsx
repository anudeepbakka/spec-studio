import Link from "next/link";
import { STATUS_LABELS, } from "@/lib/specs/steps";
import type { SpecStatus } from "@/lib/specs/view";
import { DeleteSpecButton } from "./DeleteSpecButton";

export type RecentSpec = { id: string; title: string; status: SpecStatus; createdAt: string };

// SPEC §11: the owner's specs on the home page, newest first. Each row can be deleted.
export function RecentSpecs({ specs }: { specs: RecentSpec[] }) {
  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
      {specs.map((spec) => (
        <li key={spec.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link href={`/specs/${spec.id}`} className="block truncate font-medium underline-offset-2 hover:underline">
              {spec.title}
            </Link>
            <p className="text-sm text-neutral-600">
              {STATUS_LABELS[spec.status]} · {new Date(spec.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
            </p>
          </div>
          <DeleteSpecButton id={spec.id} />
        </li>
      ))}
    </ul>
  );
}
