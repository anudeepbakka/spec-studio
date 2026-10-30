# Documentation standard (used by /signoff)

Audience: a recruiter or hiring engineer with 3 to 5 minutes, then an engineer who wants depth.
Tone: plain, specific, confident, first person where it explains decisions ("I chose..."). No hype words
("revolutionary", "seamless", "cutting-edge"). Short paragraphs. Show, do not tell.

## Hard rules
1. Never invent numbers or features. Every metric must come from `evals/results/latest.json`, code, tests, or git.
2. Every claim of "supports X" must be true in the code today. Limitations are documented honestly. Honest limits build trust.
3. No employer, client, or private data. Sample data is generic.
4. No secrets. Setup uses `.env.example`.
5. Every doc starts with a one-line purpose and ends with links to related docs.

## README.md structure (in this order)
1. Title, one-line tagline, badges (CI, license), live demo link, hero screenshot or GIF.
2. **The problem** (2 to 3 sentences: vague requests cause rework).
3. **What it does** (4-step flow with one screenshot per step).
4. **Why I built it** (2 to 3 sentences: business-analysis mindset turned into software; spec-driven development).
5. **Key features** (6 bullets max, each backed by code).
6. **How it works** (Mermaid sequence diagram: browser, API, LLM layer, providers, Postgres).
7. **Engineering highlights** (5 bullets: provider fallback, Zod-validated output with repair loop, SSE streaming, rate limiting, eval suite. Link to docs).
8. **Eval results** (small table with real numbers, link to docs/EVALS.md).
9. **Tech stack** (table: layer / choice / why).
10. **Getting started** (prerequisites, clone, install, env, db, run, test, eval; all verified).
11. **Project structure** (trimmed tree with one-line comments).
12. **Limitations and what I would do next** (honest, 4 to 6 bullets).
13. **License and author.**

## docs/ARCHITECTURE.md
System context diagram, request flow for each of the 3 LLM steps, module map (`src/lib/llm`, `prompts`, `schemas`, `db`),
data model ERD (Mermaid), error and fallback flow (Mermaid flowchart), deployment notes.

## docs/DESIGN_DECISIONS.md
ADR style from DECISIONS.md. Each: Context, Decision, Alternatives considered, Consequences. Include the "Problem" entries
as a "Problems I hit and how I solved them" section. This is the most valuable page for interviewers.

## docs/PROMPT_DESIGN.md
Show the actual prompts (current version), the rationale for each rule, failure modes seen with free models, the repair prompt,
and how prompt versions relate to eval results.

## docs/EVALS.md
Method, the case set (table), metrics defined, latest results table, per-provider notes if available, how to rerun, known gaps.

## docs/BUILD_PROCESS.md
How the project was built using spec-driven development with Claude Code: SPEC.md first, task slices, slash commands,
decision log, what AI did well, what needed human correction (use real examples from DECISIONS.md and git history).

## Images
`docs/images/` with: home, questions step, generating, result (stories and tasks), exported markdown preview. Use `npm run screenshots`
(Playwright, seeded demo data). Alt text on every image.

## RESUME_NOTES.md (gitignored, personal, NOT part of the public repo)
- 4 resume bullets (strong verb, what, how, measurable result from real evals only), max 2 lines each.
- A 60-second spoken pitch.
- 8 likely interview questions about this project with short answers grounded in the repo (fallback logic, validation, evals,
  streaming, trade-offs, what failed, what I would change, how AI was used).
- A one-paragraph LinkedIn "Projects" entry.

## Final repo hygiene
LICENSE (MIT default), `.gitignore` covers env and RESUME_NOTES.md, repo description and 6 topics suggested, CI badge works.
