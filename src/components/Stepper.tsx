import { STEP_LABELS, type Step } from "@/lib/specs/steps";

const ORDER: Step[] = ["request", "interview", "generate", "result"];

// SPEC §4 and §11: shows where the user is in the four steps. Finished steps are marked.
export function Stepper({ current }: { current: Step }) {
  const currentIndex = ORDER.indexOf(current);
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="grid grid-cols-4 gap-2 text-sm">
        {ORDER.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`border-t-4 pt-2 ${active ? "border-neutral-900 font-semibold" : done ? "border-neutral-500" : "border-neutral-200 text-neutral-500"}`}
            >
              <span className="sr-only">{done ? "Done: " : active ? "Current: " : "Next: "}</span>
              {index + 1}. {STEP_LABELS[step]}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
