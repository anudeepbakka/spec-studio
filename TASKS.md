# Tasks

Build in order, one per `/next`. Tick the box when done. Scope is in SPEC.md.

- [x] **T0 Scaffold.**
  Next.js (App Router) + TypeScript strict + Tailwind + ESLint + Vitest + Drizzle config. npm scripts from CLAUDE.md.
  `.env.example` (SPEC §14), `.gitignore` (env, `RESUME_NOTES.md`, `.next`), short README stub, GitHub Actions CI (lint, typecheck, test).
  *Done when:* `npm run dev` shows a placeholder home page; CI file exists; all checks pass.

- [x] **T1 Schemas, validation, Markdown export (pure code, no LLM).**
  Zod schemas from SPEC §6 including referential-integrity checks (`superRefine`). `toMarkdown(spec)` exporter per SPEC §7.
  *Done when:* unit tests cover valid spec, each invalid case (duplicate IDs, bad references, dependency cycle, too few criteria), and a snapshot of the exported Markdown.

- [x] **T2 LLM provider layer.**
  `src/lib/llm/`: `LLMProvider` interface, OpenAI-compatible client, provider registry from env, ordered fallback, 60s cooldown after 429, timeout, JSON extraction (strip code fences) + Zod validate + one repair retry (SPEC §8).
  *Done when:* tests with mocked `fetch` cover success, 429 then fallback, invalid JSON then repair success, repair failure then next provider, all providers failing (typed error).

- [ ] **T3 Database and owner identity.**
  Drizzle schema + migration for `specs` and `usage` (SPEC §5). Repository functions. Anonymous owner cookie (`ss_owner`, httpOnly UUID) set by middleware.
  *Done when:* tests (or a script against a local/Neon DB) cover create, get, list, delete scoped by owner; one owner cannot read another's spec.

- [ ] **T4 Prompts and clarifying questions endpoint.**
  `src/lib/prompts/` (versioned, SPEC §9). `POST /api/specs`, `POST /api/specs/:id/questions`, `PUT /api/specs/:id/answers`.
  *Done when:* endpoints work with a real provider key; invalid input returns typed 400 errors; questions pass the Zod schema.

- [ ] **T5 Spec generation endpoint with SSE and rate limit.**
  `POST /api/specs/:id/generate` streams `progress` events, validates with Zod at the end (repair retry), saves, emits `spec` or `error`. Daily cap per owner via `usage` table (SPEC §10). `GET /api/specs/:id/export`.
  *Done when:* a full flow works from curl; a 429 is returned when the cap is hit; failures leave the spec in `failed` status with a message.

- [ ] **T6 UI.**
  Home (new request + recent specs), spec page wizard (Request, Questions, Generating, Result), delete, copy, download Markdown. Pages per SPEC §11.
  *Done when:* the full flow works in the browser on desktop and mobile widths; every error state in SPEC §12 is visible and friendly.

- [ ] **T7 Evals.**
  `evals/cases.json` (8 generic cases per SPEC §13), `npm run eval` script, results to `evals/results/latest.json` with the metrics in SPEC §13.
  *Done when:* eval runs end to end against real providers and prints a summary table; Vitest covers the metric functions.

- [ ] **T8 Polish and deploy.**
  Loading, empty, and error states; basic accessibility (labels, focus, contrast); `npm run screenshots` (Playwright, seeded demo spec); deploy to Vercel with Neon Postgres; set env vars; smoke-test the live URL.
  *Done when:* live demo works; the SPEC §15 acceptance criteria all pass manually.

- [ ] **T9 Sign-off.** Only when the user says so: run `/signoff`.
