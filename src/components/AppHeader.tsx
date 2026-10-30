import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// SPEC §11: the top bar on every page. Brand on the left, history on the right.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-strong to-cyan text-white">
            <Sparkles size={15} aria-hidden="true" />
          </span>
          Spec Studio
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link href="/history" className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-glass hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            History
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
