"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import { parseSseBuffer, readApiFailure } from "@/lib/specs/client";
import { STATUS_LABELS, stepFor, type Step } from "@/lib/specs/steps";
import type { Answer } from "@/lib/schemas/questions";
import type { SpecView } from "@/lib/specs/view";
import { DeleteSpecButton } from "./DeleteSpecButton";
import { GenerateStep } from "./GenerateStep";
import { QuestionsStep } from "./QuestionsStep";
import { ResultStep } from "./ResultStep";
import { Stepper } from "./Stepper";
import { PRIMARY_BUTTON } from "./ui";

const ProgressSchema = z.object({ chars: z.number() });

const CONNECTION_MESSAGE = "Could not reach the server. Check your connection and try again.";
const DROPPED_MESSAGE = "The connection dropped while the spec was being written. It may still finish; check again shortly.";

// The server records a cancelled run after the connection closes, so the record is read a moment later.
const CANCEL_SETTLE_MS = 500;

function readChars(data: string): number | null {
  try {
    const parsed = ProgressSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data.chars : null;
  } catch {
    return null;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SPEC §4 and §11: the spec page. The step follows the saved status, so a reload lands on the right step.
export function SpecWizard({ initial }: { initial: SpecView }) {
  const [spec, setSpec] = useState(initial);
  const [editingAnswers, setEditingAnswers] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const id = spec.id;
  const step: Step = progress !== null ? "generate" : editingAnswers ? "questions" : stepFor(spec.status);

  // Re-reads the record so the UI shows what the server saved.
  async function reload() {
    try {
      const response = await fetch(`/api/specs/${id}`, { cache: "no-store" });
      if (!response.ok) {
        setError((await readApiFailure(response)).message);
        return;
      }
      setSpec((await response.json()) as SpecView);
    } catch {
      setError(CONNECTION_MESSAGE);
    }
  }

  // Sends a request that changes the spec. Returns true on success. The caller reloads.
  async function change(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        setError((await readApiFailure(response)).message);
        return false;
      }
      return true;
    } catch {
      setError(CONNECTION_MESSAGE);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function requestQuestions() {
    if (await change(`/api/specs/${id}/questions`, { method: "POST" })) {
      setEditingAnswers(false);
      await reload();
    }
  }

  async function saveAnswers(answers: Answer[]) {
    const ok = await change(`/api/specs/${id}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (ok) {
      setEditingAnswers(false);
      await reload();
    }
  }

  // Streams the run over SSE. Progress updates the counter; the final state comes from a reload,
  // so a cancelled, failed, or dropped run all show what the server actually saved.
  async function generate() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setProgress(0);
    try {
      const response = await fetch(`/api/specs/${id}/generate`, { method: "POST", signal: controller.signal });
      if (!response.ok || !response.body) {
        setError((await readApiFailure(response)).message);
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let chunk = await reader.read();
      while (!chunk.done) {
        const parsed = parseSseBuffer(buffer + chunk.value);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          const chars = event.event === "progress" ? readChars(event.data) : null;
          if (chars !== null) setProgress(chars);
        }
        chunk = await reader.read();
      }
    } catch {
      if (!controller.signal.aborted) setError(DROPPED_MESSAGE);
    } finally {
      controllerRef.current = null;
      setProgress(null);
      if (controller.signal.aborted) await wait(CANCEL_SETTLE_MS);
      await reload();
    }
  }

  function cancelGeneration() {
    controllerRef.current?.abort();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="mb-6 text-sm">
        <Link href="/" className="underline-offset-2 hover:underline">
          All specs
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{spec.title}</h1>
          <p className="text-sm text-neutral-600">{STATUS_LABELS[spec.status]}</p>
        </div>
        <DeleteSpecButton id={id} redirectTo="/" />
      </header>

      <Stepper current={step} />

      {error && (
        <p role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {step === "request" && (
        <section className="space-y-6">
          <blockquote className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
            {spec.rawRequest}
          </blockquote>
          <button type="button" disabled={busy} onClick={requestQuestions} className={PRIMARY_BUTTON}>
            {busy ? "Asking questions..." : "Get clarifying questions"}
          </button>
        </section>
      )}

      {step === "questions" && spec.questions && (
        <QuestionsStep
          key={JSON.stringify(spec.questions)}
          questions={spec.questions}
          answers={spec.answers}
          busy={busy}
          canRegenerate={spec.status === "questions_ready"}
          onSave={saveAnswers}
          onRegenerate={requestQuestions}
        />
      )}

      {step === "generate" && (
        <GenerateStep
          progress={progress}
          status={spec.status === "draft" || spec.status === "questions_ready" ? "answered" : spec.status}
          errorMessage={spec.errorMessage}
          busy={busy}
          onGenerate={generate}
          onCancel={cancelGeneration}
          onEditAnswers={() => setEditingAnswers(true)}
          onRefresh={reload}
        />
      )}

      {step === "result" && spec.spec && (
        <ResultStep id={id} spec={spec.spec} busy={busy} onRegenerate={generate} />
      )}
    </main>
  );
}
