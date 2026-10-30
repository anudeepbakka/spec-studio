# Spec Studio: Product and Technical Spec

> This spec is the source of truth. Claude Code builds from it. If something is unclear, make the simplest choice and log it in DECISIONS.md.

## 1. Overview
Spec Studio turns a rough feature request into a structured, developer-ready specification.
The user pastes a request. The app interviews the user one question at a time. Each question is chosen from the request and everything answered so far. When the interview is complete, the app generates a spec with
user stories, acceptance criteria, edge cases, open questions, and a task breakdown. Specs are saved and can be exported as Markdown.

The product idea comes from business analysis: ask the right questions, in the right order, before building anything.

## 2. Goals and non-goals
**Goals**
- A small, finished, deployed, well-documented project that demonstrates real LLM integration.
- Reliable structured output even from free-tier models (validation + repair + fallback).
- Spec-driven development: this file drives the build.

**Non-goals (do NOT build)**
- Teams, sharing, comments, real-time collaboration, roles and permissions.
- Email in any form: no email verification, no password reset by email, no one-time codes (OTP), no social login. Accounts use a username and a password only (§17).
- Editing the generated spec in-app (regenerate or copy only).
- Payments, admin panel, analytics, i18n, PDF export, Jira/GitHub integrations.
- Fine-tuning, vector databases, RAG, agents.

**In scope since the accounts and theming update (§11, §17):** username and password accounts, guest mode kept, and a light, dark and system theme.

## 3. Stack (fixed)
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| UI | Tailwind CSS with design tokens. Small hand-written components. No component kit (no shadcn, MUI, or similar). |
| UI extras | `framer-motion` (motion) and `lucide-react` (icons). Allowed; reason logged in DECISIONS.md. |
| Fonts | Inter (UI) and Geist Mono (IDs and code), loaded with `next/font` |
| Validation | Zod |
| DB | Postgres (Neon free tier) with Drizzle ORM |
| LLM | OpenAI-compatible REST via `fetch` (no vendor SDK), providers: Groq, OpenRouter, Gemini |
| Streaming | Server-Sent Events from a route handler |
| Auth | Better Auth (email/password plus username plugin) with its Drizzle adapter and database sessions. No email sending. See §17. |
| Theme | Inline script in the document head, no theme library. See §11. |
| Tests | Vitest for unit and integration tests. Playwright for screenshots and end-to-end tests (`npm run test:e2e`). |
| CI/Deploy | GitHub Actions, Vercel |

## 4. User flow
1. **Request:** user enters a feature request (20 to 4000 chars) and submits. The spec is created as a draft.
2. **Interview:** adaptive, one question at a time. Each turn the app shows one question and waits. The user answers, skips, says "Not sure", or finishes early. The next question is generated from the full request and all earlier turns (§9). The interview ends when the LLM says it is done, when 8 questions have been resolved, or when the user finishes early.
3. **Generate:** app streams progress, then shows the finished spec. The spec prompt uses the full interview transcript.
4. **Result:** view sections, copy Markdown, download `.md`, regenerate, delete. Saved to history.

Resuming: any reload or return visit goes to the current unanswered question, or to the next step if no question is pending. Nothing is lost on reload.

## 5. Data model (Postgres)
`specs`
| column | type | notes |
|---|---|---|
| id | uuid pk | default gen_random_uuid() |
| owner_id | uuid | guest owner from the `ss_owner` cookie, indexed. Kept on every spec, including claimed ones. |
| user_id | uuid | nullable, indexed. Set for specs of a signed-in user (created while signed in, or claimed from the guest cookie, §17). Null for guest-only specs. |
| title | text | from spec or first 60 chars of request |
| raw_request | text | |
| interview | jsonb | `Turn[]` (§6), ordered. Null for legacy specs. |
| questions | jsonb | legacy only: `Question[]` from the old flow. Null for new specs. |
| answers | jsonb | legacy only: `Answer[]` from the old flow. Null for new specs. |
| spec | jsonb | `Spec` or null |
| status | text | `draft` \| `interviewing` \| `interview_done` \| `generating` \| `done` \| `failed`. Legacy rows may also hold `questions_ready` or `answered`. |
| llm_calls | int | AI requests made for this spec, default 0 (§10 cap) |
| error_message | text | nullable |
| provider | text | provider that produced the spec |
| model | text | |
| prompt_version | text | |
| created_at, updated_at | timestamptz | |

Status meanings:
- `draft`: request saved, no question asked yet.
- `interviewing`: at least one turn exists. The interview is not over.
- `interview_done`: the interview has ended (LLM done, 8 resolved, or finished early). Ready to generate.
- `generating`, `done`, `failed`: generation states, as before (§12).

`usage`: `(subject text, day date, specs_started int, primary key (subject, day))`. `subject` is `guest:<owner_id>` for guests or `user:<user_id>` for signed-in users. Replaces `llm_runs` (§10). The migration rewrites existing rows to `guest:<owner_id>`.

`llm_budget`: `(day date pk, calls int)`. Provider requests across all owners per UTC day (§10).

`rate_limit`: `(key text pk, failures int, window_start timestamptz, blocked_until timestamptz null)`. Database-backed so it works across serverless instances (§17).

Auth tables (Better Auth, generated by its Drizzle adapter, §17): `user` (id, username unique case-insensitive, a placeholder email, created_at), `session`, `account` (credential password hash), `verification` (present because the library requires it, never used).

Owner identity: guests keep the anonymous httpOnly cookie `ss_owner` (UUID), set by the proxy. Signed-in users are identified by their Better Auth session. `getOwner(request)` (§17) returns either `{ kind: "user", userId, ownerId }` or `{ kind: "guest", ownerId }`. Every spec query and every usage or limit check goes through it.
- A user's scope: `user_id = userId`.
- A guest's scope: `owner_id = ownerId AND user_id IS NULL`.
No query may filter on the request body for identity.

## 6. Schemas (Zod; source of truth for types)
```ts
Coverage = { usersRoles: "unknown" | "partial" | "covered",
             scope: "unknown" | "partial" | "covered",
             businessRules: "unknown" | "partial" | "covered",
             failureCases: "unknown" | "partial" | "covered",
             nonFunctional: "unknown" | "partial" | "covered",
             dependencies: "unknown" | "partial" | "covered" }

QuestionDraft = { question: string, why: string,
                  type: "text" | "choice", options?: string[] }      // options required (2..4) when type = "choice"
Question = QuestionDraft & { id: string /* Q-1, assigned by the server */ }

// What the LLM returns for each interview step (PROMPT_VERSION v2, §9)
InterviewTurnResponse = { done: boolean, reason?: string,
                          question?: QuestionDraft,                  // required when done = false, forbidden when done = true
                          coverage: Coverage,
                          knownFacts: string[] }                     // max 8 short bullets

Answer = { questionId: string, answer: string,
           status: "answered" | "not_sure" | "skipped" }             // answer is "" when skipped

Turn = { index: number,                                              // 1-based, unique
         question: Question,
         coverage: Coverage, knownFacts: string[],                   // as returned with this question
         answer: { text: string, status: "answered" | "not_sure" | "skipped" } | null,   // null while pending
         answeredAt: string | null }                                 // ISO time
// Rules: at most one turn is pending (answer = null), and it is always the last one.
// Resolved turns are the ones with an answer (any status).

// Legacy only (old questions flow, read-only)
QuestionsResponse = { questions: QuestionDraft[] }                   // 4..8

AcceptanceCriterion = { id: string /* AC-1.1 */, given: string, when: string, then: string }
UserStory = { id: string /* US-1 */, role: string, want: string, benefit: string,
              priority: "must" | "should" | "could",
              acceptanceCriteria: AcceptanceCriterion[] }            // >= 2
EdgeCase = { id: string /* EC-1 */, scenario: string, expectedBehavior: string, relatedStoryIds: string[] }
Task = { id: string /* T-1 */, title: string, description: string,
         dependsOn: string[], relatedStoryIds: string[], estimate: "S" | "M" | "L" }
Spec = { title: string, summary: string, goals: string[],            // goals 2..5
         userStories: UserStory[],                                   // 3..8
         edgeCases: EdgeCase[],                                      // >= 3
         openQuestions: string[],                                    // may be empty
         tasks: Task[] }                                             // 5..15
```
**Integrity checks (`superRefine`)**: all IDs unique within their type; every `relatedStoryIds` and `dependsOn` reference exists;
no task depends on itself; no dependency cycles; every user story is referenced by at least one task.
Failures produce readable messages (used in the repair prompt).
**Interview checks (`superRefine`)**: turn indexes run 1..n with no gaps; question IDs are unique; only the last turn may be pending; `interview` length is at most 8.

## 7. Markdown export format
```
# {title}
> {summary}

## Goals
- ...

## User stories
### US-1 (must): As a {role}, I want {want}, so that {benefit}
**Acceptance criteria**
- AC-1.1: **Given** ..., **when** ..., **then** ...

## Edge cases
| ID | Scenario | Expected behavior | Related |

## Open questions
- ...

## Task breakdown
| ID | Task | Size | Depends on | Stories |
```
Footer line: `Generated with Spec Studio`. Output must be deterministic (snapshot-tested).
The export does not include the interview transcript. Assumptions from skipped or unsure answers appear in the summary or in Open questions.

## 8. LLM layer (`src/lib/llm`)
- `LLMProvider`: `{ name, chat(req): Promise<string>, chatStream(req): AsyncIterable<string> }`, where `req = { messages, json?: boolean, signal? }`.
- All providers use the OpenAI-compatible `/chat/completions` format with `fetch`.
- Provider order from `LLM_PROVIDERS` (comma list). Models and keys from env. A provider without a key is skipped.
- **Fallback:** on 429, 5xx, timeout (default 40s), or network error, try the next provider. A provider that returned 429 is skipped for 60 seconds (in-memory, best effort).
- **JSON handling:** request JSON mode when supported; always strip code fences; `JSON.parse`; Zod validate.
- **Repair:** if parse or validation fails, make ONE repair call on the same provider with the original task, the bad output, and the validation errors. If that fails, move to the next provider.
- **Call counting:** every request sent to a provider counts toward the spec's `llm_calls` (§10). This includes repairs and fallback attempts. The count is reserved before each request, as in §10.
- If all providers fail, throw `LLMUnavailableError` with a per-provider summary (no secrets). The API maps it to HTTP 503 with a friendly message.
- Log only metadata (provider, model, latency, attempt, outcome). Never log prompts or answers.

## 9. Prompts (`src/lib/prompts`, exported constant `PROMPT_VERSION = "v2"`)
Persona: a senior business analyst writing for developers. Plain language, concrete, testable.

**Interview question prompt (one call per turn)**
- Input: the raw request, the full transcript of resolved turns (question, answer status, answer text), the knownFacts and coverage from the last turn, and the rules below.
- Output JSON only, matching `InterviewTurnResponse`.
- Ask exactly ONE question per turn, short and concrete.
- Use previous answers. Follow up on vague or surprising answers, probe contradictions, and never repeat or ask what was already answered or is already in the request.
- Prioritise the least-covered dimension (users and roles, scope, business rules, failure cases, non-functional, dependencies). A strong follow-up beats ticking a box.
- The model may say `done: true` only after at least 4 resolved turns. The server enforces this and the 8-turn maximum (§10). Done before 4 is a validation failure and goes through the repair path.
- Prefer `choice` with 2 to 4 options when the answer space is small. The UI always also allows free text.
- Treat "skipped" and "not sure" as signals. Ask a simpler or differently framed question about the same topic only when it matters for the spec.
- `knownFacts`: short bullets of what is understood so far, max 8.

**Spec prompt rules**
- Input: the raw request and the full interview transcript, including skipped and "not sure" turns.
- Output JSON only, matching `Spec`. IDs exactly as in §6. Use only information from the request and answers.
- Do not invent facts. Put unknowns in `openQuestions`. Every skipped answer becomes an explicit assumption in `summary` or `openQuestions`. Every "not sure" answer becomes an open question.
- Acceptance criteria must be observable and testable (Given/When/Then). No vague words ("fast", "user-friendly") without a measurable meaning.
- Tasks ordered so dependencies come first; each task links to the stories it serves.

**Repair prompt:** includes the validation errors verbatim and says: return corrected JSON only.

Prompts must be plain exported strings or template functions, easy to read and diff, no hidden magic.
The `QuestionsResponse` prompt from v1 is retired. Legacy specs are not regenerated.

## 10. API (route handlers; JSON errors `{ error: { code, message } }`)
| Method + path | Purpose |
|---|---|
| `POST /api/specs` | body `{ rawRequest }`, creates draft, returns `{ id }` |
| `POST /api/specs/:id/interview/next` | body `{ answer?: { questionId, answer, skipped?, notSure? } }`. Saves the answer if given, then returns the pending question, or generates the next one, or returns `{ done: true }`. Idempotent and resumable (see below). |
| `POST /api/specs/:id/interview/undo` | removes the last resolved turn and any pending turn after it, then asks for that question again (no `done` allowed in this call). Reopens the interview if it was `interview_done`. |
| `POST /api/specs/:id/interview/finish` | body none. Ends the interview early. Needs at least 3 turns answered with a real answer (`answered`, not skipped or "not sure"). Drops any pending question. Status `interview_done`. |
| `POST /api/specs/:id/generate` | SSE: `event: progress` (`{ chars }`), then `event: spec` (`Spec`) or `event: error`. Uses the full transcript. |
| `GET /api/specs` | list owner's specs (id, title, status, created_at) |
| `GET /api/specs/:id` | full record, including `interview` (or legacy `questions` and `answers`) |
| `DELETE /api/specs/:id` | delete |
| `GET /api/specs/:id/export` | `text/markdown`, `Content-Disposition: attachment` |
| `GET /api/health` | `{ ok: true }` |
| `GET /api/me` | current identity: `{ kind: "guest" \| "user", username?, guestSpecCount, limits: { dailySpecs, usedToday } }` |
| `POST /api/account/claim-guest-specs` | signed in only. Moves this browser's guest specs to the user (§17). Idempotent. Returns `{ moved }`. |
| `DELETE /api/account` | signed in only. Body `{ confirm: "delete" }`. Deletes the user's specs, usage, sessions and account (§17). |
| `/api/auth/*` | Better Auth handler: sign up, sign in, sign out, session. No password reset and no email routes are enabled (§17). |

Every spec route (all rows above that take `:id` or list specs) resolves identity with `getOwner(request)` and never reads identity from the body.

The v1 routes `POST /api/specs/:id/questions` and `PUT /api/specs/:id/answers` are removed.

**Interview `next` behaviour**
- Pending question exists and no answer sent: return it. No LLM call. (Resume.)
- Pending question exists and an answer is sent: save the answer. Then, if 8 turns are resolved, set `interview_done` and return `{ done: true }` with no LLM call. Otherwise ask the LLM for the next question.
- No pending question and status `draft` or `interviewing`: ask the LLM for the next question. This is the first LLM call of a new spec.
- Status `interview_done`: return `{ done: true }`. An answer sent here is refused with 409.
- Answer sent with no pending question: refused with 409 `invalid_state`.

**Limits**
- `DAILY_SPEC_LIMIT` (guest, default 5) and `DAILY_SPEC_LIMIT_USER` (signed in, default 8): new specs per subject per UTC day. The subject is `guest:<owner_id>` or `user:<user_id>`. Counted when a spec's first question is requested (the draft to `interviewing` transition). Later calls on the same spec are not counted again. Over the limit returns 429 with `code: "daily_limit"`, before any provider is called. A first question that then fails still counts (as with the old run limit). The message names the limit that applies, and for guests it suggests signing in for a higher limit.
- `GLOBAL_DAILY_LLM_CALL_BUDGET` (default 600): provider requests across all owners per UTC day, counted in `llm_budget`. Each request reserves one unit with a conditional update before it is sent, like the spec cap. When the budget is used up, return 429 with `code: "demo_capacity"` and the message "Demo capacity reached for today, come back tomorrow." No provider is called.
- Auth rate limits: see §17.
- `MAX_LLM_CALLS_PER_SPEC` = 12 (a code constant, not an env var). Every request to a provider counts (§8). Each request reserves one call on `specs.llm_calls` with a conditional update before it is sent, like the daily reservation. Over the cap returns 429 with `code: "spec_call_limit"`, and no provider is called. The spec stays in its current status.
- Interview size: the server forces `interview_done` once 8 turns are resolved. Done before 4 resolved turns is refused as a validation failure.
- Input limits: `rawRequest` 20 to 4000 chars; each answer at most 1000 chars. Reject others with 400.
- Undo is allowed while status is `interviewing` or `interview_done`. It is refused with 409 once generation has started.

**Legacy specs** (`interview` null, `questions` or `answers` set): `GET` returns them. Interview and generate endpoints return 409 `legacy_spec`. Delete and export still work.

## 11. UI and visual design
The app must look and feel like a modern AI product, not a plain form. Two themes: dark and light.

**Theme (3-state toggle)**
- A toggle in the header with three choices: Light, Dark, System. The default is System, which follows `prefers-color-scheme`.
- The choice is saved in `localStorage` under the key `spec-studio-theme`.
- An inline script in the document head reads the choice and sets the theme attribute on `<html>` before first paint, so no wrong theme flashes. No theme library is used (§3).
- Both themes use the same token names as CSS variables. The light theme is designed, not inverted: a softer glow, lighter glass cards with a visible border, lighter shadows, and badge colours adjusted for light backgrounds.
- WCAG AA contrast in both themes for text, badges (must, should, could, and S, M, L), focus rings, and the coverage meter.
- Reduced motion is respected in both themes.

**Design language**
- Design tokens as CSS variables: near-black background in dark, off-white in light, subtle gradient glow (violet to cyan accent) behind the hero and active elements, soft grain or grid texture, glass-style cards (translucent surface, 1px subtle border, backdrop blur), `rounded-2xl` corners, tasteful shadows.
- Typography: Inter for UI, Geist Mono for IDs and code. Clear hierarchy, generous spacing, max-width containers.
- Motion (`framer-motion`, subtle, respects `prefers-reduced-motion`): fade and slide-in for steps, typing indicator, typewriter reveal of each new question, animated progress, smooth layout transitions. No heavy or distracting effects. With reduced motion, everything appears at once.
- Icons from `lucide-react`. Primitives (button, card, badge, input, chip, progress, toast, skeleton) live in `src/components/ui/`.

**Screens**
1. **Home (`/`):** centred hero with headline and a one-line value prop. A large AI-style prompt box: auto-growing textarea, Enter to submit, Shift+Enter for newline, character counter. 3 to 4 example-request chips that fill the box. A "How it works" row of 4 small steps. "Recent specs" as a responsive card grid (title, status badge, relative date, delete), up to 6 cards, with "See all" to `/history`.
2. **Interview (`/specs/[id]`, chat-style two-column layout; single column on mobile):**
   - Left: conversation thread. Earlier questions and answers as compact bubbles. The current question appears after a typing indicator, with a typewriter reveal. A "why I'm asking" line in muted text.
   - Answer area: choice options as selectable chips or cards, plus a free-text input. Buttons: Send, Skip, Not sure.
   - Controls: Undo last answer; Finish early and generate (enabled after 3 answers).
   - Right (sticky): "What I understand so far" panel showing knownFacts. A coverage meter with six dimensions (users and roles, scope, business rules, failure cases, non-functional, dependencies), each unknown, partial, or covered, with animated state changes. A step indicator and "Question 3 of up to 8".
   - Reload resumes at the pending question with earlier turns shown.
3. **Generating (`/specs/[id]`):** full-width animated stage list (Reading your answers, Drafting user stories, Writing acceptance criteria, Mapping edge cases, Building task plan) advancing with the streamed character count. A live counter and a Cancel button. A skeleton preview of the result layout.
4. **Result (`/specs/[id]`):** sticky left section navigation (Summary, Stories, Edge cases, Open questions, Tasks). Header with title, stat chips (N stories, N criteria, N edge cases, N tasks), and actions: Copy Markdown, Download .md, Regenerate, Delete. User story cards with priority badges (must, should, could in distinct colours). Given, When, Then shown as labelled rows. Edge cases as cards linked to their stories: hover or click on a card highlights its story. Tasks as a table or list with size badges (S, M, L) and dependency chips. Copy shows a toast.
   - Legacy specs show the same result read-only, without Regenerate.
5. **History (`/history`):** searchable list of the current identity's specs (§17) with status badges, dates, and delete.
6. **Sign in and sign up (`/sign-in`, `/sign-up`):** a card with username and password fields, a show/hide password control, inline validation, and friendly errors. Each form has a "Continue as guest" link. Sign-up shows the no-reset warning and a required acknowledgement checkbox (§17).
7. **Privacy (`/privacy`):** a short page in plain language (§17).

**Shared elements**
- Header on every page: logo, theme toggle, and either "Sign in" (guests) or a user menu (username, My specs, Delete my account, Sign out).
- Guest banner on home and spec pages, dismissible: "Create an account to keep your specs across devices and get a higher daily limit."
- Under the request box on home: one line that points to the privacy page, that prompts and answers go to third-party AI providers, and that confidential information should not be entered (§17).

**Quality requirements**
- Fully responsive. Checked at 375px first, then desktop.
- Keyboard accessible: the full interview can be completed without a mouse. Visible focus rings on every control.
- WCAG AA contrast in both themes.
- `aria-live` for each new question, the progress text, and errors.
- Friendly empty, loading, and error states for every case in §12.
- No layout shift when content loads.
- No new libraries beyond `framer-motion` and `lucide-react`. Components small and reusable.

## 12. Error handling (every state must have friendly UI)
- **Validation error (400):** shown next to the field, in plain words.
- **Daily spec limit (429 `daily_limit`):** clear message with the reset time (00:00 UTC). Nothing is charged to a provider.
- **Spec call cap (429 `spec_call_limit`):** "This spec has used its AI calls. Start a new request." Offers a new request. Nothing is charged to a provider.
- **Question generation failed (503):** the interview keeps its state. Shows a retry button that asks for the same pending question again. No answers are lost.
- **All providers down (503):** friendly message with a retry button.
- **Generation failed validation after repair:** spec saved as `failed`, retry button.
- **Network drop during SSE:** the record is re-fetched and the UI offers retry.
- **Interview conflict (409):** the page reloads to the current state and says what changed.
- **Legacy spec:** read-only notice explaining the spec was made with the old question flow.
- **Not found (404):** friendly not-found page.
- **Signed-in daily limit (429 `daily_limit`):** names the limit that applies (`DAILY_SPEC_LIMIT_USER` for users, `DAILY_SPEC_LIMIT` for guests, with a sign-in suggestion for guests).
- **Demo capacity reached (429 `demo_capacity`):** "Demo capacity reached for today, come back tomorrow." Nothing is charged to a provider.
- **Sign-in or sign-up rate limited (429 `rate_limited`):** "Too many attempts. Try again in N minutes." with the time shown.
- **Sign-in failed (401):** always "Invalid username or password". It never says which part was wrong.
- **Username taken (409):** shown next to the username field, in plain words.

## 13. Testing and evals
**Unit tests (Vitest):** schemas and integrity checks (including turn schema and interview checks), Markdown export snapshot, provider fallback and repair with mocked `fetch`, daily spec limit, per-spec call cap, JSON fence stripping.
**Interview tests:** state machine covering minimum 4 before done, maximum 8 forced done, finish early (needs 3 real answers), undo (removes last resolved turn and re-asks that question), resume (pending question returned with no LLM call), and 409 for conflicting states.
**Prompt tests:** the question prompt and the spec prompt include the full transcript, including skipped and "not sure" turns.

**Auth and account tests (Vitest, no real LLM keys):** username and password validation; generic login error; sign-in and sign-up rate limits; `getOwner` for guest and user; isolation between two users and between a user and a guest, for read, list, export, delete and generate; claiming guest specs (success, idempotent, cannot claim another guest's specs); the signed-in limit; the global budget stops provider calls; account deletion removes specs, usage and sessions. A test-only auth helper is enabled only when `NODE_ENV=test`.

**Theme tests (Playwright):** the toggle changes the theme attribute; the choice persists after reload; System follows `prefers-color-scheme`.

**End-to-end tests (`npm run test:e2e`, Playwright):** guest flow still works; sign-up; sign-in; user menu and history; sign-out returns to guest. Both themes are covered by the screenshots script.

**Evals (`npm run eval`):** `evals/cases.json` has 8 generic cases (e.g. password reset, CSV export, comment notifications, appointment booking, search filters, invite teammates, offline mode, bulk delete). Each case has `request` and `clarifications: string[]` (pre-written answers, in order).
For each case run an interview: ask the first question, then answer each question with the next pre-written clarification, without reading the question text. The run stops when the LLM says done, when the list runs out (then finish early, if at least 3 answers), or at the 8-turn maximum. Then generate the spec from the transcript.
Metrics written to `evals/results/latest.json` and printed as a table:
- interview: question schema-valid rate (first attempt), turns in the 4..8 range rate, LLM-done reached rate, adaptive follow-up rate (share of turns after the first whose question shares a content word of 5+ letters, not a stop word, with an earlier answer; the check is deterministic and documented in code), average turns per case
- spec: schema-valid on first attempt rate, valid after repair rate, final success rate
- assumptions: share of skipped and "not sure" turns whose topic appears in `summary` or `openQuestions` (keyword check, documented in code)
- structure: average stories, criteria per story, edge cases, tasks; share of stories covered by tasks (target 100%)
- ops: average latency, fallback count, provider used, LLM calls per case (must stay at or under 12)
Evals must be rerunnable and must record `PROMPT_VERSION`, provider, model, date.

## 14. Environment variables (`.env.example`)
```
DATABASE_URL=
LLM_PROVIDERS=groq,openrouter,gemini
GROQ_API_KEY=
GROQ_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
DAILY_SPEC_LIMIT=5
DAILY_SPEC_LIMIT_USER=8
GLOBAL_DAILY_LLM_CALL_BUDGET=600
LLM_TIMEOUT_MS=40000
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```
`BETTER_AUTH_SECRET` is a long random string (generate it with `openssl rand -base64 32`). `BETTER_AUTH_URL` is the site's base URL (for local development, `http://localhost:3000`).
Base URLs: Groq `https://api.groq.com/openai/v1`, OpenRouter `https://openrouter.ai/api/v1`, Gemini `https://generativelanguage.googleapis.com/v1beta/openai/`.
Free model names change often. Do NOT hardcode them. Leave model vars for the user to fill from each provider's current docs, and fail with a clear startup message if a provider is listed but its key or model is missing.

## 15. MVP acceptance criteria
- **AC-1** Given a valid request, when I submit it, then I land on `/specs/{id}` and the first question appears within 20 seconds.
- **AC-2** Given I answered some questions and skipped or was unsure about others, when the interview ends and I generate, then I see live progress and then a spec that passes schema validation, with skipped and unsure answers listed as assumptions or open questions.
- **AC-3** Given the first provider returns 429, when I generate, then the app falls back to the next provider and still completes.
- **AC-4** Given a model returns invalid JSON, when validation fails, then one repair attempt is made before falling back.
- **AC-5** Given a finished spec, when I click Download, then I receive a `.md` file matching the §7 format.
- **AC-6** Given I created specs in this browser, when I reopen the site, then I see only my specs in history, and I can delete them.
- **AC-7** Given I have already started `DAILY_SPEC_LIMIT` new specs today, when I start another, then I see a clear message with the reset time, and nothing is charged to a provider. Continuing a spec I already started does not count again.
- **AC-8** Given all providers fail, when I generate, then I see a friendly error with a retry option and no stack trace.
- **AC-9** Adaptive follow-up: given I give a vague or surprising answer, when the next question appears, then it refers to that earlier answer and does not repeat a question I already answered.
- **AC-10** Undo: given I answered the last question, when I click Undo, then that answer is removed and the same question is shown again.
- **AC-11** Resume: given I answered two questions and reload the page, then I return to the current unanswered question, with my earlier answers still shown.
- **AC-12** Finish early: given I have answered at least 3 questions, when I click Finish early and generate, then the interview ends and the spec is generated from the answers so far.
- **AC-13** Call cap: given a spec has used its 12 AI calls, when I try another AI step on it, then I see a message to start a new request, and no provider is called.
- **AC-14** Legacy: given a spec made with the old question flow, when I open it, then I see its saved content read-only, and I can still delete it.
- **AC-15** Design: at 375px and on desktop, all five screens work. The full interview can be completed with the keyboard. With reduced motion on, no animations play.
- **AC-16** Theme: given I choose Dark, when I reload, then the page is dark before it paints and the choice is still Dark. Given I choose System, then the page follows my operating system setting.
- **AC-17** Theme screens: in both light and dark, at 375px and on desktop, the home, interview, generating, result, history, error, sign-in and sign-up screens are readable and meet WCAG AA contrast.
- **AC-18** Sign-up: given I enter a valid username and password and tick the no-reset acknowledgement, when I submit, then I am signed in and my guest specs can be kept (AC-21). Given I leave the checkbox empty, the form does not submit.
- **AC-19** Sign-in errors: given a wrong username or password, when I sign in, then I see "Invalid username or password" and nothing reveals which part was wrong.
- **AC-20** Rate limits: given repeated failed sign-ins, then further attempts are blocked for a growing time. Given six or more new accounts from one IP in an hour, then sign-up is blocked.
- **AC-21** Guest specs: given I used the app as a guest and then sign up, when I accept "Keep my N guest specs?", then those specs appear in my history. Accepting again changes nothing. Another guest's specs cannot be claimed.
- **AC-22** Isolation: given two signed-in users, or a signed-in user and a guest, then neither can read, list, export, delete or generate for the other's specs.
- **AC-23** Limits: given I am signed in, then my daily limit is `DAILY_SPEC_LIMIT_USER`. Given the global daily budget is used up, when anyone starts or continues an AI step, then they see "Demo capacity reached for today, come back tomorrow" and no provider is called.
- **AC-24** Delete account: given I choose "Delete my account and all my specs" and confirm, then my specs, usage, sessions and account are removed, and I am signed out.
- **AC-25** No email, no reset: the app sends no email, and no password reset exists. The sign-up form and the privacy page say so.

## 16. Project structure
```
src/app/            pages and api route handlers (/, /specs/[id], /history)
src/components/     page-level components
src/components/ui/  design primitives (button, card, badge, input, chip, progress, toast, skeleton)
src/lib/llm/        provider interface, registry, fallback, json repair, call counting
src/lib/prompts/    versioned prompts (v2)
src/lib/interview/  interview state machine (next, undo, finish, resume, limits)
src/lib/schemas/    zod schemas (turns, spec), integrity checks
src/lib/export/     toMarkdown
src/lib/db/         drizzle schema, repo functions
src/lib/auth/       Better Auth config, getOwner, username and password rules, rate limits, guest claim
src/app/sign-in/, src/app/sign-up/, src/app/privacy/   auth and privacy pages
src/app/api/auth/   Better Auth route handler
e2e/                Playwright end-to-end tests
evals/              cases.json, run script, results/
scripts/            screenshots
docs/               final documentation (generated at sign-off)
```

## 17. Authentication and accounts
Status: in scope since the accounts update. Guest mode stays. There is no email in any form.

**Model**
- Better Auth with email and password and the username plugin, using its Drizzle adapter on the same Neon Postgres. Database sessions, stored in the `session` table.
- Because Better Auth's user model requires an email, each account gets a placeholder email of the form `<username>@users.invalid`. The `.invalid` domain is reserved and never routable. The app never sends email to it, and email verification is off.
- Password reset is not configured. Better Auth's reset routes must not be enabled.
- Cookies: session cookie is `httpOnly`, `secure` in production, `sameSite=lax`.
- Custom cryptography is not allowed. Passwords are hashed by Better Auth's library.

**Credential rules**
- Username: 3 to 24 characters, letters, digits and underscore only. Case-insensitive uniqueness (stored lower case, unique index). Shown as typed.
- Password: 10 to 128 characters. No composition rules. Blocked if it is on a small list of very common passwords (kept in `src/lib/auth/`).
- Errors: sign-in always shows "Invalid username or password". Sign-up validation errors name the field and the rule in plain words. Passwords, tokens and session IDs are never logged.

**Rate limits (database-backed, `rate_limit` table)**
- Sign-in per IP: 20 attempts per 15 minutes.
- Sign-in per username: after 5 consecutive failures, block for 1 minute, doubling on each further failure, capped at 60 minutes. A success resets the count.
- Sign-up per IP: 5 new accounts per hour.
- IP comes from the platform's forwarded header. Limits are best effort, not a security boundary.

**Guest mode**
- A visitor with no account uses the app as a guest, with the anonymous `ss_owner` cookie and the guest daily limit.
- `getOwner(request)` resolves identity for every spec route, the usage counters and the budget. It returns a user or a guest (§5). A user never reads, lists, exports, deletes or generates for another owner's specs.

**Claiming guest specs**
- After sign-up or first sign-in, the app offers "Keep my N guest specs?" when the current guest cookie owns specs that have no `user_id`.
- Claiming sets `user_id` on those specs only, where `owner_id` equals the current guest cookie. It cannot claim another cookie's specs. It is idempotent: a second claim moves nothing.
- Usage: for the claimed day, the user's counter becomes the larger of the user's counter and the guest's counter. Taking the maximum never lets a claim reset a limit.

**Limits for signed-in users**
- `DAILY_SPEC_LIMIT_USER` (default 8) replaces `DAILY_SPEC_LIMIT` for signed-in users. The per-spec call cap of 12 is unchanged.
- `GLOBAL_DAILY_LLM_CALL_BUDGET` (default 600) applies to everyone (§10).

**Delete account**
- From the user menu: "Delete my account and all my specs", with a confirmation step. Calls `DELETE /api/account`. Removes the user's specs, usage rows, sessions and account in one transaction. Guest specs are not affected.

**Privacy page (`/privacy`) and the request-box notice**
The page says, in plain language:
- What is stored: username, a hashed password, your specs, and a session cookie. No email address is collected.
- Prompts and answers are sent to third-party AI providers (Groq, Google, OpenRouter). Free tiers may use data to improve their models.
- Do not enter confidential information.
- Nothing is sent by email, and there is no password reset. If you forget your password, the account and its specs cannot be recovered.
The request box shows a one-line version of this notice with a link to the page. Prompt and answer content is never logged.

**Known limits**
- A guest can clear the cookie to get a new guest allowance. The global budget is the backstop.
- Rate limits use IP and username only. There is no CAPTCHA, by design.
