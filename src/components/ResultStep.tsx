"use client";

import { Download, RefreshCw, Copy } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Spec } from "@/lib/schemas/spec";
import { DeleteSpecButton } from "./DeleteSpecButton";
import { Badge, type Tone } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Toast } from "./ui/Toast";

type Props = { id: string; spec: Spec; busy: boolean; readOnly?: boolean; onRegenerate: () => void };

const SIZE_TONE: Record<"S" | "M" | "L", Tone> = { S: "success", M: "warning", L: "danger" };
const PRIORITY_TONE: Record<"must" | "should" | "could", Tone> = { must: "must", should: "should", could: "could" };
const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "stories", label: "User stories" },
  { id: "edge-cases", label: "Edge cases" },
  { id: "open-questions", label: "Open questions" },
  { id: "tasks", label: "Tasks" },
] as const;

// SPEC §11 Result: a sticky section nav, stat chips, story cards with Given/When/Then, linked edge cases, and tasks.
export function ResultStep({ id, spec, busy, readOnly = false, onRegenerate }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const criteria = spec.userStories.reduce((total, story) => total + story.acceptanceCriteria.length, 0);
  const stats = [
    `${spec.userStories.length} stories`,
    `${criteria} criteria`,
    `${spec.edgeCases.length} edge cases`,
    `${spec.tasks.length} tasks`,
  ];

  function announce(message: string) {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }

  // The Markdown comes from the export endpoint, so copy and download produce the same file (SPEC §7).
  async function copyMarkdown() {
    try {
      const response = await fetch(`/api/specs/${id}/export`, { cache: "no-store" });
      if (!response.ok) throw new Error("export failed");
      await navigator.clipboard.writeText(await response.text());
      announce("Markdown copied");
    } catch {
      announce("Copy failed. Use Download instead.");
    }
  }

  function linkedStories(ids: string[]) {
    return ids.filter((storyId) => spec.userStories.some((story) => story.id === storyId));
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted hover:bg-glass hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-10">
        <header id="summary" className="scroll-mt-24 space-y-5">
          <p className="text-base leading-relaxed text-text/90">{spec.summary}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Totals">
            {stats.map((stat) => (
              <li key={stat}>
                <Badge tone="violet">{stat}</Badge>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={copyMarkdown}>
              <Copy size={16} aria-hidden="true" />
              Copy Markdown
            </Button>
            <a
              href={`/api/specs/${id}/export`}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-glass px-4 py-2.5 text-sm font-medium hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Download size={16} aria-hidden="true" />
              Download .md
            </a>
            {!readOnly && (
              <Button variant="secondary" disabled={busy} onClick={onRegenerate}>
                <RefreshCw size={16} aria-hidden="true" />
                Regenerate
              </Button>
            )}
            <DeleteSpecButton id={id} redirectTo="/" />
            <Link href="/" className="ml-auto text-sm text-muted underline-offset-2 hover:text-text hover:underline">
              New request
            </Link>
          </div>
        </header>

        <section id="stories" aria-labelledby="stories-title" className="scroll-mt-24 space-y-4">
          <h2 id="stories-title" className="text-lg font-semibold">User stories</h2>
          {spec.userStories.map((story) => {
            const active = highlight.includes(story.id);
            return (
              <Card
                key={story.id}
                id={`story-${story.id}`}
                className={`scroll-mt-24 space-y-4 p-5 transition duration-300 ${active ? "border-accent shadow-[0_0_0_1px_rgba(139,92,246,0.6)]" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{story.id}</span>
                  <Badge tone={PRIORITY_TONE[story.priority]}>{story.priority}</Badge>
                </div>
                <p className="text-base leading-relaxed">
                  As a <span className="font-medium">{story.role}</span>, I want {story.want}, so that {story.benefit}.
                </p>
                <ul className="space-y-3">
                  {story.acceptanceCriteria.map((criterion) => (
                    <li key={criterion.id} className="rounded-xl border border-border/70 bg-canvas/40 p-3">
                      <p className="mb-2 font-mono text-xs text-muted">{criterion.id}</p>
                      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-cyan">Given</dt>
                        <dd>{criterion.given}</dd>
                        <dt className="text-cyan">When</dt>
                        <dd>{criterion.when}</dd>
                        <dt className="text-cyan">Then</dt>
                        <dd>{criterion.then}</dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </section>

        <section id="edge-cases" aria-labelledby="edge-title" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="edge-title" className="text-lg font-semibold">Edge cases</h2>
            <p className="text-xs text-muted">Hover or focus a case to highlight its stories.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {spec.edgeCases.map((edgeCase) => {
              const stories = linkedStories(edgeCase.relatedStoryIds);
              return (
                <li key={edgeCase.id}>
                  <Card
                    tabIndex={0}
                    onMouseEnter={() => setHighlight(stories)}
                    onMouseLeave={() => setHighlight([])}
                    onFocus={() => setHighlight(stories)}
                    onBlur={() => setHighlight([])}
                    className="h-full space-y-2 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <p className="font-mono text-xs text-muted">{edgeCase.id}</p>
                    <p className="font-medium">{edgeCase.scenario}</p>
                    <p className="text-sm text-muted">{edgeCase.expectedBehavior}</p>
                    {stories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {stories.map((storyId) => (
                          <a key={storyId} href={`#story-${storyId}`} className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted hover:text-text">
                            {storyId}
                          </a>
                        ))}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="open-questions" aria-labelledby="open-title" className="scroll-mt-24 space-y-4">
          <h2 id="open-title" className="text-lg font-semibold">Open questions</h2>
          {spec.openQuestions.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {spec.openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          )}
        </section>

        <section id="tasks" aria-labelledby="tasks-title" className="scroll-mt-24 space-y-4">
          <h2 id="tasks-title" className="text-lg font-semibold">Task plan</h2>
          <ol className="space-y-3">
            {spec.tasks.map((task) => (
              <li key={task.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{task.id}</span>
                    <Badge tone={SIZE_TONE[task.estimate]}>Size {task.estimate}</Badge>
                    <span className="font-medium">{task.title}</span>
                  </div>
                  <p className="text-sm text-muted">{task.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {task.dependsOn.length === 0 ? (
                      <span className="text-muted">No dependencies</span>
                    ) : (
                      task.dependsOn.map((dependency) => (
                        <Badge key={dependency}>After {dependency}</Badge>
                      ))
                    )}
                    {task.relatedStoryIds.map((storyId) => (
                      <a key={storyId} href={`#story-${storyId}`} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-muted hover:text-text">
                        {storyId}
                      </a>
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Toast message={toast} />
    </div>
  );
}
