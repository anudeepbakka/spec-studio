"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiFailure } from "@/lib/specs/client";
import { Button } from "./ui/Button";

// SPEC §11: deletes a spec after a confirmation. On the result page, `redirectTo` leaves the deleted spec's URL.
export function DeleteSpecButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this spec? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/specs/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError((await readApiFailure(response)).message);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="danger" onClick={remove} disabled={busy} aria-label="Delete spec" className="px-3">
        <Trash2 size={16} aria-hidden="true" />
        <span>{busy ? "Deleting..." : "Delete"}</span>
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
