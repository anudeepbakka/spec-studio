"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// SPEC §12: the fallback for unexpected render errors. No stack trace is shown.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl px-4 py-16 sm:px-6">
      <Card role="alert" className="w-full space-y-4 p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/15 text-danger">
          <TriangleAlert size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold">Something went wrong.</h1>
        <p className="text-sm text-muted">Please try again. If it keeps happening, wait a moment and reload.</p>
        <Button variant="primary" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />
          Try again
        </Button>
      </Card>
    </main>
  );
}
