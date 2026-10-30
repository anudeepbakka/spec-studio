# Decisions and problems log

Append entries as the build proceeds (see CLAUDE.md). This file feeds docs/DESIGN_DECISIONS.md at sign-off.

## 2026-10-21: Free-tier LLM providers behind one interface
**Context:** No budget for paid LLM APIs; free tiers are rate-limited and free models are less reliable at structured JSON.
**Decision:** One `LLMProvider` interface over OpenAI-compatible endpoints (Groq, OpenRouter, Gemini) with ordered fallback.
**Alternatives:** Single provider; local Ollama only.
**Consequence:** Swappable providers and resilience to rate limits, at the cost of extra code and provider-specific quirks.

## 2026-10-30: Scaffold with create-next-app, then copy only what the project needs
**Context:** T0 needs Next.js App Router, TypeScript strict, Tailwind, ESLint, without leftover template content.
**Decision:** Generated Next.js 16 with `create-next-app` in a temp folder and copied `src/`, `public/`, configs and lockfile. Replaced the template home page and layout with a placeholder; dropped the template `AGENTS.md` and Geist font.
**Alternatives:** Running `create-next-app` in place (conflicts with existing docs); hand-writing every config file.
**Consequence:** Clean repo with the same toolchain as the generator; one less network dependency at build time (no Google font fetch).

## 2026-10-30: Vitest config as `.mts`, and `@types/node` pinned to ^22
**Context:** Vitest 5 gave a native-config warning for ESM `vitest.config.ts` under CommonJS, and `npm install vitest` failed with ERESOLVE against `@types/node@^20`.
**Decision:** Named the config `vitest.config.mts`. Set `@types/node` to `^22` (matches CI Node 22).
**Alternatives:** Set `"type": "module"` in package.json; keep `@types/node@^20` with `--legacy-peer-deps`.
**Consequence:** Clean installs with no peer-dependency overrides; the project stays CommonJS-default for everything else.

## 2026-10-30: `eval` and `screenshots` scripts are stubs that exit 1
**Context:** CLAUDE.md asks for these npm scripts in T0, but they are built in T7 and T8.
**Decision:** Declared them so the command names exist; they print a "not built yet" message and exit 1 so nobody mistakes them for passing.
**Alternatives:** Omit them until T7/T8; make them exit 0.
**Consequence:** Scripts are discoverable now. `db:generate` will fail until the T3 schema file exists.

## 2026-10-30: Env contract checked by a unit test
**Context:** SPEC §14 is the env contract, and `.env.example` could drift from it.
**Decision:** `src/env.test.ts` asserts the keys in `.env.example` match SPEC §14, in order.
**Alternatives:** No test; validate env at runtime only (that comes in T2).
**Consequence:** The test catches drift now. It must be updated if SPEC §14 changes.
