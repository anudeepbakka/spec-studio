"use client";

// SPEC §12: the fallback for unexpected render errors. No stack trace is shown.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">Something went wrong.</h1>
      <p className="text-sm text-neutral-600">Please try again. If it keeps happening, wait a moment and reload.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Try again
      </button>
    </main>
  );
}
