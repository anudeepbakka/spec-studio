"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiFailure } from "@/lib/specs/client";
import { DANGER_BUTTON } from "./ui";

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
      <button type="button" onClick={remove} disabled={busy} className={DANGER_BUTTON}>
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
