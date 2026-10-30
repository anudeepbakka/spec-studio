import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { getSpec } from "@/lib/db/repo";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { toSpecView } from "@/lib/specs/view";
import { SpecWizard } from "@/components/SpecWizard";

type Props = { params: Promise<{ id: string }> };

// SPEC §11 /specs/[id]. The record is read on the server, so the page renders with its data.
// Any other owner's spec, a bad ID, and a missing cookie all show the same not-found page.
export default async function SpecPage({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ownerId = await currentOwnerId();
  if (!ownerId) notFound();

  const row = await getSpec(getDeps().db, ownerId, id);
  if (!row) notFound();

  return <SpecWizard initial={toSpecView(row)} />;
}
