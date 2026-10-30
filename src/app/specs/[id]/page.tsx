import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { getSpec } from "@/lib/db/repo";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { toSpecView } from "@/lib/specs/view";
import { SpecWizard } from "@/components/SpecWizard";

// Rendered per request as a blocking route, so a missing spec gets a real 404 and the wizard hydrates.
export const instant = false;

type Props = { params: Promise<{ id: string }> };

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
