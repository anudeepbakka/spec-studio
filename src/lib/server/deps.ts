import { createDb } from "../db/client";
import { createLLMClient } from "../llm/client";
import { createProvidersFromEnv } from "../llm/registry";
import type { SpecDeps } from "../specs/service";

// SPEC §10: LLM runs per owner per UTC day. Defaults to 10.
export function readDailyLimit(raw: string | undefined): number {
  const limit = raw ? Number(raw) : 10;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("DAILY_LLM_RUN_LIMIT must be a whole number, 0 or more");
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
      dailyLimit: readDailyLimit(process.env.DAILY_LLM_RUN_LIMIT),
    };
  }
  return deps;
}
