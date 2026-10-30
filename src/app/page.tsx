import { connection } from "next/server";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { listOwnedSpecs } from "@/lib/specs/service";
import { NewRequestForm } from "@/components/NewRequestForm";
import { RecentSpecs } from "@/components/RecentSpecs";

// SPEC §11 Home: a new request and the owner's recent specs. Each visitor sees their own list, so it renders per request.
export default async function Home() {
  await connection();
  const ownerId = await currentOwnerId();
  const specs = ownerId ? await listOwnedSpecs(getDeps(), ownerId) : [];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Spec Studio</h1>
        <p className="text-sm text-neutral-600">
          Describe a feature in a few sentences. Spec Studio asks clarifying questions, then writes a developer-ready spec.
        </p>
      </header>

      <section aria-labelledby="new-request" className="space-y-4">
        <h2 id="new-request" className="text-lg font-semibold">
          New request
        </h2>
        <NewRequestForm />
      </section>

      <section aria-labelledby="recent-specs" className="space-y-4">
        <h2 id="recent-specs" className="text-lg font-semibold">
          Recent specs
        </h2>
        {specs.length === 0 ? (
          <p className="text-sm text-neutral-600">No specs yet. Your specs are saved in this browser.</p>
        ) : (
          <RecentSpecs
            specs={specs.map((spec) => ({ ...spec, createdAt: spec.createdAt.toISOString() }))}
          />
        )}
      </section>
    </main>
  );
}
