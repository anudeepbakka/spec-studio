import Link from "next/link";
import { connection } from "next/server";
import { SearchX } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";

// SPEC §12: friendly 404 for missing specs and unknown URLs.
export const instant = false;

export default async function NotFound() {
  await connection();
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl px-4 py-16 sm:px-6">
        <Card className="w-full space-y-4 p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <SearchX size={22} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold">We could not find that spec.</h1>
          <p className="text-sm text-muted">It may have been deleted, or the link may be wrong.</p>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-border bg-glass px-4 py-2.5 text-sm font-medium hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Back to all specs
          </Link>
        </Card>
      </main>
    </>
  );
}
