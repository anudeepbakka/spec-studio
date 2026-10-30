"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// SPEC §17: after sign-in, offer to keep the specs this browser made as a guest. Accepting moves them to the account.
// Accepting again moves nothing. "Not now" hides the offer for this browser session.
const DISMISS_KEY = "spec-studio-claim-dismissed";

type Me = { kind: "guest" | "user"; guestSpecCount: number };

export function ClaimGuestPrompt() {
  const [count, setCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(DISMISS_KEY) === "yes") return;
    fetch("/api/me")
      .then((response) => (response.ok ? (response.json() as Promise<Me>) : null))
      .then((me) => {
        if (me && me.kind === "user" && me.guestSpecCount > 0) setCount(me.guestSpecCount);
      })
      .catch(() => {
        // The offer is optional. A failed check just means no offer.
      });
  }, []);

  if (count === null && !message) return null;

  async function keep() {
    setBusy(true);
    const response = await fetch("/api/account/claim-guest-specs", { method: "POST" });
    if (response.ok) {
      const body = (await response.json()) as { moved: number };
      setMessage(`Kept ${body.moved} ${body.moved === 1 ? "spec" : "specs"} in your account.`);
      setCount(null);
      window.setTimeout(() => setMessage(null), 4000);
    } else {
      setMessage("Those specs could not be moved. Please try again.");
    }
    setBusy(false);
  }

  function notNow() {
    window.sessionStorage.setItem(DISMISS_KEY, "yes");
    setCount(null);
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-2xl border border-border bg-glass p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      {count !== null ? (
        <>
          <p className="text-text">
            Keep my {count} guest {count === 1 ? "spec" : "specs"} in this account?
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={keep} disabled={busy} className="px-3 py-2 text-xs">
              Keep them
            </Button>
            <Button variant="ghost" onClick={notNow} disabled={busy} className="px-3 py-2 text-xs">
              Not now
            </Button>
          </div>
        </>
      ) : (
        <p className="text-text">{message}</p>
      )}
    </div>
  );
}
