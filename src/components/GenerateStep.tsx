"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Circle, Loader2, Sparkles } from "lucide-react";
import { estimatedProgress, GENERATION_STAGES, stageForProgress } from "@/lib/specs/format";
import type { SpecStatus } from "@/lib/specs/view";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Progress } from "./ui/Progress";
import { Skeleton } from "./ui/Skeleton";

type Props = {
  // Characters received so far, or null when no run is streaming in this browser.
  progress: number | null;
  status: SpecStatus;
  errorMessage: string | null;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onReview: () => void;
  onRefresh: () => void;
};

// SPEC §11 Generating: the stages advance with the streamed count, with a live counter, cancel, and a skeleton of the result.
export function GenerateStep({ progress, status, errorMessage, busy, onGenerate, onCancel, onReview, onRefresh }: Props) {
  const reduced = useReducedMotion();

  if (progress !== null) {
    const active = stageForProgress(progress);
    return (
      <section aria-labelledby="generating-title" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 id="generating-title" className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} aria-hidden="true" className="text-accent" />
            Writing your spec
          </h2>
          <ol className="space-y-3">
            {GENERATION_STAGES.map((stage, index) => {
              const done = index < active;
              const current = index === active;
              return (
                <li key={stage} className="flex items-center gap-3 text-sm" aria-current={current ? "step" : undefined}>
                  {done ? (
                    <Check size={16} aria-hidden="true" className="text-success" />
                  ) : current ? (
                    <Loader2 size={16} aria-hidden="true" className={`text-accent ${reduced ? "" : "animate-spin"}`} />
                  ) : (
                    <Circle size={16} aria-hidden="true" className="text-muted/60" />
                  )}
                  <span className={done ? "text-muted" : current ? "font-medium text-text" : "text-muted/80"}>
                    {stage}
                    <span className="sr-only">{done ? " (done)" : current ? " (in progress)" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <p role="status" className="text-sm text-muted">
              {progress.toLocaleString("en-US")} characters received
            </p>
            <Progress value={estimatedProgress(progress)} label="Estimated progress" />
          </div>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <div aria-hidden="true" className="space-y-3 pt-2">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-6 h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </section>
    );
  }

  if (status === "generating") {
    return (
      <Card className="space-y-4 p-6">
        <p className="text-sm text-muted">A run for this spec is still in progress. It may have been cut off, so check again shortly.</p>
        <Button onClick={onRefresh}>Check again</Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-6">
      <AnimatePresence initial={false}>
        {status === "failed" && errorMessage && (
          <motion.p
            key="error"
            role="alert"
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{status === "failed" ? "The spec did not finish" : "Ready to write your spec"}</h2>
        <p className="text-sm text-muted">
          {status === "failed"
            ? "Your interview is kept. You can try again, or review the answers first."
            : "The interview is complete. Generation uses your answers and the questions you were asked."}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={busy} onClick={onGenerate}>
          {status === "failed" ? "Try again" : "Generate spec"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onReview}>
          Review interview
        </Button>
      </div>
    </Card>
  );
}
