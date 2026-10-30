"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  applyTheme,
  readSavedThemeChoice,
  saveThemeChoice,
  DEFAULT_THEME_CHOICE,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme/theme";

// SPEC §11: a three-state toggle in the header. Each choice has an icon and a text label, so colour is not the only cue.
const OPTIONS: ReadonlyArray<{ choice: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { choice: "light", label: "Light", Icon: Sun },
  { choice: "dark", label: "Dark", Icon: Moon },
  { choice: "system", label: "System", Icon: Monitor },
];

// The saved choice is read from localStorage. The server render uses the default, and the client reads the saved value after hydration.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changing the choice updates this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readSavedThemeChoice, () => DEFAULT_THEME_CHOICE);

  // With System selected, follow the operating system while the page is open.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    saveThemeChoice(next);
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }

  return (
    <div role="group" aria-label="Theme" className="inline-flex items-center rounded-xl border border-border bg-glass p-0.5">
      {OPTIONS.map(({ choice: option, label, Icon }) => {
        const active = choice === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => select(option)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              active ? "bg-glass-strong text-text shadow-[var(--shadow-accent)]" : "text-muted hover:text-text"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
