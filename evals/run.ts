import type { Owner } from "@/lib/owner/scope";
// SPEC §13: `npm run eval`. Runs an interview for each case in evals/cases.json, generates a spec from it, and writes
// the metrics to evals/results/latest.json. Uses the real providers from .env.local (loaded by the npm script).
//
// Clarifications are answers, sent in order without reading the question. Two markers stand for the other answer kinds:
//   "[skip]"      sends a skipped answer
//   "[not sure]"  sends a "not sure" answer
// Each eval run uses a fresh in-memory database (PGlite), so no data is kept and the daily limit is set high.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createLLMClient, type LLMLogEvent } from "../src/lib/llm/client";
import { createProvidersFromEnv } from "../src/lib/llm/registry";
import { PROMPT_VERSION } from "../src/lib/prompts";
import { getSpec, type Db } from "../src/lib/db/repo";
import * as schema from "../src/lib/db/schema";
import { interviewFinish, interviewNext, readTurns } from "../src/lib/interview/service";
import { canFinishEarly, type AnswerInput } from "../src/lib/interview/machine";
import { MAX_LLM_CALLS_PER_SPEC } from "../src/lib/specs/limits";
import { createDraft, type SpecDeps } from "../src/lib/specs/service";
import { runGeneration, startGeneration } from "../src/lib/specs/generate";
import { SpecSchema, type Spec } from "../src/lib/schemas/spec";
import type { Turn } from "../src/lib/schemas/turn";
import {
  assumptionCoverage,
  average,
  followUpRate,
  storyTaskCoverage,
  turnInRange,
  withinCallCap,
} from "../src/lib/evals/metrics";

const here = dirname(fileURLToPath(import.meta.url));
const OWNER: Owner = { kind: "guest", ownerId: "22222222-2222-4222-8222-222222222222" };
// The eval makes its own specs, so the production daily limit does not apply here.
const EVAL_DAILY_LIMIT = 1000;

type EvalCase = { id: string; request: string; clarifications: string[] };

type CaseResult = {
  id: string;
  error: string | null;
  endedBy: "llm_done" | "max_turns" | "finish_early" | "list_exhausted_too_few_answers" | null;
  resolvedTurns: number;
  interviewSteps: number;
  interviewFirstAttemptValid: number;
  followUps: { checked: number; followUps: number; rate: number | null };
  assumptions: { total: number; covered: number; rate: number | null };
  generated: boolean;
  specFirstAttemptValid: boolean | null;
  status: string | null;
  errorMessage: string | null;
  provider: string | null;
  model: string | null;
  llmCalls: number;
  withinCap: boolean;
  stories: number;
  criteriaPerStory: number | null;
  edgeCases: number;
  tasks: number;
  storyTaskCoverage: number | null;
  latencyMs: number;
  failedAttempts: number;
};

function answerFor(questionId: string, clarification: string): AnswerInput {
  if (clarification === "[skip]") return { questionId, answer: "", skipped: true };
  if (clarification === "[not sure]") return { questionId, answer: "", notSure: true };
  return { questionId, answer: clarification };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runCase(deps: SpecDeps, evalCase: EvalCase, attempts: LLMLogEvent[]): Promise<CaseResult> {
  const started = Date.now();
  attempts.length = 0;
  const result: CaseResult = {
    id: evalCase.id,
    error: null,
    endedBy: null,
    resolvedTurns: 0,
    interviewSteps: 0,
    interviewFirstAttemptValid: 0,
    followUps: { checked: 0, followUps: 0, rate: null },
    assumptions: { total: 0, covered: 0, rate: null },
    generated: false,
    specFirstAttemptValid: null,
    status: null,
    errorMessage: null,
    provider: null,
    model: null,
    llmCalls: 0,
    withinCap: true,
    stories: 0,
    criteriaPerStory: null,
    edgeCases: 0,
    tasks: 0,
    storyTaskCoverage: null,
    latencyMs: 0,
    failedAttempts: 0,
  };

  try {
    const { id } = await createDraft(deps, OWNER, evalCase.request);
    const callsSoFar = async () => (await getSpec(deps.db, OWNER, id))?.llmCalls ?? 0;

    // Each interview step counts the provider requests it made. One request means the first answer validated.
    async function step(answer?: AnswerInput) {
      const before = await callsSoFar();
      const next = await interviewNext(deps, OWNER, id, answer);
      const used = (await callsSoFar()) - before;
      if (used > 0) {
        result.interviewSteps += 1;
        if (used === 1) result.interviewFirstAttemptValid += 1;
      }
      return next;
    }

    let current = await step();
    let used = 0;
    while (!current.done && used < evalCase.clarifications.length) {
      const text = evalCase.clarifications[used];
      used += 1;
      current = await step(answerFor(current.turn.question.id, text));
    }

    let row = await getSpec(deps.db, OWNER, id);
    let turns: Turn[] = row ? readTurns(row) : [];
    const resolvedBefore = turns.filter((turn) => turn.answer !== null).length;

    if (current.done) {
      result.endedBy = resolvedBefore >= 8 ? "max_turns" : "llm_done";
    } else if (canFinishEarly(turns)) {
      await interviewFinish(deps, OWNER, id);
      result.endedBy = "finish_early";
    } else {
      result.endedBy = "list_exhausted_too_few_answers";
    }

    row = await getSpec(deps.db, OWNER, id);
    turns = row ? readTurns(row) : [];
    result.resolvedTurns = turns.filter((turn) => turn.answer !== null).length;
    result.followUps = followUpRate(turns);

    if (result.endedBy !== "list_exhausted_too_few_answers") {
      const input = await startGeneration(deps, OWNER, id);
      const before = await callsSoFar();
      await runGeneration(deps, OWNER, id, input, () => {});
      const generationCalls = (await callsSoFar()) - before;
      result.generated = true;
      result.specFirstAttemptValid = generationCalls === 1;
    }

    row = await getSpec(deps.db, OWNER, id);
    result.status = row?.status ?? null;
    result.errorMessage = row?.errorMessage ?? null;
    result.provider = row?.provider ?? null;
    result.model = row?.model ?? null;
    result.llmCalls = row?.llmCalls ?? 0;
    result.withinCap = withinCallCap(result.llmCalls, MAX_LLM_CALLS_PER_SPEC);

    if (row?.status === "done" && row.spec) {
      const spec: Spec = SpecSchema.parse(row.spec);
      result.assumptions = assumptionCoverage(turns, spec);
      result.stories = spec.userStories.length;
      result.criteriaPerStory = average(spec.userStories.map((story) => story.acceptanceCriteria.length));
      result.edgeCases = spec.edgeCases.length;
      result.tasks = spec.tasks.length;
      result.storyTaskCoverage = storyTaskCoverage(spec.userStories, spec.tasks);
    }
  } catch (error) {
    result.error = errorText(error);
  }

  result.latencyMs = Date.now() - started;
  result.failedAttempts = attempts.filter((event) => event.outcome !== "ok").length;
  return result;
}

function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

function summarise(results: CaseResult[]) {
  const sum = (pick: (r: CaseResult) => number) => results.reduce((total, r) => total + pick(r), 0);
  const finished = results.filter((r) => r.endedBy && r.endedBy !== "list_exhausted_too_few_answers");
  const generated = results.filter((r) => r.generated);
  const done = results.filter((r) => r.status === "done");
  const followChecked = sum((r) => r.followUps.checked);
  const assumptionTotal = sum((r) => r.assumptions.total);
  const withStructure = results.filter((r) => r.status === "done");

  return {
    interview: {
      questionSchemaValidFirstAttempt: rate(sum((r) => r.interviewFirstAttemptValid), sum((r) => r.interviewSteps)),
      turnsInRange: rate(finished.filter((r) => turnInRange(r.resolvedTurns)).length, finished.length),
      llmDoneReached: rate(results.filter((r) => r.endedBy === "llm_done").length, results.length),
      adaptiveFollowUp: rate(sum((r) => r.followUps.followUps), followChecked),
      averageTurns: average(results.map((r) => r.resolvedTurns)),
    },
    spec: {
      schemaValidFirstAttempt: rate(generated.filter((r) => r.specFirstAttemptValid).length, generated.length),
      validAfterRepair: rate(generated.filter((r) => r.status === "done").length, generated.length),
      finalSuccess: rate(done.length, results.length),
    },
    assumptions: {
      coveredShare: rate(sum((r) => r.assumptions.covered), assumptionTotal),
      checkedTurns: assumptionTotal,
    },
    structure: {
      averageStories: average(withStructure.map((r) => r.stories)),
      averageCriteriaPerStory: average(withStructure.flatMap((r) => (r.criteriaPerStory === null ? [] : [r.criteriaPerStory]))),
      averageEdgeCases: average(withStructure.map((r) => r.edgeCases)),
      averageTasks: average(withStructure.map((r) => r.tasks)),
      storyTaskCoverage: average(withStructure.flatMap((r) => (r.storyTaskCoverage === null ? [] : [r.storyTaskCoverage]))),
    },
    ops: {
      averageLatencyMs: average(results.map((r) => r.latencyMs)),
      failedAttempts: sum((r) => r.failedAttempts),
      averageLlmCalls: average(results.map((r) => r.llmCalls)),
      maxLlmCalls: Math.max(0, ...results.map((r) => r.llmCalls)),
      allWithinCallCap: results.every((r) => r.withinCap),
    },
  };
}

function printTable(summary: ReturnType<typeof summarise>, results: CaseResult[]) {
  const pct = (value: number | null) => (value === null ? "n/a" : `${(value * 100).toFixed(0)}%`);
  const num = (value: number | null) => (value === null ? "n/a" : value.toFixed(1));
  const rows: [string, string][] = [
    ["interview: question valid first attempt", pct(summary.interview.questionSchemaValidFirstAttempt)],
    ["interview: turns in 4..8 range", pct(summary.interview.turnsInRange)],
    ["interview: LLM done reached", pct(summary.interview.llmDoneReached)],
    ["interview: adaptive follow-up", pct(summary.interview.adaptiveFollowUp)],
    ["interview: average turns", num(summary.interview.averageTurns)],
    ["spec: valid first attempt", pct(summary.spec.schemaValidFirstAttempt)],
    ["spec: valid after repair or fallback", pct(summary.spec.validAfterRepair)],
    ["spec: final success", pct(summary.spec.finalSuccess)],
    ["assumptions: covered in summary or open questions", pct(summary.assumptions.coveredShare)],
    ["structure: average stories", num(summary.structure.averageStories)],
    ["structure: criteria per story", num(summary.structure.averageCriteriaPerStory)],
    ["structure: average edge cases", num(summary.structure.averageEdgeCases)],
    ["structure: average tasks", num(summary.structure.averageTasks)],
    ["structure: stories covered by tasks", pct(summary.structure.storyTaskCoverage)],
    ["ops: average latency (s)", num(summary.ops.averageLatencyMs === null ? null : summary.ops.averageLatencyMs / 1000)],
    ["ops: failed provider attempts", String(summary.ops.failedAttempts)],
    ["ops: LLM calls per case (max)", `${num(summary.ops.averageLlmCalls)} (${summary.ops.maxLlmCalls}, cap ${MAX_LLM_CALLS_PER_SPEC})`],
  ];
  console.log("\nMetric                                              Value");
  for (const [label, value] of rows) {
    console.log(`${label.padEnd(52)}${value}`);
  }
  console.log("\nCase                  Ended by                        Turns  Status       Calls  Error");
  for (const r of results) {
    console.log(
      `${r.id.padEnd(22)}${(r.endedBy ?? "-").padEnd(32)}${String(r.resolvedTurns).padEnd(7)}${(r.status ?? "-").padEnd(13)}${String(r.llmCalls).padEnd(7)}${r.error ?? r.errorMessage ?? ""}`,
    );
  }
}

async function main() {
  const attempts: LLMLogEvent[] = [];
  const providers = createProvidersFromEnv(process.env);
  if (providers.length === 0) {
    throw new Error("No LLM provider has an API key. Fill the keys in .env.local and run again.");
  }

  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: join(here, "..", "drizzle") });
  const deps: SpecDeps = {
    db: instance as unknown as Db,
    llm: createLLMClient({ providers, log: (event) => attempts.push(event) }),
    dailySpecLimit: EVAL_DAILY_LIMIT,
    dailySpecLimitUser: 8,
    globalCallBudget: 600,
  };

  // `--limit N` runs only the first N cases, to save provider quota (for example: npm run eval -- --limit 2).
  const limitFlag = process.argv.indexOf("--limit");
  const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);
  if (limitFlag !== -1 && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit needs a whole number of 1 or more, for example: npm run eval -- --limit 2");
  }
  // `--cases id1,id2` runs only the named cases, and `--out name.json` writes to evals/results/name.json instead of
  // latest.json. Use both to run two sets of cases side by side without overwriting each other's results.
  const casesFlag = process.argv.indexOf("--cases");
  const wanted = casesFlag === -1 ? null : (process.argv[casesFlag + 1] ?? "").split(",").filter(Boolean);
  const outFlag = process.argv.indexOf("--out");
  const outName = outFlag === -1 ? "latest.json" : (process.argv[outFlag + 1] ?? "");
  if (!/^[\w.-]+\.json$/.test(outName)) {
    throw new Error("--out needs a file name ending in .json, for example: --out run-b.json");
  }
  const allCases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8")) as EvalCase[];
  const selected = wanted ? allCases.filter((evalCase) => wanted.includes(evalCase.id)) : allCases;
  if (wanted && selected.length !== wanted.length) {
    throw new Error(`--cases names an unknown case. Known IDs: ${allCases.map((c) => c.id).join(", ")}`);
  }
  const cases = selected.slice(0, limit);
  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    console.log(`Running ${evalCase.id}...`);
    results.push(await runCase(deps, evalCase, attempts));
  }

  const summary = summarise(results);
  const output = {
    date: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    providers: providers.map((provider) => ({ name: provider.name, model: provider.model })),
    summary,
    cases: results,
  };
  mkdirSync(join(here, "results"), { recursive: true });
  writeFileSync(join(here, "results", outName), `${JSON.stringify(output, null, 2)}\n`);
  printTable(summary, results);
  console.log(`\nWrote evals/results/${outName}`);
}

main().catch((error: unknown) => {
  console.error(`Eval failed: ${errorText(error)}`);
  process.exitCode = 1;
});
