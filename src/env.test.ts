import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC §14: these keys are the full env contract. Keep .env.example in sync.
const SPEC_ENV_KEYS = [
  "DATABASE_URL",
  "LLM_PROVIDERS",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "DAILY_LLM_RUN_LIMIT",
  "LLM_TIMEOUT_MS",
];

describe(".env.example", () => {
  it("lists every env var from SPEC §14", () => {
    const text = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const keys = text
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => line.split("=")[0]);
    expect(keys).toEqual(SPEC_ENV_KEYS);
  });
});
