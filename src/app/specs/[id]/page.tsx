import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { getSpec } from "@/lib/db/repo";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { toSpecView } from "@/lib/specs/view";
import { SpecWizard } from "@/components/SpecWizard";

type Props = { params: Promise<{ id: string }> };

// SPEC §11 /specs/[id]. The per-request read runs inside Suspense, so the route can prerender its shell.
export default function SpecPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-600">Loading spec...</p>}>
      <SpecContent params={params} />
    </Suspense>
  );
}

// Any other owner's spec, a bad ID, and a missing cookie all show the same not-found page.
async function SpecContent({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ownerId = await currentOwnerId();
  if (!ownerId) notFound();

  const row = await getSpec(getDeps().db, ownerId, id);
  if (!row) notFound();

  return <SpecWizard initial={toSpecView(row)} />;
}
