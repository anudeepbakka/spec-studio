import { createDb } from "../db/client";
import { createLLMClient } from "../llm/client";
import { createProvidersFromEnv } from "../llm/registry";
import type { SpecDeps } from "../specs/service";

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
    };
  }
  return deps;
}
