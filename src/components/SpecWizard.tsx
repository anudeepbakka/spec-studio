"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import type { AnswerPayload } from "@/lib/interview/client";
import { parseSseBuffer, readApiFailure } from "@/lib/specs/client";
import { isLegacyView, STATUS_LABELS, stepFor, type Step } from "@/lib/specs/steps";
import type { SpecView } from "@/lib/specs/view";
import { DeleteSpecButton } from "./DeleteSpecButton";
import { GenerateStep } from "./GenerateStep";
import { InterviewStep } from "./InterviewStep";
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
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const id = spec.id;
  const legacy = isLegacyView(spec);
  const step: Step = progress !== null ? "generate" : reviewing ? "interview" : stepFor(spec.status);

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

  // One interview step: next (with or without an answer), undo, or finish. Reloads on success.
  async function interviewAction(path: string, body?: unknown): Promise<boolean> {
    const init: RequestInit =
      body === undefined
        ? { method: "POST" }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    const ok = await change(`/api/specs/${id}/interview/${path}`, init);
    if (ok) await reload();
    return ok;
  }

  async function answer(payload: AnswerPayload) {
    await interviewAction("next", { answer: payload });
  }

  async function undo() {
    if (await interviewAction("undo")) setReviewing(false);
  }

  async function finish() {
    if (await interviewAction("finish")) setReviewing(false);
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
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
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

      {!legacy && <Stepper current={step} />}

      {error && (
        <p role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {legacy && <LegacyView spec={spec} />}

      {!legacy && step === "request" && (
        <section className="space-y-6">
          <blockquote className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
            {spec.rawRequest}
          </blockquote>
          <button type="button" disabled={busy} onClick={() => interviewAction("next")} className={PRIMARY_BUTTON}>
            {busy ? "Starting..." : "Start the interview"}
          </button>
        </section>
      )}

      {!legacy && step === "interview" && spec.interview && (
        <InterviewStep
          turns={spec.interview}
          busy={busy}
          reviewing={spec.status === "interview_done"}
          onAnswer={answer}
          onNext={() => interviewAction("next")}
          onUndo={undo}
          onFinish={finish}
          onBack={() => setReviewing(false)}
        />
      )}

      {!legacy && step === "generate" && (
        <GenerateStep
          progress={progress}
          status={spec.status}
          errorMessage={spec.errorMessage}
          busy={busy}
          onGenerate={generate}
          onCancel={cancelGeneration}
          onReview={() => setReviewing(true)}
          onRefresh={reload}
        />
      )}

      {!legacy && step === "result" && spec.spec && (
        <ResultStep id={id} spec={spec.spec} busy={busy} onRegenerate={generate} />
      )}

      {legacy && spec.spec && <ResultStep id={id} spec={spec.spec} busy={busy} readOnly onRegenerate={generate} />}
    </main>
  );
}

// SPEC §10: a spec from the v1 question flow. It is shown as it was saved and cannot be changed.
function LegacyView({ spec }: { spec: SpecView }) {
  const answerFor = new Map((spec.answers ?? []).map((answer) => [answer.questionId, answer.answer.trim()]));
  return (
    <section className="space-y-6">
      <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
        This spec was made with an earlier version of the question flow. You can read it or delete it.
      </p>
      <blockquote className="whitespace-pre-wrap rounded-md border border-neutral-200 p-4 text-sm">{spec.rawRequest}</blockquote>
      {spec.questions && (
        <ol className="space-y-3 text-sm">
          {spec.questions.map((question) => (
            <li key={question.id}>
              <p className="text-neutral-600">{question.question}</p>
              <p className="font-medium">{answerFor.get(question.id) || "Skipped"}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
