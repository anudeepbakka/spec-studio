import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, FileText, ListChecks, MessageSquare, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { NewRequestForm } from "@/components/NewRequestForm";
import { SpecCard } from "@/components/SpecCard";
import { Card } from "@/components/ui/Card";
import { currentOwnerId } from "@/lib/owner/current";
import { getDeps } from "@/lib/server/deps";
import { HOW_IT_WORKS } from "@/lib/specs/format";
import { listOwnedSpecs } from "@/lib/specs/service";

// Each visitor sees their own list, so the page is rendered per request as a blocking route.
export const instant = false;

const STEP_ICONS = [MessageSquare, ListChecks, Sparkles, FileText] as const;
const RECENT_LIMIT = 6;

// SPEC §11 Home: a hero with the prompt box, how it works, and recent specs as a card grid.
export default async function Home() {
  await connection();
  const ownerId = await currentOwnerId();
  const specs = ownerId ? await listOwnedSpecs(getDeps(), ownerId) : [];
  const now = new Date().toISOString();
  const recent = specs.slice(0, RECENT_LIMIT);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-20 px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <section aria-labelledby="hero" className="mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-glass px-3 py-1 text-xs text-muted">
            <Sparkles size={13} aria-hidden="true" className="text-cyan" />
            Interview first, then write the spec
          </p>
          <h1 id="hero" className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Turn a rough idea into a spec{" "}
            <span className="bg-gradient-to-r from-accent to-cyan bg-clip-text text-transparent">developers can build.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Spec Studio asks one question at a time, then writes user stories, acceptance criteria, edge cases and a task plan.
          </p>
          <div className="mt-10 text-left">
            <NewRequestForm />
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="space-y-6">
          <h2 id="how-it-works" className="text-center text-sm font-medium uppercase tracking-wider text-muted">
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Sparkles;
              return (
                <li key={step.title}>
                  <Card className="h-full space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="font-mono text-xs text-muted">0{index + 1}</span>
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{step.body}</p>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="recent-specs" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recent-specs" className="text-xl font-semibold">
              Recent specs
            </h2>
            {specs.length > RECENT_LIMIT && (
              <Link href="/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
                See all {specs.length}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">
              No specs yet. Describe a feature above to start your first one. Your specs are saved in this browser.
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((spec) => (
                <li key={spec.id}>
                  <SpecCard spec={{ ...spec, createdAt: spec.createdAt.toISOString() }} now={now} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
