import Link from "next/link";

// SPEC §12: friendly 404 for missing specs and unknown URLs.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">We could not find that spec.</h1>
      <p className="text-sm text-neutral-600">It may have been deleted, or the link may be wrong.</p>
      <Link href="/" className="text-sm underline underline-offset-2">
        Back to all specs
      </Link>
    </main>
  );
}
