"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

// SPEC §11 and §17: the signed-in user menu. Shows the username, My specs, Sign out, and Delete my account with a
// confirmation step. Escape closes the menu.
export function AccountMenu({ username }: { username: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    router.replace("/");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "delete" }),
    });
    if (!response.ok) {
      setBusy(false);
      setError("The account could not be deleted. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-glass px-3 py-2 text-sm font-medium text-text hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <User size={14} aria-hidden="true" />
        <span className="max-w-[9rem] truncate">{username ?? "Account"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 space-y-1 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-card)]">
          <Link
            role="menuitem"
            href="/history"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-text hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            My specs
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>

          <div className="border-t border-border pt-2">
            {confirming ? (
              <div className="space-y-2 px-1 pb-1">
                <p className="text-xs text-muted">
                  This removes your account and every spec saved to it. It cannot be undone. Guest specs in this browser are not affected.
                </p>
                {error ? (
                  <p role="alert" className="text-xs text-danger">
                    {error}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="danger" onClick={deleteAccount} disabled={busy} className="flex-1 px-3 py-2 text-xs">
                    Delete my account and all my specs
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy} className="px-3 py-2 text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                role="menuitem"
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete my account
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
