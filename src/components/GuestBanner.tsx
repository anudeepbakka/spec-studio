"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

// SPEC §17 and §11: a dismissible guest banner. The dismissal is remembered in this browser.
const KEY = "spec-studio-guest-banner-dismissed";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

export function GuestBanner() {
  // Hidden on the server and until the saved choice is read, so the banner never flashes after a dismiss.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "yes");
    } catch {
      // Storage can be blocked. The banner then shows again on the next visit.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <div role="region" aria-label="Guest mode" className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <p className="flex-1 text-text">
        Create an account to keep your specs across devices and get a higher daily limit.{" "}
        <Link href="/sign-up" className="font-medium text-accent underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss guest notice"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-glass-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
