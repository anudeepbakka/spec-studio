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

## 2026-10-30: Integrity checks run after shape validation, in one `superRefine`
**Context:** SPEC §6 needs referential checks (IDs, references, cycles, coverage) on top of the shape rules.
**Decision:** Shape rules are plain Zod. Integrity rules live in `src/lib/schemas/integrity.ts` and run in a `superRefine` on `SpecSchema`, so they only run once the shape is valid. Each issue carries a path and a readable message.
**Alternatives:** Run integrity checks on raw JSON before Zod; one big `superRefine` with all rules inline.
**Consequence:** A model that gets the shape wrong sees shape errors first, and integrity errors appear on the repair pass. Cycle messages follow "depends on" edges, so `T-1 -> T-3 -> T-2 -> T-1` means T-1 depends on T-3.

## 2026-10-30: Fixed ID formats enforced by regex
**Context:** SPEC §6 says IDs are `US-1`, `AC-1.1`, `EC-1`, `T-1`, and §9 says the model must use them exactly.
**Decision:** Each ID type has a regex in `spec.ts`. Question IDs are not format-checked (the spec gives no format), only checked for uniqueness.
**Alternatives:** Accept any non-empty string and rely on the prompt.
**Consequence:** Free-tier models that drift on ID format get a clear validation error, which the repair step can fix. Possible cost: more repair calls.

## 2026-10-30: Vitest gets the `@/` alias from its own config
**Context:** Tests import from `@/test/...` and `@/lib/...`. Vitest does not read `tsconfig.json` `paths`.
**Decision:** Added a `resolve.alias` for `@` in `vitest.config.mts`, pointing at `src`.
**Alternatives:** `vite-tsconfig-paths` plugin (a new dependency); relative imports in tests only.
**Consequence:** No extra dependency. The alias is defined in two places, so keep them in sync.

## Problem: Vitest could not resolve `@/` imports
**What happened:** The first test run failed with `Cannot find package '@/test/sample-spec'`. The tests and the app compiled fine under TypeScript, but Vitest resolves modules with Vite, which ignores tsconfig `paths`.
**Fix:** Added the alias to `vitest.config.mts` (see above).

## 2026-10-30: Missing key skips a provider, missing model fails startup
**Context:** SPEC §8 says a provider without a key is skipped. SPEC §14 says to fail with a clear message when a listed provider's key or model is missing. The two conflict.
**Decision:** No key means skip, so one configured provider is enough to run. A key with no model throws a clear error naming the env var.
**Alternatives:** Fail on any missing key (§14 literal); skip on a missing model too.
**Consequence:** A half-configured provider is caught immediately, and an intentionally unused provider doesn't break startup.

## 2026-10-30: Fallback on any provider failure, cooldown only on 429
**Context:** SPEC §8 lists 429, 5xx, timeout and network errors as fallback triggers. Other 4xx responses (such as a bad key) are not listed.
**Decision:** Any `ProviderError` moves to the next provider. A 429 also puts that provider on a 60 second cooldown. Other errors are not cooled down.
**Alternatives:** Fall back only on the listed errors, so a 401 fails the whole request.
**Consequence:** A misconfigured provider costs one failed call per request, but the app still answers from the others.

## 2026-10-30: Repair call lives in the LLM layer for now
**Context:** SPEC §8 requires one repair call. SPEC §9 puts prompts in `src/lib/prompts`, which T4 builds.
**Decision:** `buildRepairMessages` is in `src/lib/llm/json.ts`. It appends the bad output and the validation errors to the original message history.
**Alternatives:** Build the repair prompt in T2 under `src/lib/prompts`, which T4 would then extend.
**Consequence:** T2 is self-contained. T4 may move the repair wording into the prompts module.

## 2026-10-30: Streaming fallback is deferred to T5
**Context:** `chatStream` exists on every provider, and SSE parsing is covered by tests. Streaming needs a fallback rule (only before the first chunk, for example).
**Decision:** The client exposes `chat` and `generateJson` with fallback. Streaming is called directly on a provider for now.
**Alternatives:** Build stream fallback now, without a consumer.
**Consequence:** T5 defines the stream fallback rule when the endpoint needs it.

## 2026-10-30: Env contract checked by a unit test
**Context:** SPEC §14 is the env contract, and `.env.example` could drift from it.
**Decision:** `src/env.test.ts` asserts the keys in `.env.example` match SPEC §14, in order.
**Alternatives:** No test; validate env at runtime only (that comes in T2).
**Consequence:** The test catches drift now. It must be updated if SPEC §14 changes.

## 2026-10-30: Owner cookie is set by `src/proxy.ts`, not `middleware.ts`
**Context:** SPEC §5 and CLAUDE.md say middleware. Next.js 16 deprecated `middleware.js` and renamed it to `proxy.js` (bundled docs, `01-app/03-api-reference/03-file-conventions/proxy.md`).
**Decision:** The cookie logic lives in `src/proxy.ts` as `export function proxy`. The pure logic is in `src/lib/owner/owner.ts` (`resolveOwnerId`), so it is unit tested.
**Alternatives:** `middleware.ts` with a deprecation warning on every build.
**Consequence:** No warnings on Next 16. The cookie is `httpOnly`, `sameSite=lax`, one year, `secure` in production.

## 2026-10-30: postgres-js driver, and PGlite for tests
**Context:** SPEC §3 says Postgres on Neon with Drizzle, and the repo tests need a real database without a server.
**Decision:** Production uses the `postgres` driver with `drizzle-orm/postgres-js` (`max: 1`). Tests run the generated migration on `@electric-sql/pglite`, an in-process Postgres, so the SQL is really executed.
**Alternatives:** `@neondatabase/serverless` (HTTP driver, a Neon-only choice); mocking the Drizzle query chain (brittle, and it would not test scoping).
**Consequence:** Two new dependencies, `postgres` (runtime) and `@electric-sql/pglite` (dev). The repo functions take a `Db` handle, so tests and production share the same code. `createDb` is typed as `Db`, so typecheck confirms the two drivers match.

## 2026-10-30: Repo functions take the owner ID on every call
**Context:** SPEC §5 says all queries are scoped by `owner_id`. A forgotten `where` would leak another owner's data.
**Decision:** Every function in `src/lib/db/repo.ts` takes `ownerId` and filters on it. `getSpec` and `deleteSpec` return "not found" for another owner's ID, the same as a missing ID.
**Alternatives:** A query builder wrapper that adds the filter automatically (more abstraction, which CLAUDE.md discourages).
**Consequence:** The scoping test covers each function. The API layer (T4 and later) must pass the owner from the cookie and never from the request body.

## 2026-10-30: Owner cookie is required on API routes, and a missing cookie is a 401
**Context:** `src/proxy.ts` sets `ss_owner` on the response. The route handler reads the request, so on a first visit with no cookie it cannot see the new owner ID.
**Decision:** `ownerIdFrom` (`src/lib/api/request.ts`) returns 401 `owner_required` when the cookie is missing or invalid. The browser always has the cookie because the page load sets it first.
**Alternatives:** Forward the new ID to the route through a request header or request cookie in the proxy; generate a fresh owner in the route (that would orphan the spec from the cookie).
**Consequence:** A bare `curl` must first load `/` with a cookie jar. Forwarding the cookie from the proxy can come later if API-only clients need it.

## 2026-10-30: Questions can be regenerated only before answers are saved
**Context:** Answers refer to question IDs. Regenerating questions after answers would make the answers point at questions the user never saw.
**Decision:** `generateQuestions` accepts status `draft` or `questions_ready` and returns 409 `invalid_state` otherwise. Saving questions clears the stored answers.
**Alternatives:** Keep answers and match them by question text; allow regeneration at any time.
**Consequence:** To change questions after answering, the user starts a new request. The UI (T6) must offer that path.

## 2026-10-30: The questions endpoint does not check the daily cap yet
**Context:** SPEC §10 counts questions as one LLM run against `DAILY_LLM_RUN_LIMIT`. The `usage` table and the 429 path are part of T5.
**Decision:** T4 calls the LLM with no cap check. T5 adds the cap to both LLM routes at once, so the logic is written once.
**Alternatives:** Build the cap now with a separate counter, which would be replaced in T5.
**Consequence:** Until T5 lands, the endpoints are not rate limited. Do not expose them publicly before T5.

## Problem: Neon tables missing on first request
**What happened:** The first `POST /api/specs` returned 500. The log showed Postgres code `42P01` (undefined table). The migration had never been applied to the Neon dev database.
**Fix:** Ran `npm run db:migrate` with `.env.local` loaded (`node --env-file=.env.local`). Errors now log only the error name and Postgres code. Driver messages are not logged, because Drizzle puts the SQL and its parameters, including the user's request, into them.
