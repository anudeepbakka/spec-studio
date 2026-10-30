import { createDb } from "../db/client";
import { createLLMClient } from "../llm/client";
import { createProvidersFromEnv } from "../llm/registry";
import type { SpecDeps } from "../specs/service";

// SPEC §10: new specs per owner per UTC day. Defaults to 5.
export function readDailySpecLimit(raw: string | undefined): number {
  const limit = raw ? Number(raw) : 5;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("DAILY_SPEC_LIMIT must be a whole number, 0 or more");
  }
  return limit;
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
    };
  }
  return deps;
}
