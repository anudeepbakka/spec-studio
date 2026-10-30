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

- [x] **T3 Database and owner identity.**
  Drizzle schema + migration for `specs` and `usage` (SPEC §5). Repository functions. Anonymous owner cookie (`ss_owner`, httpOnly UUID) set by middleware.
  *Done when:* tests (or a script against a local/Neon DB) cover create, get, list, delete scoped by owner; one owner cannot read another's spec.

- [x] **T4 Prompts and clarifying questions endpoint.**
  `src/lib/prompts/` (versioned, SPEC §9). `POST /api/specs`, `POST /api/specs/:id/questions`, `PUT /api/specs/:id/answers`.
  *Done when:* endpoints work with a real provider key; invalid input returns typed 400 errors; questions pass the Zod schema.
  *Superseded by T6a (SPEC §10): the v1 question endpoints are removed. Kept as history.*

- [x] **T5 Spec generation endpoint with SSE and rate limit.**
  `POST /api/specs/:id/generate` streams `progress` events, validates with Zod at the end (repair retry), saves, emits `spec` or `error`. Daily cap per owner via `usage` table (SPEC §10). `GET /api/specs/:id/export`.
  *Done when:* a full flow works from curl; a 429 is returned when the cap is hit; failures leave the spec in `failed` status with a message.
  *The daily cap changes in T6a (`DAILY_SPEC_LIMIT`). Kept as history.*

- [x] **T6 UI.**
  Home (new request + recent specs), spec page wizard (Request, Questions, Generating, Result), delete, copy, download Markdown. Pages per SPEC §11.
  *Done when:* the full flow works in the browser on desktop and mobile widths; every error state in SPEC §12 is visible and friendly.
  *The question-first wizard is replaced by T6a and T6b. Kept as history.*

- [x] **T6a Adaptive interview: backend.**
  Replace the one-shot questions with an adaptive interview (SPEC §4, §5, §6, §8, §9, §10, §12).
  - Zod schemas for `Turn`, `Coverage`, `InterviewTurnResponse`, and the server-assigned question IDs. Interview `superRefine` checks.
  - Prompts v2: the question prompt (one question per turn, min 4 and max 8 resolved turns, full transcript as input) and the spec prompt built from the full transcript.
  - Interview state machine in `src/lib/interview/`: next, undo, finish, resume, the 8-turn forced done, and 409 for conflicting states.
  - Endpoints `POST /api/specs/:id/interview/next`, `.../undo`, `.../finish`. Remove the v1 `questions` and `answers` endpoints. `generate` uses the transcript.
  - Drizzle migration: add `interview` (jsonb) and `llm_calls` (int) to `specs`; add the new status values; rename `usage.llm_runs` to `specs_started`. Legacy rows keep `questions` and `answers` and open read-only (SPEC §10).
  - Limits: `DAILY_SPEC_LIMIT` (default 5, counted at the first question) replaces `DAILY_LLM_RUN_LIMIT` in code and in `.env.example`. `MAX_LLM_CALLS_PER_SPEC = 12`, reserved per provider request (SPEC §10). 429 codes `daily_limit` and `spec_call_limit`.
  - The existing UI may be adapted just enough to run the interview. The look is T6b.
  - Tests per SPEC §13: turn schema, state machine (min 4, max 8, forced done, finish early, undo, resume), prompt includes full history, per-spec call cap, daily spec limit.
  - *Done when:* all checks pass; a full interview and generation work from the UI; later questions visibly refer to earlier answers; undo, finish early, and resume after reload work; the call cap and daily limit are enforced in tests and in the UI; a legacy spec opens read-only.

- [x] **T6b Rich UI redesign.**
  Implement SPEC §11 on top of T6a: dark-first tokens, Inter and Geist Mono, glass cards, framer-motion, lucide-react, and the five screens (Home, Interview, Generating, Result, History). Primitives in `src/components/ui/`.
  - Log the new dependencies and the dark-first decision in DECISIONS.md.
  - *Done when:* all five screens match SPEC §11; they work at 375px and on desktop; the full interview can be completed with the keyboard; contrast passes WCAG AA on the dark theme; reduced motion is respected; the empty, loading, and error states from SPEC §12 are visible; and I confirm the look.

- [ ] **T7 Evals.**
  `evals/cases.json` (8 generic cases per SPEC §13, each with `clarifications: string[]`). `npm run eval` runs an interview per case: the first question, then each pre-written clarification as the answer in order, stopping on LLM done, when the list runs out (finish early if at least 3 answers), or at 8 turns. Then generate. Results to `evals/results/latest.json` with the metrics in SPEC §13, including the interview and adaptive follow-up metrics and LLM calls per case (must stay at or under 12).
  *Done when:* eval runs end to end against real providers and prints a summary table; Vitest covers the metric functions (follow-up check, assumption check, turn range).

- [ ] **T8 Polish and deploy.**
  Loading, empty, and error states for the interview and the new screens (SPEC §11, §12); basic accessibility (labels, focus, contrast, aria-live for questions and errors); `npm run screenshots` (Playwright, seeded demo spec) covering Home, a mid-interview state with the coverage panel, Generating, Result, and History; deploy to Vercel with Neon Postgres; set env vars (including `DAILY_SPEC_LIMIT`); smoke-test the live URL.
  *Done when:* live demo works; the SPEC §15 acceptance criteria (AC-1 to AC-15) all pass manually.

- [ ] **T9 Sign-off.** Only when the user says so: run `/signoff`.
