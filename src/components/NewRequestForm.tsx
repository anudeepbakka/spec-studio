"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { readApiFailure } from "@/lib/specs/client";
import { CreateSpecInputSchema } from "@/lib/specs/input";
import { INPUT_CLASS, PRIMARY_BUTTON } from "./ui";

const MAX_LENGTH = 4000;

// SPEC §4 step 1: the feature request. The same limits as the server are checked here first.
export function NewRequestForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor="raw-request" className="text-sm font-medium">
          Feature request
        </label>
        <span id="raw-request-count" className="text-xs text-neutral-600">
          {text.length} / {MAX_LENGTH}
        </span>
      </div>
      <textarea
        id="raw-request"
        name="rawRequest"
        rows={6}
        maxLength={MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby={error ? "raw-request-error raw-request-count" : "raw-request-count"}
        aria-invalid={error ? true : undefined}
        placeholder="For example: Let users export their order history as a CSV file from the account page."
        className={INPUT_CLASS}
      />
      {error && (
        <p id="raw-request-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? "Creating..." : "Create spec"}
      </button>
    </form>
  );
}
