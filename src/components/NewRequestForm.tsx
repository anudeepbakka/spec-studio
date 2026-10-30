"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EXAMPLE_REQUESTS } from "@/lib/specs/format";
import { readApiFailure } from "@/lib/specs/client";
import { CreateSpecInputSchema } from "@/lib/specs/input";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { FIELD_CLASS } from "./ui/Field";

const MAX_LENGTH = 4000;

// SPEC §11 Home: the prompt box. It grows with the text, Enter submits, Shift+Enter adds a line, and example chips fill it.
export function NewRequestForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  function grow(element: HTMLTextAreaElement | null) {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const parsed = CreateSpecInputSchema.safeParse({ rawRequest: text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the request and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/specs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError((await readApiFailure(response)).message);
        setBusy(false);
        return;
      }
      const { id } = (await response.json()) as { id: string };
      router.push(`/specs/${id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  function fill(example: string) {
    setText(example);
    setError(null);
    requestAnimationFrame(() => {
      grow(textarea.current);
      textarea.current?.focus();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-2xl border border-border bg-glass p-3 shadow-[0_30px_60px_-40px_rgba(139,92,246,0.6)] backdrop-blur-md focus-within:border-accent/60">
          <label htmlFor="raw-request" className="sr-only">
            Feature request
          </label>
          <textarea
            id="raw-request"
            ref={textarea}
            rows={2}
            maxLength={MAX_LENGTH}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              grow(event.target);
            }}
            onKeyDown={onKeyDown}
            aria-describedby="raw-request-help"
            aria-invalid={error ? true : undefined}
            placeholder="Describe a feature. For example: let admins export order history as a CSV file."
            className={`${FIELD_CLASS} max-h-72 resize-none border-transparent bg-transparent px-2 py-2 text-base focus-visible:outline-none`}
          />
          <div className="flex items-center justify-between gap-3 px-2 pt-2">
            <p id="raw-request-help" className="text-xs text-muted">
              <span aria-live="off">{text.length} / {MAX_LENGTH}</span> · Enter to create, Shift+Enter for a new line
            </p>
            <Button type="submit" variant="primary" disabled={busy} className="px-4 py-2">
              {busy ? "Creating..." : "Create spec"}
              {!busy && <ArrowRight size={16} aria-hidden="true" />}
            </Button>
          </div>
        </div>
        {error && (
          <p id="raw-request-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      <div className="flex flex-wrap gap-2" aria-label="Example requests">
        {EXAMPLE_REQUESTS.map((example) => (
          <Chip key={example} onClick={() => fill(example)} className="max-w-full text-xs sm:text-sm">
            {example}
          </Chip>
        ))}
      </div>
    </div>
  );
}
