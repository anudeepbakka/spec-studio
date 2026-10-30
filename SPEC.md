# Spec Studio: Product and Technical Spec

> This spec is the source of truth. Claude Code builds from it. If something is unclear, make the simplest choice and log it in DECISIONS.md.

## 1. Overview
Spec Studio turns a rough feature request into a structured, developer-ready specification.
The user pastes a request. The app asks clarifying questions, the user answers, and the app generates a spec with
user stories, acceptance criteria, edge cases, open questions, and a task breakdown. Specs are saved and can be exported as Markdown.

The product idea comes from business analysis: ask the right questions before building anything.

## 2. Goals and non-goals
**Goals**
- A small, finished, deployed, well-documented project that demonstrates real LLM integration.
- Reliable structured output even from free-tier models (validation + repair + fallback).
- Spec-driven development: this file drives the build.

**Non-goals (do NOT build)**
- User accounts, login, teams, sharing, comments, real-time collaboration.
- Editing the generated spec in-app (regenerate or copy only).
- Payments, admin panel, analytics, i18n, dark mode toggle, PDF export, Jira/GitHub integrations.
- Fine-tuning, vector databases, RAG, agents.

## 3. Stack (fixed)
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| UI | Tailwind CSS (no component library; small hand-written components) |
| Validation | Zod |
| DB | Postgres (Neon free tier) with Drizzle ORM |
| LLM | OpenAI-compatible REST via `fetch` (no vendor SDK), providers: Groq, OpenRouter, Gemini |
| Streaming | Server-Sent Events from a route handler |
| Tests | Vitest (+ Playwright only for screenshots) |
| CI/Deploy | GitHub Actions, Vercel |

## 4. User flow
1. **Request:** user enters a feature request (20 to 4000 chars) and submits.
2. **Questions:** app shows 4 to 8 clarifying questions (text or multiple choice). User answers (any may be skipped, with a note "skipped").
3. **Generate:** app streams progress, then shows the finished spec.
4. **Result:** view sections, copy Markdown, download `.md`, regenerate, delete. Saved to history.

## 5. Data model (Postgres)
`specs`
| column | type | notes |
|---|---|---|
| id | uuid pk | default gen_random_uuid() |
| owner_id | uuid | from cookie, indexed |
| title | text | from spec or first 60 chars of request |
| raw_request | text | |
| questions | jsonb | `Question[]` or null |
| answers | jsonb | `Answer[]` or null |
| spec | jsonb | `Spec` or null |
| status | text | `draft` \| `questions_ready` \| `answered` \| `generating` \| `done` \| `failed` |
| error_message | text | nullable |
| provider | text | provider that produced the spec |
| model | text | |
| prompt_version | text | |
| created_at, updated_at | timestamptz | |

`usage`: `(owner_id uuid, day date, llm_runs int, primary key (owner_id, day))`.

Owner identity: anonymous httpOnly cookie `ss_owner` (UUID) set by middleware. All queries are scoped by `owner_id`.

## 6. Schemas (Zod; source of truth for types)
```ts
Question = { id: string, question: string, why: string,
             type: "text" | "choice", options?: string[] }          // options required when type = "choice"
QuestionsResponse = { questions: Question[] }                        // 4..8
Answer = { questionId: string, answer: string }                      // answer may be "" (skipped)

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

## 8. LLM layer (`src/lib/llm`)
- `LLMProvider`: `{ name, chat(req): Promise<string>, chatStream(req): AsyncIterable<string> }`, where `req = { messages, json?: boolean, signal? }`.
- All providers use the OpenAI-compatible `/chat/completions` format with `fetch`.
- Provider order from `LLM_PROVIDERS` (comma list). Models and keys from env. A provider without a key is skipped.
- **Fallback:** on 429, 5xx, timeout (default 40s), or network error, try the next provider. A provider that returned 429 is skipped for 60 seconds (in-memory, best effort).
- **JSON handling:** request JSON mode when supported; always strip code fences; `JSON.parse`; Zod validate.
- **Repair:** if parse or validation fails, make ONE repair call on the same provider with the original task, the bad output, and the validation errors. If that fails, move to the next provider.
- If all providers fail, throw `LLMUnavailableError` with a per-provider summary (no secrets). The API maps it to HTTP 503 with a friendly message.
- Log only metadata (provider, model, latency, attempt, outcome). Never log prompts or answers.

## 9. Prompts (`src/lib/prompts`, exported constant `PROMPT_VERSION = "v1"`)
Persona: a senior business analyst writing for developers. Plain language, concrete, testable.

**Questions prompt rules**
- Output JSON only, matching `QuestionsResponse`.
- 4 to 8 questions, ordered by impact. Cover: users and roles, scope boundaries, business rules, failure and edge conditions, non-functional needs, dependencies.
- Do not ask what the request already answers. Each question has a one-line `why`.
- Prefer `choice` type with 2 to 4 options when the answer space is small.

**Spec prompt rules**
- Output JSON only, matching `Spec`. IDs exactly as in §6. Use only information from the request and answers.
- Do not invent facts. Put unknowns in `openQuestions`. Skipped answers become explicit assumptions in `summary` or `openQuestions`.
- Acceptance criteria must be observable and testable (Given/When/Then). No vague words ("fast", "user-friendly") without a measurable meaning.
- Tasks ordered so dependencies come first; each task links to the stories it serves.

**Repair prompt:** includes the validation errors verbatim and says: return corrected JSON only.

Prompts must be plain exported strings or template functions, easy to read and diff, no hidden magic.

## 10. API (route handlers; JSON errors `{ error: { code, message } }`)
| Method + path | Purpose |
|---|---|
| `POST /api/specs` | body `{ rawRequest }`, creates draft, returns `{ id }` |
| `POST /api/specs/:id/questions` | generates questions (non-streaming), status `questions_ready` |
| `PUT /api/specs/:id/answers` | body `{ answers: Answer[] }`, status `answered` |
| `POST /api/specs/:id/generate` | SSE: `event: progress` (`{ chars }`), then `event: spec` (`Spec`) or `event: error` |
| `GET /api/specs` | list owner's specs (id, title, status, created_at) |
| `GET /api/specs/:id` | full record |
| `DELETE /api/specs/:id` | delete |
| `GET /api/specs/:id/export` | `text/markdown`, `Content-Disposition: attachment` |
| `GET /api/health` | `{ ok: true }` |

**Rate limit:** `DAILY_LLM_RUN_LIMIT` (default 10) LLM runs per owner per UTC day; questions and generate each count as one. Over the limit returns 429 with `code: "daily_limit"`.
Input limits: `rawRequest` 20 to 4000 chars; each answer at most 1000 chars. Reject others with 400.

## 11. UI (Tailwind; clean, minimal, responsive)
- `/` Home: heading, textarea, submit; "Recent specs" list (title, status, date, delete).
- `/specs/[id]`: stepper (Request, Questions, Generate, Result).
  - Questions: form with a field per question (text input or radio group), "Skip" allowed, submit.
  - Generate: progress indicator with live character count from SSE, cancel button.
  - Result: collapsible sections (Summary, User stories with criteria, Edge cases, Open questions, Tasks table), buttons: Copy Markdown, Download .md, Regenerate, Delete.
- Accessible: labels on inputs, visible focus, keyboard usable, sufficient contrast.

## 12. Error handling (every state must have friendly UI)
Validation error (400), daily limit (429, with reset time), all providers down (503, retry button), generation failed validation after repair (spec saved as `failed`, retry button),
network drop during SSE (resume by re-fetching record; offer retry), not found (404 page).

## 13. Testing and evals
**Unit tests (Vitest):** schemas and integrity checks, Markdown export snapshot, provider fallback and repair with mocked `fetch`, rate-limit logic, JSON fence stripping.
**Evals (`npm run eval`):** `evals/cases.json` has 8 generic cases (e.g. password reset, CSV export, comment notifications, appointment booking, search filters, invite teammates, offline mode, bulk delete). Each case has `request` and `clarifications: [{question, answer}]` (pre-written, so evals need no extra LLM calls beyond the pipeline).
For each case run: generate questions, then generate the spec using the case clarifications.
Metrics written to `evals/results/latest.json` and printed as a table:
- questions: schema-valid rate, count in 4..8 rate
- spec: schema-valid on first attempt rate, valid after repair rate, final success rate
- structure: average stories, criteria per story, edge cases, tasks; share of stories covered by tasks (target 100%)
- ops: average latency, fallback count, provider used
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
DAILY_LLM_RUN_LIMIT=10
LLM_TIMEOUT_MS=40000
```
Base URLs: Groq `https://api.groq.com/openai/v1`, OpenRouter `https://openrouter.ai/api/v1`, Gemini `https://generativelanguage.googleapis.com/v1beta/openai/`.
Free model names change often. Do NOT hardcode them. Leave model vars for the user to fill from each provider's current docs, and fail with a clear startup message if a provider is listed but its key or model is missing.

## 15. MVP acceptance criteria
- **AC-1** Given a valid request, when I submit it, then I land on `/specs/{id}` with 4 to 8 clarifying questions shown within 20 seconds.
- **AC-2** Given I answered some questions and skipped others, when I generate, then I see live progress and then a spec that passes schema validation.
- **AC-3** Given the first provider returns 429, when I generate, then the app falls back to the next provider and still completes.
- **AC-4** Given a model returns invalid JSON, when validation fails, then one repair attempt is made before falling back.
- **AC-5** Given a finished spec, when I click Download, then I receive a `.md` file matching the §7 format.
- **AC-6** Given I created specs in this browser, when I reopen the site, then I see only my specs in history, and I can delete them.
- **AC-7** Given I exceed the daily limit, when I generate again, then I see a clear message with the reset time and nothing is charged to a provider.
- **AC-8** Given all providers fail, when I generate, then I see a friendly error with a retry option and no stack trace.

## 16. Project structure
```
src/app/            pages and api route handlers
src/lib/llm/        provider interface, registry, fallback, json repair
src/lib/prompts/    versioned prompts
src/lib/schemas/    zod schemas, integrity checks
src/lib/export/     toMarkdown
src/lib/db/         drizzle schema, repo functions
src/components/     small UI components
evals/              cases.json, run script, results/
scripts/            screenshots
docs/               final documentation (generated at sign-off)
```
