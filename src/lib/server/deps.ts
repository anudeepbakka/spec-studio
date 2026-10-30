import { createDb } from "../db/client";
import { createLLMClient } from "../llm/client";
import { createProvidersFromEnv } from "../llm/registry";
import type { SpecDeps } from "../specs/service";

// SPEC §14: a whole number from the environment, with a default. Zero is allowed for the limits.
function readWholeNumber(name: string, raw: string | undefined, fallback: number): number {
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number, 0 or more`);
  }
  return value;
}

// SPEC §10: new specs per owner per UTC day. Defaults to 5.
export function readDailySpecLimit(raw: string | undefined): number {
  return readWholeNumber("DAILY_SPEC_LIMIT", raw, 5);
}

// SPEC §17: new specs per signed-in user per UTC day. Defaults to 8.
export function readDailySpecLimitUser(raw: string | undefined): number {
  return readWholeNumber("DAILY_SPEC_LIMIT_USER", raw, 8);
}

// SPEC §10: provider requests across all owners per UTC day. Defaults to 600.
export function readGlobalCallBudget(raw: string | undefined): number {
  return readWholeNumber("GLOBAL_DAILY_LLM_CALL_BUDGET", raw, 600);
}

// Built once per process, so the DB connection and the LLM cooldown state are shared across requests.
let deps: SpecDeps | undefined;

export function getDeps(): SpecDeps {
  if (!deps) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    deps = {
      db: createDb(url),
      llm: createLLMClient({ providers: createProvidersFromEnv() }),
      dailySpecLimit: readDailySpecLimit(process.env.DAILY_SPEC_LIMIT),
      dailySpecLimitUser: readDailySpecLimitUser(process.env.DAILY_SPEC_LIMIT_USER),
      globalCallBudget: readGlobalCallBudget(process.env.GLOBAL_DAILY_LLM_CALL_BUDGET),
    };
  }
  return deps;
}
