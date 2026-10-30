# Build process

How Spec Studio was built with Claude Code: one spec, one task at a time, a decision log, and a human checking each step in the browser.

Related: [README](../README.md) · [Design decisions](DESIGN_DECISIONS.md) · [SPEC.md](../SPEC.md) · [TASKS.md](../TASKS.md)

## The method

The project was built from three files, in this order:

1. **[SPEC.md](../SPEC.md)** is the source of truth. It defines the product, the stack, the data model, the Zod schemas, the prompts, the API, the UI screens, the error states, the tests, and 15 acceptance criteria. It also lists non-goals, which were off limits.
2. **[TASKS.md](../TASKS.md)** splits the spec into ordered slices. Each task has a "done when" list. Tasks were built in order, one per session.
3. **[CLAUDE.md](../CLAUDE.md)** sets the working rules: build one task at a time, keep to the stack, validate every model response, never commit secrets, and log every non-obvious decision.

A task was finished only when all of the following were true:

- `npm run typecheck`, `npm run lint`, and `npm run test` pass.
- The checkbox in TASKS.md is ticked.
- The decisions and problems were added to [DECISIONS.md](../DECISIONS.md).
- The work was committed with a `feat:`, `fix:`, `test:`, `docs:` or `chore:` prefix.

Slash commands wrapped the routine: `/next` built the next unchecked task, and `/signoff` produced the final documentation. The sign-off was run only when the project owner said so.

## Task history

The commit history shows the order. The spec changed twice in the middle, and each change was a new documented task rather than a silent edit.

| Task | What it delivered | Commit |
|---|---|---|
| T0 | Scaffold: Next.js, strict TypeScript, Tailwind, ESLint, Vitest, CI | `8ecc4bc` |
| T1 | Zod schemas, integrity checks, Markdown export, with tests | `90d4947` |
| T2 | LLM provider layer: fallback, cooldown, JSON repair | `e88d8b2` |
| T3 | Database schema, owner-scoped repository, owner cookie | `5eeb9ed` |
| T4 | Prompts and question endpoints (later replaced by T6a) | `71999ec` |
| T5 | Generation endpoint with SSE and the daily cap | `368a9cf` |
| T6 | First UI: home, wizard, history, delete, copy, download | `a112ccc`, `b1626a1` |
| T6a | Adaptive one-question interview: backend and state machine | `147191e` |
| T6b | Dark-first UI redesign on the interview flow | `ca81f94` |
| T7 | Eval runner and metrics | `eefe8ba` |
| T8 | Screenshots, health route, drizzle script fix, deploy | `eaefeb6`, `9abf245`, `fcea6c3` |
| T9 | Sign-off: final portfolio documentation, run only on the owner's word | `bf7801d` |
| T10 | Light, dark and system theme, with contrast tests | `14ae671`, `ac71704` |
| T11 | Username and password accounts, guest claiming, account deletion, per-user and global limits | `13e1d47` |
| T12 | Documentation for accounts and the theme, screenshots refreshed | `c4dfe4a` |

T4 was a first version of the question flow, which T6a replaced. Both are kept in the history, and the legacy specs created by T4 to T6 still open read-only. That is documented in the [design decisions](DESIGN_DECISIONS.md#legacy-specs-stay-readable-and-are-not-migrated-30-oct).

## What the AI did well

- **Following a spec.** The schemas, the interview state machine and the repository scoping follow the wording of SPEC §6, §10 and §5 closely. The code and the spec can be compared line by line.
- **Tests alongside code.** Tasks with rules shipped tests for them, including the cases the spec names: duplicate IDs, dependency cycles, the minimum of four turns, the forced done at eight, and cross-owner access.
- **Diagnosing failures from a log.** The Postgres `42P01` error, the Next.js prerender errors and the test timeouts were each traced to a cause from the log, not guessed.
- **Keeping the decision log current.** The log in [DECISIONS.md](../DECISIONS.md) records alternatives and consequences, which is what makes this page possible.

## What needed a human

Each of these was found by running the app, not by the checks. Most were caught in a browser or against the real database.

- **A vague answer was ignored.** A live test showed the question after "It depends, maybe the finance team" did not refer to that answer. The fix was a more specific prompt rule and a metric to measure it. See [PROMPT_DESIGN](PROMPT_DESIGN.md).
- **Interactive controls did nothing.** After a prerender fix, the spec page's buttons had no handlers because the streamed section never hydrated. The fix was a change of rendering mode. See [the problem log](DESIGN_DECISIONS.md#suspense-streamed-sections-never-hydrated).
- **Mobile layout overflowed.** The 375px check found sideways scrolling on the result page. See [the problem log](DESIGN_DECISIONS.md#mobile-layout-overflowed-sideways-at-375px).
- **The database was not set up.** The first request failed because the migration had not been run on the Neon database. A second issue then made the migration command use an empty URL. Both are in [the problem log](DESIGN_DECISIONS.md#the-migration-command-silently-used-an-empty-database-url).
- **The eval exposed a real limit.** The first eval runs showed that the 12-call cap is tight for free models. The result is recorded rather than hidden. See [EVALS](EVALS.md#known-gaps).
- **Unit tests missed a production failure.** The rate limiter passed `Date` objects into raw SQL. The PGlite unit tests passed, and every sign-up failed on Neon until a browser test ran the real path. The fix is in [the problem log](DESIGN_DECISIONS.md#raw-sql-rejected-date-parameters-on-neon). The end-to-end tests now cover sign-up on the real database.

## What I would do differently

- **Measure earlier.** The eval suite came at T7, after most of the product was built. Running a small eval after T6a would have shown the call-cap problem sooner, while the interview design was still open.
- **Test the rendering modes early.** The prerender and hydration problems came from changing the page rendering model partway through. A quick browser check after each rendering change would have caught them sooner.
- **Keep the cost of a run in view.** Eval runs and screenshots both touch real services. Those steps should have an explicit budget before they run, not one decided after the fact.

## Reproducing the process

1. Read [SPEC.md](../SPEC.md) and [TASKS.md](../TASKS.md).
2. Build one unchecked task at a time. Run the three checks before ticking its box.
3. Log every non-obvious decision and every real problem in [DECISIONS.md](../DECISIONS.md).
4. Check each task in a browser at 375px and on desktop before moving on.
