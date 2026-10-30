# Design decisions

The reasons behind the main choices, the alternatives I rejected, and the problems I hit along the way. Written as short decision records, with the problems at the end.

Related: [Architecture](ARCHITECTURE.md) · [Prompt design](PROMPT_DESIGN.md) · [Evals](EVALS.md) · [Build process](BUILD_PROCESS.md)

The full log is [DECISIONS.md](../DECISIONS.md). This page keeps the decisions that shaped the product. Dates are when each was made.

## LLM layer

### Free-tier providers behind one interface (21 Oct)
- **Context:** No budget for paid APIs. Free tiers are rate-limited, and free models are less reliable at structured JSON.
- **Decision:** One `LLMProvider` interface over OpenAI-compatible endpoints (Groq, OpenRouter, Gemini), tried in order.
- **Alternatives:** One provider only; a local model through Ollama.
- **Consequence:** Providers can be swapped by configuration. The cost is provider quirks, which the client has to absorb.

### Fallback on any provider error, cooldown only on 429 (30 Oct)
- **Context:** The spec lists 429, 5xx, timeouts and network errors as fallback triggers. A 401 (bad key) is not listed.
- **Decision:** Any provider error moves to the next provider. A 429 also puts that provider on a 60-second cooldown. Other errors are not cooled down.
- **Alternatives:** Fall back only on the listed errors, so a 401 fails the whole request.
- **Consequence:** A misconfigured provider costs one failed call per request, but the app still answers from the others.

### A missing key skips a provider, a missing model stops startup (30 Oct)
- **Context:** The spec says a provider without a key is skipped, and also that a listed provider with a missing key or model should fail with a clear message. The two conflict.
- **Decision:** No key means skip. A key with no model throws an error that names the variable.
- **Alternatives:** Fail on any missing key; skip on a missing model too.
- **Consequence:** A half-configured provider is caught at once, and an intentionally unused one does not break the app.

### Repair call lives in the LLM layer (30 Oct)
- **Context:** The spec asks for one repair call. Prompts were planned for a later module.
- **Decision:** The repair message builder sits next to the JSON parsing in `src/lib/llm/json.ts`.
- **Alternatives:** Build the repair prompt with the prompts module.
- **Consequence:** The LLM layer is self-contained and was testable before prompts existed.

### Streaming progress only when a caller asks for it (30 Oct)
- **Context:** The question path uses plain `chat`, and its tests stub only `chat`.
- **Decision:** `generateJson` takes an optional progress callback. With it, the call uses `chatStream` and reports the running length. Without it, it uses `chat`. JSON mode is kept on streamed calls too.
- **Alternatives:** Always stream (changes the question path and its tests); drop JSON mode for streams (more repair retries).
- **Consequence:** The progress count restarts when a repair begins.

## Validation

### Integrity checks run after shape validation (30 Oct)
- **Context:** The spec needs referential checks (IDs, references, cycles, coverage) on top of shape rules.
- **Decision:** Shape rules are plain Zod. Integrity rules run in one `superRefine` on the spec, so they only run once the shape is valid. Each issue carries a path and a readable message.
- **Alternatives:** Run integrity checks on the raw JSON; one large inline `superRefine`.
- **Consequence:** A model that gets the shape wrong sees shape errors first. The readable messages feed straight into the repair prompt.

### Fixed ID formats enforced by regex (30 Oct)
- **Context:** The spec fixes the ID formats (`US-1`, `AC-1.1`, `EC-1`, `T-1`) and the model must follow them.
- **Decision:** Each ID type has a regex. Question IDs are only checked for uniqueness, because the spec gives no format for them.
- **Alternatives:** Accept any string and rely on the prompt.
- **Consequence:** Format drift gets a clear error, which the repair step can fix. The cost is more repair calls.

### Question IDs are assigned by the server (30 Oct)
- **Context:** Letting the model choose IDs means trusting its output for keys.
- **Decision:** The model returns questions without IDs. The server assigns `Q-n`.
- **Alternatives:** Trust the model's IDs and check them for duplicates.
- **Consequence:** An invalid ID from the model cannot break the transcript.

## Data and identity

### Driver choice: postgres-js in production, PGlite in tests (30 Oct)
- **Context:** The spec asks for Postgres on Neon with Drizzle. Repo tests need a real database without a server.
- **Decision:** Production uses `postgres` with `drizzle-orm/postgres-js` and `max: 1`. Tests run the generated migration on `@electric-sql/pglite`, an in-process Postgres, so the SQL really executes.
- **Alternatives:** `@neondatabase/serverless` (a Neon-only HTTP driver); mocking the query chain (brittle, and it cannot test owner scoping).
- **Consequence:** Two new dependencies. Both drivers satisfy one `Db` type, so typecheck confirms they match.

### Every repository function takes the owner (30 Oct, widened on 31 Oct)
- **Context:** A forgotten `where` clause would leak another owner's specs.
- **Decision:** Every function in `src/lib/db/repo.ts` takes an `Owner` and applies one scope from `src/lib/owner/scope.ts`. A guest's scope is the cookie with no `user_id`. A user's scope is the user's `user_id`. Another owner's spec returns "not found", the same as a missing ID.
- **Alternatives:** A query-builder wrapper that adds the filter automatically. More abstraction, which I did not want.
- **Consequence:** A test covers each function. The API takes the owner from the cookie, never from the request body.

### Anonymous owner cookie, set by the proxy (30 Oct)
- **Context:** The spec says middleware. Next.js 16 renamed it to `proxy`.
- **Decision:** The cookie logic lives in `src/proxy.ts`. It is `httpOnly`, `sameSite=lax`, one year, and `secure` in production. The pure logic is in `src/lib/owner/owner.ts`, which is unit tested.
- **Alternatives:** `middleware.ts`, which warns on every build in Next 16.
- **Consequence:** No warnings on Next 16. A guest has no account, so clearing the cookie hides their specs. A signed-in user is identified by the session instead, and keeps their specs in any browser.

### A missing owner cookie is a 401 on API routes (30 Oct)
- **Context:** On a first visit, the proxy sets the cookie on the response, so the route handler cannot see it yet.
- **Decision:** API routes return 401 `owner_required` when the cookie is missing. The browser always loads a page first, so it always has the cookie.
- **Alternatives:** Forward the new ID from the proxy to the route, or create an owner inside the route (which would orphan the spec from the cookie).
- **Consequence:** A bare `curl` must load `/` with a cookie jar first.

## Limits and cost

### Daily limit reserved atomically before the call (30 Oct)
- **Context:** The spec says an over-limit request must cost nothing at a provider. Checking first and counting afterwards lets parallel requests overshoot.
- **Decision:** One `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement reserves the count before any provider is contacted. A run that then fails still counts.
- **Alternatives:** Count only successful runs (a race-prone count); a separate read then write (overshoots under parallel requests).
- **Consequence:** A failed first question uses up one of the day's specs. The 429 message gives the reset time as 00:00 UTC.

### The limit counts specs, and each spec has a call cap (30 Oct)
- **Context:** One interview now takes up to eight question calls plus generation and repairs. A per-call daily limit would be used up by one spec.
- **Decision:** `DAILY_SPEC_LIMIT` (default 5) counts new specs at their first question. A separate constant `MAX_LLM_CALLS_PER_SPEC = 12` counts every provider request for a spec, including repairs and fallbacks, and is reserved before each one.
- **Alternatives:** The old per-call daily limit; counting only successful calls (a failing provider could drain free quota).
- **Consequence:** Resuming a spec never costs more of the daily limit. The 12-call cap is tight. The eval hit it (see [the problem below](#eval-run-hit-the-per-spec-call-cap-and-free-providers-fail-often)).

### Migration resets the daily counter (30 Oct)
- **Context:** The old column counted provider runs. The new one counts new specs, so the old numbers mean something else.
- **Decision:** The migration renames the column and sets it to zero.
- **Alternatives:** Carry the counts over, which would block a user near the old limit on a different measure.
- **Consequence:** Owners get a fresh allowance on deploy. This was acceptable because there were no production users yet.

## Interview design

### One question per call, with the full transcript (30 Oct)
- **Context:** The first flow generated four to eight questions at once, so no question could use an earlier answer. It also felt like a form, not a conversation.
- **Decision:** The interview asks one question per LLM call. Each call gets the request and the full transcript. The model returns `done` and the coverage. The server enforces the minimum of four and the maximum of eight resolved turns.
- **Alternatives:** Keep batches and re-ask after each answer (more calls and no one-question rhythm); let the model control the count with no server limit (cannot guarantee the minimum or the cap).
- **Consequence:** Each question waits for the previous answer, so latency is per turn. A full interview costs up to eight calls.

### Counting rules for resolved, real and skipped answers (30 Oct)
- **Context:** The minimum, the maximum and "finish early" each need a precise count. Skipped, "not sure" and a real answer mean different things.
- **Decision:** A turn is resolved when it has any answer. The minimum and maximum count resolved turns. Finish early needs three real answers. "Not sure" becomes an open question. Skipped becomes an assumption.
- **Alternatives:** Count only real answers toward the minimum (a user who skips a lot would never reach done); let finish early accept any resolved turns (could generate from almost nothing).
- **Consequence:** A user who skips a lot still reaches done through the maximum, and the spec lists many assumptions.

### Legacy specs stay readable and are not migrated (30 Oct)
- **Context:** Specs made with the first flow hold their own questions and answers, and their prompt is retired.
- **Decision:** Legacy rows open read-only. Interview and generate endpoints return 409 `legacy_spec`. Delete and export still work.
- **Alternatives:** Convert old questions into interview turns (the order and coverage would be invented); delete old rows (loses the owner's data).
- **Consequence:** The code keeps one read-only branch for the old flow.

### The prompt names vague answers (30 Oct)
- **Context:** In a live test, a vague answer was ignored by the next question.
- **Decision:** The v2 prompt requires a follow-up that quotes the vague answer's key words.
- **Alternatives:** Keep the general rule; enforce follow-ups in code (hard to judge in code).
- **Consequence:** The follow-up rate is measured in the evals. See [PROMPT_DESIGN](PROMPT_DESIGN.md#why-the-rules-are-there).

### Server-driven wizard step (30 Oct)
- **Context:** A reload or a return visit must land on the right step.
- **Decision:** `stepFor(status)` picks the step from the saved status. The only local state is "Edit answers" and the live progress count. Every change ends with a reload of the record.
- **Alternatives:** A client-side state machine (drifts from the server after a reload or a dropped connection).
- **Consequence:** A reload mid-run shows "still in progress" with a check-again button until the run finishes or goes stale after ten minutes.

### Copy and download use the export endpoint (30 Oct)
- **Context:** The Markdown must be deterministic and snapshot-tested. Copy and download must match the `.md` file.
- **Decision:** Both actions read `GET /api/specs/:id/export`. The browser never builds Markdown.
- **Alternatives:** Render Markdown in the browser (a second copy of the format to keep in sync).
- **Consequence:** Copy needs one extra request. If the clipboard is unavailable, the UI points to Download.

## Accounts and identity

### Username and password, with no email anywhere (30 Oct)
- **Context:** The owner wanted accounts without email. The spec rules out email in any form: no verification, no one-time codes, no social login, and no password reset.
- **Decision:** Accounts use a username and a password only. Better Auth needs an email field, so each account gets the placeholder `<username>@users.invalid`. The `.invalid` domain is reserved, so it can never be routed. Verification is off, and the app sends nothing.
- **Alternatives:** Real email for verification and reset (outside the spec); no library, with a hand-written password store (the spec forbids custom cryptography).
- **Consequence:** A forgotten password cannot be recovered. The sign-up form says so, the privacy page says so, and the sign-up page needs an acknowledgement tick before it submits.

### Better Auth behind a route gate (31 Oct)
- **Context:** Better Auth is the stack choice in the spec. It ships password reset and verification routes, and the spec forbids both.
- **Decision:** The library handles passwords, sessions and cookies. The app puts a gate in front of `/api/auth`. The gate allows four routes: `get-session`, `sign-in/username`, `sign-up/email` and `sign-out`. Every other path returns 404. The gate also applies the rate limits and the generic sign-in error.
- **Alternatives:** Expose every library route and turn the unwanted ones off in configuration (a future config change could then turn a reset route back on); Auth.js (built around email providers).
- **Consequence:** An upgrade of Better Auth must re-check the allowlist, and a test pins it. I chose to fail closed rather than trust the defaults.

### Owner scope is one type, applied in one place (31 Oct)
- **Context:** A signed-in user must see their specs in any browser. A guest must see only specs made in their browser, and a claimed spec must not be visible as a guest any more.
- **Decision:** `Owner` is either a guest (cookie) or a user (session, plus the cookie). `specScope` in `src/lib/owner/scope.ts` builds the one filter. A guest sees `owner_id` equal to the cookie with `user_id` null. A user sees `user_id` equal to their id.
- **Alternatives:** A separate table of owned specs; a per-query filter written in each function (easy to forget).
- **Consequence:** Isolation tests cover each pair of owners, and each repository function takes the owner. Specs have `user_id` as text, because Better Auth ids are not uuids by default.

### Claiming keeps the limit by taking the larger count (31 Oct)
- **Context:** A guest who signs in should keep their specs. Claiming must not reset the day's limit.
- **Decision:** Claiming sets `user_id` on the cookie's unclaimed specs only, so a second claim moves nothing. For the day, the user's usage becomes the larger of the user's and the guest's count.
- **Alternatives:** Add the two counts (counts specs twice when both were used today); reset the guest counter (a user could claim again to reset it).
- **Consequence:** Taking the maximum is slightly generous when a guest used several devices. It is simple to explain and test.

### Usage is keyed by subject, and the migration is written by hand (31 Oct)
- **Context:** Usage counters were keyed by the cookie. A signed-in user needs a counter of their own. `drizzle-kit generate` asks an interactive question when a column changes, which the shell cannot answer.
- **Decision:** `usage` is keyed by `guest:<owner_id>` or `user:<user_id>`. The change is split into `0002_accounts` (generated) and `0003_usage_subject` (hand-written). The hand-written part rewrites existing rows to the guest form before the old column is dropped.
- **Alternatives:** Drop the table (loses the counts); run generate in a terminal (not possible here).
- **Consequence:** The hand-written snapshot must be checked if `drizzle-kit generate` ever reports unexpected changes to `usage`.

### Rate limits live in Postgres, and a username locks with doubling (30 Oct)
- **Context:** Serverless instances do not share memory, so an in-memory limiter would not hold.
- **Decision:** Counters are rows in `rate_limit`, updated with conditional upserts. Sign-in is limited to 20 attempts per IP in 15 minutes. A username locks from its 5th consecutive failure for 1 minute, doubling each further failure to a 60-minute cap. A success resets it. Sign-up is limited to 5 per IP per hour.
- **Alternatives:** Redis (a new service for a small app); in-memory counters (lost between instances).
- **Consequence:** The limits are best effort. The IP comes from the forwarded header, which a client can set on some hosts. The docs say so, and the global budget is the backstop.

### Abuse limits are accepted, not solved (30 Oct)
- **Context:** A guest who clears the cookie gets a new guest allowance. A bot can create accounts from many addresses. The spec says there is no CAPTCHA.
- **Decision:** Accept both. The global daily budget caps the total provider spend, whoever sends the requests.
- **Alternatives:** A CAPTCHA (a third-party service, and bot-detection bypass is out of scope); tying guest limits to an IP (a second identity to reconcile).
- **Consequence:** The free quota is protected by the budget, not by identity. The README says this plainly.

### The global budget is reserved before every provider request (31 Oct)
- **Context:** Free quota is shared by every visitor. Per-owner limits alone do not protect it. The LLM client calls one hook before every provider request, including fallbacks and repairs.
- **Decision:** `specCallReservation` reserves one spec call and then one unit of `GLOBAL_DAILY_LLM_CALL_BUDGET`. When the budget is used up, the request returns 429 `demo_capacity` before any provider is contacted.
- **Alternatives:** Count specs instead of requests (one spec can take up to 12 requests, so specs do not measure cost); a provider dashboard limit (not reliable on free tiers).
- **Consequence:** A refusal on the spec cap still leaves the budget unchanged, but a refusal on the budget leaves the spec count one higher. Neither refusal reaches a provider.

### Password rules follow length, not composition (30 Oct)
- **Context:** Composition rules (a symbol and a number) push people toward predictable patterns.
- **Decision:** Passwords are 10 to 128 characters with no composition rules. A short list of very common passwords is refused. Usernames are 3 to 24 letters, digits or underscores.
- **Alternatives:** A breached-password service (an external call and a new dependency); composition rules.
- **Consequence:** The common-password list is short and will not catch everything. The docs describe it as a basic check.

## Theme

### Light, dark and system theme (30 Oct)
- **Context:** The spec was changed to add a three-state switch: Light, Dark and System, with System as the default. The choice must apply before first paint, so no wrong theme flashes.
- **Decision:** The choice is stored in `localStorage`. An inline script in `<head>` sets `data-theme` on `<html>` before React loads. The colours are CSS variables, with the dark values in `:root` and the light values in `:root[data-theme="light"]`. The light theme is designed for the light background, not inverted from the dark one.
- **Alternatives:** `next-themes` (a library outside the two the spec allows); Tailwind `dark:` variants (every utility written twice); a class-based switch (needs a script anyway).
- **Consequence:** Every new colour needs a light value and a contrast check. A test checks both token sets against WCAG AA and that the CSS matches the TypeScript tokens. Shadows, glows and badge tints use variables too.

## Product and UI

### Dark-first theme, two UI dependencies (30 Oct)
- **Context:** The first UI was a plain form. The product should feel like a modern AI tool. The spec excluded a theme switch.
- **Superseded:** On 30 Oct the spec was changed to add a Light, Dark and System switch. See [Light, dark and system theme](#light-dark-and-system-theme-30-oct). The dark tokens and motion rules below still hold.
- **Decision:** One dark theme, no switch. `framer-motion` and `lucide-react` are the only new libraries. Inter and Geist Mono load with `next/font`.
- **Alternatives:** A light theme with a toggle (more work, not asked for); a component kit such as shadcn (a different look and a larger dependency).
- **Consequence:** Every animated component has a reduced-motion path. A test checks that text colours meet WCAG AA contrast, and that the CSS variables match the TypeScript tokens.

### Generation stages follow the character count (30 Oct)
- **Context:** The model returns one JSON document, so the server has no real step boundaries to report.
- **Decision:** The five stage labels advance at fixed character counts. The progress bar stops at 95% until the spec arrives. The live counter is the real progress.
- **Alternatives:** Ask the model for stage markers (extra output that can break the JSON); fake timers (would show progress that is not happening).
- **Consequence:** The stages are a visual guide, and they may run ahead of or behind the real work.

### Relative dates are rendered on the server (30 Oct)
- **Context:** A relative time computed in the browser differs from the server render, which causes a hydration mismatch.
- **Decision:** The server passes the render time, and cards compute relative dates from it.
- **Alternatives:** Compute in the browser after mount (the first paint would be empty or wrong).
- **Consequence:** A page left open shows dates as of when it was loaded.

## Evals and tooling

### Eval runs with tsx and a fresh in-memory database (30 Oct)
- **Context:** The eval must run outside Next.js and call the real providers.
- **Decision:** `tsx` runs `evals/run.ts`. Each run migrates a fresh PGlite database, so evals never touch Neon or use up the daily limit.
- **Alternatives:** Run through Vitest (awkward for a long printed report); call the HTTP routes (needs a server and a real database).
- **Consequence:** The eval exercises the same service functions as the routes, but not the route handlers or SSE framing.

### Metrics come from request counts and a word check (30 Oct)
- **Context:** The client does not report whether a response needed a repair. The spec asks for "valid on first attempt" and assumption coverage.
- **Decision:** A step is valid on the first attempt when it made exactly one provider request. Follow-ups and assumption coverage use a deterministic word-overlap check with a short stop-word list.
- **Alternatives:** Add repair flags to the client (changes production types for eval only); an LLM judge (extra calls and not deterministic).
- **Consequence:** The keyword metrics are rough signals. They are labelled as proxies in the results.

### Eval runs cost real requests, so they run on demand (30 Oct)
- **Context:** A full run is about 50 to 100 provider requests.
- **Decision:** The eval runs only when asked. `--limit`, `--cases` and `--out` keep runs small.
- **Alternatives:** Run all eight cases every time (too much free quota).
- **Consequence:** Each run is saved separately under `evals/results/`.

### Screenshots from a seeded demo owner (30 Oct)
- **Context:** Screenshots need realistic states, including a mid-interview state with the coverage panel.
- **Decision:** Playwright (Chromium only, dev dependency) drives the dev server. The script seeds specs under a fixed demo owner and sets that owner's cookie, so real owners' specs are never read or deleted.
- **Alternatives:** Seed through the HTTP routes (needs LLM calls for the interview).
- **Consequence:** The script writes to whatever database `DATABASE_URL` points to. Point it at a throwaway database.

## Problems I hit and how I fixed them

### Vitest could not resolve `@/` imports
- **What happened:** The first test run failed with "Cannot find package '@/test/sample-spec'". TypeScript resolved the path, but Vitest uses Vite, which ignores tsconfig `paths`.
- **Fix:** Added the alias to `vitest.config.mts`. The alias is now defined in two places, so keep them in sync.

### Neon tables missing on the first request
- **What happened:** The first `POST /api/specs` returned 500 with Postgres code `42P01` (undefined table). The migration had not been applied to the database.
- **Fix:** Ran the migration. Errors now log only the error name and Postgres code. Driver messages are not logged, because Drizzle puts the SQL and its parameters, including the user's request, into them.

### The migration command silently used an empty database URL
- **What happened:** `npm run db:migrate` failed with "url: ''". `drizzle-kit` does not read `.env.local`, which the app does.
- **Fix:** `db:generate` and `db:migrate` now run `drizzle-kit` with `--env-file=.env.local`, as the eval script does.

### Prerender errors on the home and spec pages
- **What happened:** With `cacheComponents` on, the dev overlay reported "encountered uncached data during prerendering" for `/` and `/specs/[id]`. The cookie and database reads ran before any request-time marker.
- **Fix:** Added `connection()` before those reads. The error then pointed at `connection()` itself, because it blocked the static shell outside a `Suspense` boundary. The per-request reads moved into async children behind `Suspense`.

### Suspense-streamed sections never hydrated
- **What happened:** After the `Suspense` change, the spec page and the recent-specs list rendered, but their buttons did nothing. A click on Send submitted the form natively.
- **Fix:** Both pages export `instant = false`, which makes them blocking routes. They render per request, with no streamed boundary to hydrate. This also makes "not found" return a real 404.

### Mobile layout overflowed sideways at 375px
- **What happened:** The result page and its sticky navigation were wider than the screen, so the right edge was cut off.
- **Fix:** The two-column grids switch to a single column with `minmax(0, 1fr)` below the breakpoint, and the navigation has `min-width: 0`. A browser check measures the page width at 375px on each screen.

### Test timing under load
- **What happened:** During browser checks, database tests failed with "Hook timed out in 10000ms". The database tests run migrations in a fresh database each time, so this happens when the machine is busy.
- **Fix:** `vitest.config.mts` sets the hook timeout to 60 seconds and the test timeout to 30 seconds. The time is real work, not a hang.

### Eval run hit the per-spec call cap, and free providers fail often
- **What happened:** In a two-case eval on Gemini, one spec passed in 8 calls. The other made 12 calls during generation and was stopped by the cap. Most of the extra calls were repairs and fallbacks. Across runs, Groq rate-limited, OpenRouter's free model timed out, and one Gemini model returned 404 for a key that could list it.
- **Fix:** Not changed yet. The cap is a spec rule and the eval shows it is tight for free models. Options: a separate repair budget, or counting repairs separately. The full saved result is in [EVALS](EVALS.md#known-gaps).

### `/api/health` was missing
- **What happened:** The spec lists `GET /api/health`, but no route existed. The smoke test would have returned 404.
- **Fix:** Added the route. It does not touch the database, so it answers even when Neon is asleep.

### A running dev server kept serving the old stylesheet
- **What happened:** During the theme check, a dev server that was already running served the old `globals.css`. The toggle changed the attribute, but the colours did not change. A second `next dev` refused to start because of the lock.
- **Fix:** The theme was checked on a production build on another port. The stale server was left running, and a restart clears it.

### Raw SQL rejected `Date` parameters on Neon
- **What happened:** The rate limiter passed `Date` objects into `sql` templates. The PGlite tests accepted them, but the Neon driver failed with `ERR_INVALID_ARG_TYPE`, so every sign-up returned a 500. The unit tests had not caught it, because PGlite is more lenient.
- **Fix:** The raw SQL takes ISO strings with an explicit `::timestamptz` cast. Typed Drizzle columns still take `Date` objects. The lesson is that a unit test on a different driver does not prove the production path, so the e2e test covers sign-up on the real database.

### Pages with headers under `cacheComponents` must opt in
- **What happened:** The new not-found, sign-in, sign-up and privacy pages read headers through the header component. The production build tried to prerender them and failed.
- **Fix:** Those pages call `connection()` and export `instant = false`, the same pattern as the home page.

### A sign-up takes about six seconds on Neon
- **What happened:** Sign-up hashes the password and writes a user, an account and a session, one query at a time over a single connection. The end-to-end test waited 15 seconds for the redirect and timed out on some runs.
- **Fix:** The expect timeout is 45 seconds in `playwright.config.ts`. The time is real database latency, not a hang. Reducing it would mean connection pooling, which I did not add for a single-user app.

### End-to-end tests started signed out
- **What happened:** Playwright gives each test a fresh browser context, so a test that expected a signed-in menu found none. A second problem was that Next's route announcer is also an `alert`, so a plain alert locator matched two elements.
- **Fix:** Each test that needs the account signs in first, through one helper. The locator targets the form's own alert paragraph.
