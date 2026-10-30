"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type FormEvent } from "react";
import type { AnswerPayload } from "@/lib/interview/client";
import type { Turn } from "@/lib/schemas/turn";
import { CoverageMeter } from "./CoverageMeter";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import { FIELD_CLASS } from "./ui/Field";
import { Progress } from "./ui/Progress";
import { Typewriter } from "./ui/Typewriter";
import { TypingDots } from "./ui/TypingDots";

// SPEC §11 Interview: a chat-style thread on the left, and what is understood so far on the right (sticky on desktop).
// The pending question is keyed by its ID, so its input resets when the next question arrives.

const MAX_QUESTIONS = 8;
const MIN_FINISH_ANSWERS = 3;

type Props = {
  turns: Turn[];
  busy: boolean;
  // Set when the interview is complete and the user is looking back at it (SPEC §11 "Review interview").
  reviewing: boolean;
  onAnswer: (answer: AnswerPayload) => void;
  onNext: () => void;
  onUndo: () => void;
  onFinish: () => void;
  onBack: () => void;
};

export function InterviewStep({ turns, busy, reviewing, onAnswer, onNext, onUndo, onFinish, onBack }: Props) {
  const last = turns.at(-1);
  const pending = last && last.answer === null ? last : undefined;
  const resolved = turns.filter((turn) => turn.answer !== null);
  const realAnswers = resolved.filter((turn) => turn.answer?.status === "answered").length;
  const latest = last;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="min-w-0 space-y-6">
        <ol aria-label="Conversation" className="space-y-4">
          {resolved.map((turn) => (
            <li key={turn.question.id} className="space-y-2">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-glass px-4 py-3 text-sm text-muted">
                {turn.question.question}
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/20 px-4 py-3 text-right text-sm text-text">
                {turn.answer?.status === "skipped"
                  ? "Skipped"
                  : turn.answer?.status === "not_sure"
                    ? `Not sure${turn.answer.text ? `: ${turn.answer.text}` : ""}`
                    : turn.answer?.text}
              </div>
            </li>
          ))}
        </ol>

        <div aria-live="polite" className="space-y-4">
          {pending && (
            <Card className="space-y-4 p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Question {pending.index} of up to {MAX_QUESTIONS}
              </p>
              <h2 id={`question-${pending.question.id}`} className="text-lg font-semibold leading-snug sm:text-xl">
                <Typewriter key={pending.question.id} text={pending.question.question} />
              </h2>
              <p className="text-sm text-muted">Why I am asking: {pending.question.why}</p>
              <PendingAnswer key={pending.question.id} turn={pending} busy={busy} onAnswer={onAnswer} />
            </Card>
          )}
          {!pending && !reviewing && (
            <Card className="space-y-4 p-5">
              {busy ? (
                <TypingDots label="Writing the next question" />
              ) : (
                <>
                  <p className="text-sm text-muted">The next question did not load. Try again.</p>
                  <Button variant="primary" onClick={onNext} disabled={busy}>
                    Ask the next question
                  </Button>
                </>
              )}
            </Card>
          )}
          {reviewing && (
            <Card className="p-5">
              <p className="text-sm">The interview is complete. Undo an answer to continue it.</p>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={onUndo} disabled={busy || resolved.length === 0}>
            Undo last answer
          </Button>
          {reviewing ? (
            <Button variant="primary" onClick={onBack} disabled={busy}>
              Back to generate
            </Button>
          ) : (
            <Button variant="secondary" onClick={onFinish} disabled={busy || realAnswers < MIN_FINISH_ANSWERS}>
              Finish early and generate
            </Button>
          )}
          {!reviewing && realAnswers < MIN_FINISH_ANSWERS && (
            <span className="text-xs text-muted">Answer {MIN_FINISH_ANSWERS} questions to finish early.</span>
          )}
        </div>
      </section>

      <aside aria-label="What I understand so far" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Question {latest?.index ?? 0} of up to {MAX_QUESTIONS}</span>
            <span className="text-muted">{resolved.length} answered</span>
          </div>
          <Progress value={resolved.length / MAX_QUESTIONS} label="Interview progress" />
        </Card>
        {latest && (
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-semibold">Coverage</h3>
            <CoverageMeter coverage={latest.coverage} />
          </Card>
        )}
        {latest && latest.knownFacts.length > 0 && (
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">What I understand so far</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              {latest.knownFacts.map((fact) => (
                <motion.li key={fact} initial={false} className="text-text/90">
                  {fact}
                </motion.li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}

function PendingAnswer({
  turn,
  busy,
  onAnswer,
}: {
  turn: Turn;
  busy: boolean;
  onAnswer: (answer: AnswerPayload) => void;
}) {
  const reduced = useReducedMotion();
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const questionId = turn.question.id;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = (choice ?? text).trim();
    if (!answer) {
      setError("Pick an option, type an answer, or skip the question.");
      return;
    }
    setError(null);
    onAnswer({ questionId, answer });
  }

  return (
    <form onSubmit={send} className="space-y-4">
      {turn.question.type === "choice" && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Options</legend>
          <div className="flex flex-wrap gap-2">
            {turn.question.options?.map((option) => (
              <Chip key={option} pressed={choice === option} onClick={() => setChoice(choice === option ? null : option)} disabled={busy}>
                {option}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="sr-only">Your answer</span>
        <input
          type="text"
          maxLength={1000}
          value={text}
          disabled={busy}
          onChange={(event) => {
            setText(event.target.value);
            setChoice(null);
          }}
          placeholder="Type your answer, or pick an option above"
          className={FIELD_CLASS}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <motion.div whileTap={reduced ? undefined : { scale: 0.98 }}>
          <Button type="submit" variant="primary" disabled={busy}>
            Send
          </Button>
        </motion.div>
        <Button variant="secondary" disabled={busy} onClick={() => onAnswer({ questionId, answer: "", skipped: true })}>
          Skip
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onAnswer({ questionId, answer: text.trim(), notSure: true })}>
          Not sure
        </Button>
      </div>
      {busy && <TypingDots label="Sending" />}
    </form>
  );
}
