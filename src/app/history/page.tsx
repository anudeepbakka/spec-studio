import { connection } from "next/server";
import { AppHeader } from "@/components/AppHeader";
import { HistoryList } from "@/components/HistoryList";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { listOwnedSpecs } from "@/lib/specs/service";

// SPEC §11 History: every spec the browser owns, newest first, with search.
export const instant = false;

export default async function HistoryPage() {
  await connection();
  const ownerId = await currentOwnerId();
  const specs = ownerId ? await listOwnedSpecs(getDeps(), ownerId) : [];
  const now = new Date().toISOString();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted">Every spec saved in this browser.</p>
        </header>
        <HistoryList
          specs={specs.map((spec) => ({ id: spec.id, title: spec.title, status: spec.status, createdAt: spec.createdAt.toISOString() }))}
          now={now}
        />
      </main>
    </>
  );
}
