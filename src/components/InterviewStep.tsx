"use client";

import { useState, type FormEvent } from "react";
import type { AnswerPayload } from "@/lib/interview/client";
import type { Coverage, Turn } from "@/lib/schemas/turn";
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

// SPEC §11 Interview: one question at a time, with the answers so far and what is understood.
// The pending question is keyed by its ID, so its input resets when the next question arrives.

const DIMENSIONS: Array<[keyof Coverage, string]> = [
  ["usersRoles", "Users and roles"],
  ["scope", "Scope"],
  ["businessRules", "Business rules"],
  ["failureCases", "Failure cases"],
  ["nonFunctional", "Non-functional"],
  ["dependencies", "Dependencies"],
];

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
  const pending = turns.at(-1)?.answer === null ? turns.at(-1) : undefined;
  const resolved = turns.filter((turn) => turn.answer !== null);
  const realAnswers = resolved.filter((turn) => turn.answer?.status === "answered").length;
  const latest = turns.at(-1);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_16rem]">
      <section className="min-w-0 space-y-6">
        {resolved.length > 0 && (
          <ol aria-label="Answers so far" className="space-y-3">
            {resolved.map((turn) => (
              <li key={turn.question.id} className="rounded-md bg-neutral-50 p-3 text-sm">
                <p className="text-neutral-600">{turn.question.question}</p>
                <p className="mt-1 font-medium">
                  {turn.answer?.status === "skipped"
                    ? "Skipped"
                    : turn.answer?.status === "not_sure"
                      ? `Not sure${turn.answer.text ? `: ${turn.answer.text}` : ""}`
                      : turn.answer?.text}
                </p>
              </li>
            ))}
          </ol>
        )}

        <div aria-live="polite">
          {pending && <PendingQuestion key={pending.question.id} turn={pending} busy={busy} onAnswer={onAnswer} />}
          {!pending && !reviewing && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">The next question did not load. Try again.</p>
              <button type="button" disabled={busy} onClick={onNext} className={PRIMARY_BUTTON}>
                Ask the next question
              </button>
            </div>
          )}
          {reviewing && <p className="text-sm">The interview is complete. Undo an answer to continue it.</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || resolved.length === 0}
            onClick={onUndo}
            className={SECONDARY_BUTTON}
          >
            Undo last answer
          </button>
          {reviewing ? (
            <button type="button" disabled={busy} onClick={onBack} className={PRIMARY_BUTTON}>
              Back to generate
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || realAnswers < MIN_FINISH_ANSWERS}
              onClick={onFinish}
              className={SECONDARY_BUTTON}
            >
              Finish early and generate
            </button>
          )}
        </div>
        {!reviewing && realAnswers < MIN_FINISH_ANSWERS && (
          <p className="text-xs text-neutral-600">Answer {MIN_FINISH_ANSWERS} questions to finish early.</p>
        )}
      </section>

      <aside aria-label="What I understand so far" className="space-y-4 text-sm">
        {latest && (
          <p className="font-medium">
            Question {latest.index} of up to {MAX_QUESTIONS}
          </p>
        )}
        {latest && (
          <ul className="space-y-1">
            {DIMENSIONS.map(([key, label]) => (
              <li key={key} className="flex justify-between gap-3">
                <span>{label}</span>
                <span className="text-neutral-600">{latest.coverage[key]}</span>
              </li>
            ))}
          </ul>
        )}
        {latest && latest.knownFacts.length > 0 && (
          <div>
            <p className="font-medium">Known so far</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {latest.knownFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function PendingQuestion({
  turn,
  busy,
  onAnswer,
}: {
  turn: Turn;
  busy: boolean;
  onAnswer: (answer: AnswerPayload) => void;
}) {
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
    <form onSubmit={send} className="space-y-4 rounded-md border border-neutral-200 p-4">
      <h2 id={`question-${questionId}`} className="text-base font-semibold">
        {turn.question.question}
      </h2>
      <p className="text-sm text-neutral-600">{turn.question.why}</p>

      {turn.question.type === "choice" && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Options</legend>
          {turn.question.options?.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={questionId}
                value={option}
                checked={choice === option}
                onChange={() => setChoice(option)}
              />
              {option}
            </label>
          ))}
        </fieldset>
      )}

      <label className="block text-sm">
        <span className="sr-only">Your answer</span>
        <input
          type="text"
          maxLength={1000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setChoice(null);
          }}
          placeholder="Type your answer"
          className={INPUT_CLASS}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
          Send
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer({ questionId, answer: "", skipped: true })}
          className={SECONDARY_BUTTON}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer({ questionId, answer: text.trim(), notSure: true })}
          className={SECONDARY_BUTTON}
        >
          Not sure
        </button>
      </div>
    </form>
  );
}
