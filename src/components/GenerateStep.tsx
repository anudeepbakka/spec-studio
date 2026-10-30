import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./ui";

type Props = {
  // Characters received so far, or null when no run is streaming in this browser.
  progress: number | null;
  status: "answered" | "generating" | "failed" | "done";
  errorMessage: string | null;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onEditAnswers: () => void;
  onRefresh: () => void;
};

// SPEC §11 Generate step: live progress, cancel, and the friendly failure states from §12.
export function GenerateStep({
  progress,
  status,
  errorMessage,
  busy,
  onGenerate,
  onCancel,
  onEditAnswers,
  onRefresh,
}: Props) {
  if (progress !== null) {
    return (
      <section className="space-y-4">
        <p role="status" className="text-sm">
          Writing the spec. {progress.toLocaleString("en-US")} characters received so far.
        </p>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </section>
    );
  }

  if (status === "generating") {
    return (
      <section className="space-y-4">
        <p className="text-sm">A run for this spec is still in progress. It may have been cut off, so check again shortly.</p>
        <button type="button" onClick={onRefresh} className={SECONDARY_BUTTON}>
          Check again
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {status === "failed" && errorMessage && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}
      {status === "answered" && <p className="text-sm">Your answers are saved. Generate the spec when you are ready.</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={onGenerate} className={PRIMARY_BUTTON}>
          {status === "failed" ? "Try again" : "Generate spec"}
        </button>
        <button type="button" disabled={busy} onClick={onEditAnswers} className={SECONDARY_BUTTON}>
          Edit answers
        </button>
      </div>
    </section>
  );
}
