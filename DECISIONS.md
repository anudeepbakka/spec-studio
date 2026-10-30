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
**Decision:** T4 calls the LLM with no cap check. T5 adds the cap to both LLM routes at once, so the logic is written once. (Done in T5: see the next entry.)
**Alternatives:** Build the cap now with a separate counter, which would be replaced in T5.
**Consequence:** Until T5 landed, the endpoints were not rate limited.

## 2026-10-30: Daily cap is reserved before the provider call, and failed runs still count
**Context:** SPEC §10 and AC-7 say an over-limit request must cost nothing at a provider. Checking first and counting after would let parallel requests overshoot the limit.
**Decision:** `reserveLlmRun` (`src/lib/db/repo.ts`) is one `INSERT ... ON CONFLICT DO UPDATE ... WHERE llm_runs < limit` statement, keyed by owner and UTC day. It runs before any provider is contacted. A run that then fails still counts.
**Alternatives:** Count only successful runs (lets a failing provider drain nothing, but makes the count race-prone); a separate read then write (overshoots under parallel requests).
**Consequence:** A user whose run fails loses one of the day's runs. The 429 message gives the reset time as 00:00 UTC, not a countdown.

## 2026-10-30: Streaming progress uses the provider stream only when a caller asks for it
**Context:** SPEC §10 wants `progress` events with a character count. Questions (T4) use plain `chat`, and the existing client tests stub only `chat`.
**Decision:** `generateJson` takes `{ signal, onProgress }`. With `onProgress`, the call uses `chatStream` and reports the running length. Without it, it uses `chat` as before. The OpenAI-compatible provider now sends `response_format: json_object` on streamed calls too, so JSON mode is not lost when streaming.
**Alternatives:** Always stream (would change the questions path and its tests); drop JSON mode for streams (more repair retries).
**Consequence:** The progress count restarts when the repair call begins. Invalid JSON from a streamed first attempt triggers the same single repair as before.

## 2026-10-30: Generation status, cancel, and stale runs
**Context:** SPEC §12 needs failed specs to be retryable and a cancel button in the UI. A server that stops mid-run would otherwise leave a spec in `generating` forever.
**Decision:** `startGeneration` allows `answered`, `done`, and `failed`. `generating` is refused for 10 minutes after its last update, then treated as abandoned. A cancelled run (client disconnect or abort) returns the spec to `answered`. Any other failure sets `failed` and stores the friendly message in `error_message`.
**Alternatives:** Keep cancelled runs as `failed` (the user would see an error for something they chose); a lease column with a heartbeat (more schema for a single-user-per-browser app).
**Consequence:** After a crash, a retry can wait up to 10 minutes. Invalid output after one repair and a provider outage both end as `llm_unavailable`, so the UI cannot yet tell them apart. T6 can show one retry message for both.

## 2026-10-30: SSE route checks the request before opening the stream
**Context:** Once an SSE response has started, its status code cannot change. Not-found, wrong-state, and daily-limit errors must come back as normal JSON with the right status.
**Decision:** `startGeneration` runs before the `ReadableStream` is created, so its errors are plain `{ error }` responses. The run itself reports failures as `error` events. Client disconnect aborts the LLM call through `request.signal` and the stream's `cancel()`.
**Alternatives:** Send every failure as an `error` event with status 200 (clients would have to parse the stream to learn a request was refused).
**Consequence:** Clients must handle both a JSON error and an event stream from the same endpoint. Hobby-tier Vercel limits a function to 60 seconds. A question run plus a repair plus a fallback can exceed that, so T8 should check the deployed timeout.

## Problem: Neon tables missing on first request
**What happened:** The first `POST /api/specs` returned 500. The log showed Postgres code `42P01` (undefined table). The migration had never been applied to the Neon dev database.
**Fix:** Ran `npm run db:migrate` with `.env.local` loaded (`node --env-file=.env.local`). Errors now log only the error name and Postgres code. Driver messages are not logged, because Drizzle puts the SQL and its parameters, including the user's request, into them.

## 2026-10-30: Spec pages read the database directly and call connection() first
**Context:** `cacheComponents` is on. A page that reads cookies or the database without declaring a request-time dependency fails prerendering, and the dev overlay reports it.
**Decision:** `/` and `/specs/[id]` call `await connection()` before reading the owner cookie and the database. The server pages call the repo and service functions directly, not their own API routes.
**Alternatives:** Wrap the data reads in `Suspense` with a fallback (more markup for a small page); have server pages fetch their own API (an extra HTTP hop inside the same process).
**Consequence:** Both pages render per request. That suits per-owner data, and it adds no caching.

## 2026-10-30: The wizard step follows the saved status, with one local override
**Context:** SPEC §11 has four steps. A reload or a return visit must land on the right step, and the status already records where the user is.
**Decision:** `stepFor(status)` in `src/lib/specs/steps.ts` picks the step. The only local state is "Edit answers" and the live progress count. Every change ends with a reload of the record, so the UI shows what the server saved.
**Alternatives:** A client-side state machine that tracks the steps itself (drifts from the server after a reload or a dropped connection).
**Consequence:** Progress counts show only in the tab that started the run. Another tab, or a reload mid-run, shows "still in progress" with a "Check again" button until the run finishes or goes stale after 10 minutes.

## 2026-10-30: Copy and download use the export endpoint
**Context:** SPEC §7 says the Markdown is deterministic and snapshot-tested. Copy and download must give the same text as the `.md` file.
**Decision:** Both actions read `GET /api/specs/:id/export`. The browser never builds Markdown itself.
**Alternatives:** Render the Markdown in the browser (a second copy of the format to keep in sync).
**Consequence:** Copy needs one extra request. It can fail when the clipboard is unavailable, so the UI points the user to Download.

## 2026-10-30: Added the list, get and delete routes in T6
**Context:** SPEC §10 lists `GET /api/specs`, `GET /api/specs/:id` and `DELETE /api/specs/:id`. T5 did not build them, and the home page and delete button need them.
**Decision:** `GET /api/specs` returns summaries, `GET`/`DELETE /api/specs/:id` return the full record and remove it. All three are scoped by owner, and another owner's ID gets the same 404 as a missing one (tested in `manage.test.ts`).
**Alternatives:** Keep deletion in a server action (the SPEC §10 API would then not match the code).
**Consequence:** The API now matches SPEC §10.

## Problem: Prerender errors on the home and spec pages with cacheComponents
**What happened:** The dev overlay reported "Route / encountered uncached data during prerendering" and the same for `/specs/[id]`. The cookie and database reads ran before any request-time marker.
**Fix:** Added `await connection()` at the top of both pages. The dev server log showed no new errors after the change.

## Problem: connection() outside Suspense still blocked prerendering
**What happened:** After the first fix, the dev overlay still reported "Route / encountered uncached data during prerendering", now pointing at the `await connection()` line itself. With `cacheComponents`, a request-time call outside a `Suspense` boundary blocks the static shell.
**Fix:** The shells of `/` and `/specs/[id]` are static. The per-request reads (owner cookie, database, `connection()`) move into async children wrapped in `Suspense`.
**Consequence:** Not-found specs now return HTTP 200 with the friendly not-found page, not 404. `notFound()` runs after the streamed shell has started, so the status cannot change. The UI is correct; the status code is a known gap against SPEC §12. Fixing it means checking ownership before the boundary, which would bring the blocking read back.

## 2026-10-30: Adaptive one-question interview replaces the batch of questions
**Context:** The v1 flow generated 4 to 8 questions at once, so no question could use an earlier answer. Users also got a form, not a conversation.
**Decision:** The interview asks one question per LLM call (SPEC §4, §9, §10). Each call gets the request and the full transcript. The model returns `done` and the coverage. The server enforces min 4 and max 8 resolved turns and the call cap. Interview state lives in a new `interview` column. Legacy rows stay readable.
**Alternatives:** Keep the batch and re-ask after each answer (costs more calls and drops the one-question rhythm); let the model control the count with no server limits (cannot guarantee the cap or the minimum).
**Consequence:** A full interview costs up to 8 question calls plus generation and repairs, so the per-spec cap of 12 is tight. Eval runs need the same cap. Each question now waits for the previous answer, so latency is per turn, not per interview.

## 2026-10-30: Interview answer rules and counting
**Context:** SPEC §10 needs precise counts for minimum, maximum, and finish early. "Skipped", "Not sure", and a real answer mean different things.
**Decision:** A turn is resolved when it has any answer, including skipped and "not sure". The minimum of 4 and the maximum of 8 count resolved turns. Finish early needs 3 turns with a real answer (`answered`). "Not sure" is kept as an answer and becomes an open question in the spec; skipped becomes an assumption.
**Alternatives:** Count only real answers toward the minimum (a user who skips a lot would never reach done); let finish early accept any resolved turns (could generate from almost nothing).
**Consequence:** A user who skips a lot can still reach done through the 8-turn maximum, and the spec will list many assumptions. The UI must show this clearly.

## 2026-10-30: Daily limit counts new specs, and each spec has a call cap
**Context:** A per-run limit no longer fits: one spec now takes many calls. The cost risk is the number of calls per spec and the number of specs per day.
**Decision:** `DAILY_SPEC_LIMIT` (default 5) counts new specs at their first question, not calls. A separate constant `MAX_LLM_CALLS_PER_SPEC = 12` counts every provider request for a spec, including repairs and fallbacks, and is reserved before each request. The `usage` column `llm_runs` becomes `specs_started`.
**Alternatives:** Keep the per-call daily limit (a single interview would use up the day); count only successful calls (a failing provider could drain free quota).
**Consequence:** A failed first question still counts as a started spec, as the old run limit did. Resuming a spec never costs more of the daily limit. The 12-call cap can be hit by a provider outage that triggers many fallbacks; the message tells the user to start a new request.

## 2026-10-30: Legacy specs stay readable and are not migrated
**Context:** Specs made with the v1 flow hold `questions` and `answers`, and their prompts are retired.
**Decision:** Legacy rows keep their columns. They open read-only, and their spec or saved answers are shown. Interview and generate endpoints return 409 `legacy_spec`. Delete and export still work.
**Alternatives:** Convert legacy questions into interview turns (the interview order and coverage would be invented); delete legacy rows (loses the owner's data).
**Consequence:** The app keeps two flows in code for the portfolio period. This is one read-only branch, not a full second flow.

## 2026-10-30: Dark-first theme, and two new UI dependencies
**Context:** The v1 UI was a plain form. The product should feel like a modern AI application. SPEC §2 excluded a dark mode toggle.
**Decision:** The app is dark-first with one theme (no switch). `framer-motion` (motion) and `lucide-react` (icons) are allowed. Inter and Geist Mono load with `next/font`. These are the only new libraries.
**Alternatives:** A light theme with a toggle (more work, not asked for); a component kit such as shadcn (a larger dependency and a different look from the spec).
**Consequence:** The non-goal "dark mode toggle" becomes "a theme switch". Reduced motion must turn animations off, so every animated component needs a reduced-motion path.

## 2026-10-30: Question IDs are assigned by the server
**Context:** The v1 schema let the model choose question IDs, which is untrusted output.
**Decision:** The model returns the question without an ID. The server assigns `Q-{index}`.
**Alternatives:** Trust the model's IDs and check them for duplicates (more checks for the same result).
**Consequence:** Answers are keyed to server-generated IDs, so an invalid ID from the model cannot break the transcript.

## Problem: Suspense-streamed sections never hydrated, so their buttons did nothing
**What happened:** After the T6 prerender fix (`Suspense` around the per-request reads), the spec page and the home page's recent-specs list rendered, but their buttons had no React handlers. A click on Send submitted the form natively. Delete buttons inside the streamed section were inert too. The home header and form, outside the boundary, hydrated fine.
**Fix:** Both pages export `instant = false`, Next's "allow blocking route" option, and drop the `Suspense` wrappers. They render per request, as one blocking route, so there is no streamed boundary to hydrate. This also makes `notFound()` return a real 404, which closes the 200-status gap logged earlier.

## 2026-10-30: Migration resets the daily counter instead of carrying old counts over
**Context:** `usage.llm_runs` counted provider runs. The new `usage.specs_started` counts new specs, so the old numbers mean something else.
**Decision:** Migration `0001_adaptive_interview` renames the column and sets it to 0 for all rows.
**Alternatives:** Carry the counts over (a user near the old run limit would be blocked by a count of a different kind).
**Consequence:** Owners get a fresh daily allowance on deploy. Acceptable before T8 (no production users yet).

## 2026-10-30: The interview prompt names vague answers explicitly
**Context:** In a live test, the question after "It depends, maybe the finance team" ignored that answer. SPEC §9 asked for follow-ups on vague answers, but the prompt did not say how.
**Decision:** The v2 prompt requires that after a vague or hedged answer (for example "it depends", "maybe", "not sure", or a word or two), the next question asks about that answer directly and quotes its key words.
**Alternatives:** Leave the general rule and rely on the model (the test showed it does not reliably follow it); enforce follow-ups in code (hard to judge in code).
**Consequence:** One live check with a second spec now shows the follow-up. Eval T7 should measure this rate.

## Problem: Test timing under load
**What happened:** One full test run during the live browser checks reported 5 failures. The rerun passed all 123. The service tests run PGlite migrations per test, which can exceed the default timeout when the machine is busy.
**Fix:** Not changed yet. If it recurs, raise `testTimeout` for the database test files in `vitest.config.mts`.

## 2026-10-30: Added framer-motion and lucide-react for T6b
**Context:** SPEC §11 asks for subtle motion (step transitions, typing, typewriter reveal, animated progress) and icons. Both need a library, and CLAUDE.md requires a logged reason.
**Decision:** framer-motion (motion, with reduced motion read per component and set globally by MotionConfig) and lucide-react (icons). These are the only two new dependencies. Inter and Geist Mono load with next/font/google.
**Alternatives:** CSS keyframes only (no reduced-motion or layout animation control in one place); an icon set copied into the repo (more code to maintain).
**Consequence:** Every animated component needs a reduced-motion path. The typewriter and typing dots render their final state when reduced motion is on.

## 2026-10-30: Dark-first design, with the tokens checked by a test
**Context:** SPEC §11 asks for a dark-first theme with design tokens. The colours must meet WCAG AA, and the CSS and any TypeScript use must not drift apart.
**Decision:** The palette lives in src/lib/design/tokens.ts and is mirrored as CSS variables in globals.css. A Vitest test computes the contrast ratio of each text pair (at least 4.5 to 1) and checks that globals.css matches the token file.
**Alternatives:** Tailwind default colours (no token contract, weaker brand); a light theme with a switch (out of scope).
**Consequence:** Changing a colour means changing it in two places, and the test fails if they differ.

## 2026-10-30: Generation stages follow the character count, not real steps
**Context:** The model returns one JSON document, so the server has no real step boundaries to report. SPEC §11 wants stages that move while the spec is written.
**Decision:** The five stage labels advance at fixed character counts (src/lib/specs/format.ts). The progress bar is an estimate that stops at 95 percent until the spec arrives. The live counter is the real progress.
**Alternatives:** Ask the model for stage markers (costs output tokens and can break the JSON); fake timers (would show progress that is not happening).
**Consequence:** The stages are a visual guide. They can be ahead of or behind the model's real work, and the UI says so only through the counter.

## 2026-10-30: Relative dates are rendered on the server from one timestamp
**Context:** Showing "12 min ago" in the browser would give a different value on the server and the client, causing a hydration mismatch.
**Decision:** The server page passes an ISO timestamp of its own render time. SpecCard and HistoryList compute the relative date from that value, so the HTML and the hydrated page agree.
**Alternatives:** Compute the time in the browser after mount (the first paint would show nothing or a different value).
**Consequence:** A page left open for a long time shows dates as of when it was loaded, until a reload.

## Problem: Mobile layout overflowed sideways
**What happened:** At 375px the result page and its sticky section nav made the page wider than the screen. The text and the action buttons were cut off on the right.
**Fix:** The two-column grids on the result, interview and generating screens now set an explicit single column with minmax(0, 1fr) below the breakpoint, and the nav has min-width 0. A browser check measures the page width at 375px on each screen.

## Problem: Test timing under load (recurred)
**What happened:** During the browser checks, six database tests failed with "Hook timed out in 10000ms" in beforeEach (PGlite migrations). They passed on a rerun with the dev server idle.
**Fix:** vitest.config.mts sets hookTimeout to 60 s and testTimeout to 30 s. The database tests run migrations in a fresh database each time, so the time is real work, not a hang.

## 2026-10-30: Eval runs with tsx and a fresh in-memory database
**Context:** `npm run eval` must run outside Next.js and call the real providers (SPEC §13). The interview and generation services already take a database and an LLM client as parameters.
**Decision:** tsx (dev dependency) runs `evals/run.ts` with `--env-file=.env.local`. Each run migrates a fresh PGlite database, so evals never touch the Neon database and never use up the daily limit (the eval sets its own high limit).
**Alternatives:** Run through Vitest (awkward for a long, printed report); call the HTTP routes against a running dev server (needs a server and a real database); use `node --experimental-strip-types` (cannot resolve the extensionless imports in src).
**Consequence:** The eval exercises the same service functions as the routes, but not the route handlers or SSE framing.

## 2026-10-30: Eval metrics are measured from the request count, and some are keyword checks
**Context:** The LLM client does not report whether a response needed a repair. SPEC §13 asks for "valid on first attempt" and assumption coverage.
**Decision:** A step is valid on the first attempt when it made exactly one provider request (every request, including repairs and fallbacks, increments `llm_calls`, so one request means it validated first time). Adaptive follow-up and assumption coverage use the deterministic word check in `src/lib/evals/metrics.ts`: content words of 5+ letters, minus a short stop-word list.
**Alternatives:** Add repair flags to the client result (changes the production type for eval only); use an LLM judge (adds calls and cost, and is not deterministic).
**Consequence:** The keyword metrics are a rough signal. A follow-up can count because of a shared common word. The metrics are documented as proxies in the results.

## 2026-10-30: Eval answer markers for skipped and not-sure answers
**Context:** Clarifications are plain strings (SPEC §13), but the assumption metric needs skipped and "not sure" answers.
**Decision:** The clarification `[skip]` sends a skipped answer and `[not sure]` sends a "not sure" answer. Any other string is a normal answer.
**Alternatives:** An object per clarification (breaks the `string[]` shape in the spec).
**Consequence:** A real answer that is literally "[skip]" cannot be sent in an eval case. No case needs one.

## Problem: Eval run hit the per-spec call cap, and free providers fail often
**What happened:** In the two-case eval on Gemini 3.5 Flash, password-reset passed in 8 calls. csv-export made 12 calls during generation and was stopped by the cap of 12 with "This spec has used its AI calls." Most of the extra calls were repair and fallback requests. Across runs, Groq rate-limited, OpenRouter's free model timed out, and `gemini-2.5-flash` returned 404 for this key, although the key could list it. The model list endpoint does not prove a model accepts chat requests, so the model was picked by a one-request test.
**Fix:** Not changed. The cap is a SPEC §10 rule, and the eval shows it is tight for free models. The eval records the failure and does not raise the cap. Options for later: allow one more repair per spec, or count repairs separately. Only two of the eight cases have run so far; the results are in evals/results/latest.json.

## 2026-10-30: Eval runs cost real provider requests
**Context:** `npm run eval` calls the configured providers, so it uses the user's quota. A full run is about 50 to 100 requests.
**Decision:** The eval runs only when the user asks. `--limit N` runs the first N cases, and `--cases` and `--out` pick a set of cases and a results file. This keeps runs small during development.
**Alternatives:** Run all eight cases every time (uses too much quota on free tiers).
**Consequence:** Results from different runs are kept in separate files under evals/results.

## 2026-10-30: Screenshots use Playwright against a seeded demo owner
**Context:** SPEC §13 and TASKS T8 need `npm run screenshots` to capture Home, a mid-interview state with the coverage panel, Generating, Result, and History from a seeded demo spec.
**Decision:** Playwright (devDependency, Chromium only) drives the running dev server. `scripts/screenshots.mts` seeds five specs under a fixed demo owner UUID and sets the `ss_owner` cookie to that UUID, so real owners' specs are never read or deleted. Seeding writes straight through the repo functions, with no LLM calls. The script is `.mts` because the package is not `"type": "module"`, and top-level await needs ESM under tsx.
**Alternatives:** Playwright's own web server config (starts Next and seeds in a fixture); seeding through the HTTP routes (needs LLM calls for the interview).
**Consequence:** The script needs DATABASE_URL and a running dev server. It deletes the demo owner's earlier specs on each run. Playwright is a dev dependency only; SPEC §3 allows it for screenshots.

## Problem: Missing /api/health route
**What happened:** SPEC §10 lists `GET /api/health` (`{ ok: true }`), but no route existed; the smoke test would have returned 404.
**Fix:** Added `src/app/api/health/route.ts`. It does not touch the database, so it still answers when Neon is asleep.

## 2026-10-30: Scope change: accounts and a light theme are in; email and reset are out
**Context:** The project was signed off with guest-only access and a dark-only theme. The owner wants username and password accounts and a light theme, while keeping email, one-time codes, social login, password reset by email, teams, roles, sharing and payments out.
**Decision:** SPEC §2 non-goals updated: accounts and the theme switch move to scope (§17 and §11). Email in any form, OTP, social login, password reset, teams, roles, sharing and payments stay out. Tasks T10 to T12 added to TASKS.md.
**Alternatives:** Keep accounts out and offer only a shared demo code (no per-user data); add email verification (needs an email provider and would break the no-email rule).
**Consequence:** The 30 Oct entry that excluded a theme switch is superseded by the theme decision below. Specs and their owners are now tied to accounts, which needs a migration and a deploy step.

## 2026-10-30: Theme toggle with an inline script, not a theme library
**Context:** T10 needs Light, Dark and System, applied before first paint with no flash. SPEC §11 allows no new libraries beyond framer-motion and lucide-react.
**Decision:** A small inline script in the document head reads the `localStorage` key `spec-studio-theme` and sets an attribute on `<html>` before the body renders. With no saved choice the default is System (`prefers-color-scheme`). Tokens are CSS variables for both themes.
**Alternatives:** next-themes (works well, but it is a new dependency the spec does not allow without a logged exception); a server-side cookie for the theme (adds a request-time read to pages that are otherwise static).
**Consequence:** No new dependency. The script must stay small and must use the stored key exactly. Tests check the attribute, persistence and the System default.

## 2026-10-30: Better Auth with the username plugin, and a placeholder email
**Context:** Accounts need passwords, sessions and a username, with no email and no custom cryptography. Better Auth's user model requires an email field.
**Decision:** Better Auth with email and password support and the username plugin, using its Drizzle adapter on the existing Neon Postgres. Each account stores a placeholder email `<username>@users.invalid`. `.invalid` is reserved and never routable. The app never sends email, email verification is off, and password reset routes are not enabled. The library hashes passwords.
**Alternatives:** Auth.js with a credentials provider (still needs our own password storage and session handling); Lucia (deprecated as a library); custom password hashing (not allowed by the working rules); asking for a real email (conflicts with the no-email rule).
**Consequence:** Better Auth is a new dependency, and its SPEC §3 entry records this reason. The `user` table holds a placeholder email that nothing reads.

## 2026-10-30: No password reset, and the sign-up warning says so
**Context:** Without email there is no safe way to verify an address, so a reset link cannot be sent. An operator-run reset would let the operator take over any account.
**Decision:** No password reset exists. The sign-up form shows a warning and requires a checkbox: there is no password reset, a lost password means the account and its specs cannot be recovered, and a password from another site should not be reused. The privacy page says the same.
**Alternatives:** An operator reset (the operator could read or take over accounts, which is worse for the user); recovery codes shown once at sign-up (possible later, out of scope now).
**Consequence:** Forgetting a password is permanent loss. This is a deliberate trade-off, and it is documented for users and in the docs.

## 2026-10-30: Rate limits live in Postgres, not in memory
**Context:** On Vercel, requests can run on different instances, so in-memory counters do not hold. The spec asks for per-IP and per-username sign-in limits with backoff, and a per-IP sign-up limit.
**Decision:** A `rate_limit` table keyed by `signin:ip:<ip>`, `signin:user:<username>` and `signup:ip:<ip>`, updated with conditional statements. Per username: block for one minute after five consecutive failures, doubling up to a 60-minute cap. Per IP sign-in: 20 attempts per 15 minutes. Sign-up: 5 accounts per IP per hour. A success resets the username count.
**Alternatives:** Redis or Upstash (a new service to run); the library's built-in rate limiter (not checked against the spec's per-username backoff, so I chose our own table to keep one store and exact rules).
**Consequence:** Limits are best effort. The IP comes from the platform header, and a shared IP can be blocked by others. There is no CAPTCHA, by design.

## 2026-10-30: Guest and user identity, and the owner columns
**Context:** Guests are identified by the `ss_owner` cookie. Signed-in users need their specs everywhere, and existing guest specs must keep working. Every query already filters on an owner, and a missed filter would leak data.
**Decision:** `specs` keeps `owner_id` (the guest cookie) and adds a nullable `user_id`. `getOwner(request)` returns `{ kind: "user", userId, ownerId }` or `{ kind: "guest", ownerId }`. A user's queries use `user_id`. A guest's queries use `owner_id` with `user_id IS NULL`. Claiming sets `user_id` on matching guest specs only.
**Alternatives:** Replace `owner_id` with the user id on claim (loses the link to the browser and makes the guest rules harder to test); separate tables for guest and user specs (duplicated code paths).
**Consequence:** Tests must cover both scopes and cross-scope access. Routes take identity only from `getOwner`, never from a request body.

## 2026-10-30: Usage counters are keyed by subject, and a claim takes the larger count
**Context:** Usage was keyed by `owner_id`. A signed-in user needs a counter of their own, and claiming guest specs must neither double-count nor reset a limit.
**Decision:** `usage` is keyed by `subject` (`guest:<owner_id>` or `user:<user_id>`) and `day`. The migration rewrites existing rows to `guest:<owner_id>`. On claim, the user's counter for each claimed day becomes the larger of the user's and the guest's counts.
**Alternatives:** Sum the two counts (double-counts specs already counted under the guest key on the same day); reset the guest counter on claim (a user could claim repeatedly to reset the guest limit).
**Consequence:** Taking the maximum is slightly generous when a guest made specs on several devices. It is simple to explain and to test.

## 2026-10-30: Global budget counts provider requests and reserves them first
**Context:** Free LLM quota is shared by everyone. Per-owner limits do not protect it when guests can clear cookies to get a new allowance.
**Decision:** `llm_budget` holds one row per UTC day with a call count. Every provider request reserves one unit with a conditional update before it is sent, as the per-spec cap does. When the budget is used up, the request returns 429 `demo_capacity` and no provider is called. The default is 600, set by `GLOBAL_DAILY_LLM_CALL_BUDGET`.
**Alternatives:** Count specs instead of requests (one spec can use up to 12 requests, so specs do not measure cost); a provider dashboard limit (not reliably available on free tiers).
**Consequence:** The budget can run out before the next UTC day, and then everyone is blocked until it resets. The message says so. This is the intended backstop.

## 2026-10-30: Password rules follow length, not composition
**Context:** Composition rules (a symbol and a number) push users toward predictable patterns, and the spec asks for a simple, testable rule.
**Decision:** Passwords are 10 to 128 characters with no composition rules. A small list of very common passwords is blocked, kept in `src/lib/auth/`. Usernames are 3 to 24 characters, letters, digits and underscore, unique case-insensitively.
**Alternatives:** A breached-password service (an external call and a new dependency); composition rules (weaker in practice and harder to explain).
**Consequence:** The common-password list is short and will not catch everything. It is documented as a basic check.

## 2026-10-30: Known abuse limits are accepted, with the budget as the backstop
**Context:** A guest can clear the cookie and get a new guest allowance. A bot can create accounts from many IPs. The spec asks for per-IP sign-up limits and no CAPTCHA.
**Decision:** Accept that a determined user can exceed the guest allowance by clearing cookies. The global daily budget caps total provider spend. Sign-up is limited per IP, documented as best effort.
**Alternatives:** A CAPTCHA (a third-party service, and bot-detection bypass work is out of scope); a per-IP spec limit for guests (a second identity to reconcile; not requested).
**Consequence:** The free quota is protected by the budget, not by identity. The docs say this plainly.

## 2026-10-30: Deploy order for accounts
**Context:** The live site on Vercel runs the guest-only code against the current Neon schema.
**Decision:** Before the next deploy, apply the T11 migration to Neon and set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DAILY_SPEC_LIMIT_USER` and `GLOBAL_DAILY_LLM_CALL_BUDGET` in Vercel. The migration rewrites `usage` keys, so it must run before the new code serves requests.
**Alternatives:** Deploy code first (it would fail on the missing columns); keep the old usage key during a transition (adds code paths for no lasting benefit).
**Consequence:** There is a short window where old code and the new schema must not run together. Run the migration as one step before the deploy.

## 2026-10-30: Light, dark and system theme with CSS variables and no library
**Context:** SPEC §11 and T10 ask for a three-state theme (Light, Dark, System, default System). The earlier dark-first decision (above, "Dark-first theme") is superseded for the theme switch. The choice must apply before first paint, so no wrong theme flashes.
**Decision:** The choice is saved in `localStorage` under `spec-studio-theme`. An inline script in `<head>` (`THEME_INIT_SCRIPT`, `src/lib/theme/theme.ts`) sets `data-theme` on `<html>`. `globals.css` holds the dark values in `:root` and the light values in `:root[data-theme="light"]`. `src/lib/design/tokens.ts` holds `DARK_TOKENS` and `LIGHT_TOKENS`, and a test checks both the contrast and that the CSS matches.
**Alternatives:** `next-themes` (a new library, outside the two allowed in SPEC §3); Tailwind `dark:` variants (every utility would be written twice); inverting the dark palette (SPEC §11 asks for a designed light theme).
**Consequence:** Every new colour needs a light value and a contrast check in both themes. A hard-coded hex or rgba in a component will not follow the theme, so shadows and glows use variables too.

## Problem: A running dev server kept serving the old stylesheet
**What happened:** During the T10 check, a dev server already running on port 3000 served the pre-change `globals.css` (no `data-theme` rules), so the toggle changed the attribute but the colours did not change. A second `next dev` refused to start because of the lock.
**How it was fixed:** The change was checked on a production build (`next build`, then `next start` on port 3001). The stale server was left alone, since it was not started for this task. Restarting the dev server clears this.

## 2026-10-31: Better Auth with a route gate, and no email anywhere
**Context:** SPEC §17 asks for username and password accounts with no email, no verification and no password reset. Better Auth is the stack choice in SPEC §3.
**Decision:** Better Auth 1.7 with the username plugin and the Drizzle adapter, database sessions. Each account gets the placeholder `<username>@users.invalid`. Only four library routes are reachable (`get-session`, `sign-in/username`, `sign-up/email`, `sign-out`). The gate in `src/app/api/auth/[...all]` blocks every other path, so reset and verification routes that ship with the library stay unreachable. The same gate applies the rate limits and returns the generic sign-in error.
**Alternatives:** Auth.js (built around email providers); exposing every library route and relying on configuration (a reset route would then be one config change away); a hand-written password store (SPEC §17 forbids custom cryptography).
**Consequence:** Upgrading Better Auth must re-check the allowlist in `src/lib/auth/gate.ts`. Sign-up and sign-in rate limits live in the database, so they are best effort across instances.

## 2026-10-31: Specs are scoped by user or guest, and usage by subject
**Context:** A signed-in user must see their specs on any device, and a guest must not see a user's specs. Usage counters were keyed by the guest cookie.
**Decision:** `Owner` is either `{ kind: "guest", ownerId }` or `{ kind: "user", userId, ownerId }` (`src/lib/owner/scope.ts`). A user's scope is `user_id = userId`. A guest's scope is `owner_id = cookie AND user_id IS NULL`. Usage is keyed by `subject` (`guest:<owner_id>` or `user:<user_id>`). Better Auth ids are text, so `specs.user_id` is text.
**Alternatives:** A uuid `user_id` (Better Auth ids are not uuids by default); one scope for both kinds (a guest could then see a claimed spec).
**Consequence:** Every repository function takes an `Owner`. Tests use `{ kind: "guest" }` owners.

## 2026-10-31: The usage migration is written by hand
**Context:** `drizzle-kit generate` asks an interactive question when a column changes (owner_id to subject), which cannot be answered in a non-TTY shell.
**Decision:** The change is split into `0002_accounts` (generated, no prompt) and `0003_usage_subject` (hand-written). `0003` rewrites existing rows to `guest:<owner_id>` before dropping the old column. Its snapshot was derived by hand from `0002`.
**Alternatives:** Dropping the usage table (loses counts); running generate in a TTY (not possible in this shell).
**Consequence:** Check the `0003` snapshot if `drizzle-kit generate` ever reports unexpected changes to `usage`.

## 2026-10-31: The global call budget is reserved before every provider request
**Context:** The LLM client calls `onRequest` before every provider attempt, including fallbacks and repairs (SPEC §8). The per-spec cap is already reserved there.
**Decision:** `specCallReservation` reserves one spec call, then one unit of `GLOBAL_DAILY_LLM_CALL_BUDGET`. When the budget is used up, it returns 429 `demo_capacity` before any provider is contacted.
**Alternatives:** Count per spec (does not limit total spend); reserve after the call (a provider call would already be charged).
**Consequence:** A refusal on the per-spec cap still leaves the budget unchanged, but a refusal on the budget leaves the spec count one higher. Both refusals happen before any provider call.

## Problem: Date parameters inside raw SQL fail on Postgres
**What happened:** The rate limiter passed `Date` objects into `sql` templates. Unit tests on PGlite accepted them, but Neon's driver failed with `ERR_INVALID_ARG_TYPE`, so every sign-up returned a 500.
**How it was fixed:** The raw SQL now takes ISO strings with an explicit `::timestamptz` cast. Drizzle's typed columns still take `Date` objects.

## Problem: Dynamic pages must opt in under cache components
**What happened:** `next.config.ts` enables `cacheComponents`. The new not-found, sign-in, sign-up and privacy pages read headers through the header component, so the production build tried to prerender them and failed.
**How it was fixed:** Those pages call `connection()` and export `instant = false`, as the home page already does.

## Problem: End-to-end sign-up is slower than the default expect timeout
**What happened:** A sign-up takes about 6 seconds against Neon (password hashing plus several writes), and the page then loads the home page. The 15-second expect timeout was too short for the sign-up test on some runs.
**How it was fixed:** `playwright.config.ts` sets the expect timeout to 45 seconds. The e2e run also creates one account per run, and the account is deleted by the last test.

## 2026-10-31: Docs describe the code, and the live demo is labelled as earlier
Context: T12 asks for docs that match the code. The live Vercel demo was deployed before the accounts work, and I have not redeployed it from here.
Decision: The docs describe the current code, including accounts and the theme. The README says that the live demo may run an earlier version until it is redeployed. Evals were not rerun, as T12 asks, so the eval numbers in the README are from the earlier run.
Alternatives: Wait to write the docs until the redeploy (leaves the repo without accurate docs); describe the live demo as current (would be untrue).
Consequence: The eval table is older than the code. Rerun the eval before quoting new numbers.
