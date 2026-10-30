import { STEP_LABELS, type Step } from "@/lib/specs/steps";

const ORDER: Step[] = ["request", "interview", "generate", "result"];

// SPEC §4 and §11: where the user is in the four steps. Finished steps are marked with a check.
export function Stepper({ current }: { current: Step }) {
  const currentIndex = ORDER.indexOf(current);
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-2 text-sm">
        {ORDER.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                  active
                    ? "border-accent bg-accent text-white"
                    : done
                      ? "border-success/50 bg-success/10 text-success"
                      : "border-border text-muted"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className={`truncate ${active ? "font-semibold text-text" : done ? "text-muted" : "text-muted/80"}`}>
                <span className="sr-only">{done ? "Done: " : active ? "Current: " : "Next: "}</span>
                {STEP_LABELS[step]}
              </span>
              {index < ORDER.length - 1 && <span aria-hidden="true" className="ml-1 hidden h-px flex-1 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
