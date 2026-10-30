"use client";

import { useState, type FormEvent } from "react";
import type { Answer, Question } from "@/lib/schemas/questions";
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

type Props = {
  questions: Question[];
  answers: Answer[] | null;
  busy: boolean;
  canRegenerate: boolean;
  onSave: (answers: Answer[]) => void;
  onRegenerate: () => void;
};

// SPEC §4 step 2 and §11: one field per question. Any question can be skipped. A skipped answer is sent as "".
export function QuestionsStep({ questions, answers, busy, canRegenerate, onSave, onRegenerate }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((answers ?? []).map((answer) => [answer.questionId, answer.answer])),
  );

  function setValue(questionId: string, value: string) {
    setValues((previous) => ({ ...previous, [questionId]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(questions.map((question) => ({ questionId: question.id, answer: (values[question.id] ?? "").trim() })));
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <p className="text-sm text-neutral-600">
        Answer what you can. A skipped question becomes an assumption in the spec.
      </p>
      {questions.map((question, index) => (
        <fieldset key={question.id} aria-describedby={`${question.id}-why`} className="space-y-3">
          <legend className="font-medium">
            {index + 1}. {question.question}
          </legend>
          <p id={`${question.id}-why`} className="text-sm text-neutral-600">
            {question.why}
          </p>
          {question.type === "choice" ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={question.id}
                  value=""
                  checked={!values[question.id]}
                  onChange={() => setValue(question.id, "")}
                />
                Skip this question
              </label>
              {question.options?.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={values[question.id] === option}
                    onChange={() => setValue(question.id, option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : (
            <input
              type="text"
              aria-label={question.question}
              maxLength={1000}
              value={values[question.id] ?? ""}
              onChange={(event) => setValue(question.id, event.target.value)}
              placeholder="Type an answer, or leave blank to skip"
              className={INPUT_CLASS}
            />
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
          {busy ? "Saving..." : "Save answers"}
        </button>
        {canRegenerate && (
          <button type="button" disabled={busy} onClick={onRegenerate} className={SECONDARY_BUTTON}>
            Regenerate questions
          </button>
        )}
      </div>
    </form>
  );
}
