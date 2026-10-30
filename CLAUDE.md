# Spec Studio: instructions for Claude Code

Read `SPEC.md` first (what to build), then `TASKS.md` (in what order). Build ONE task at a time.
Use `/next` to build the next task. Use `/signoff` ONLY when the user says "sign off".

## Hard rules
- Stack is fixed (see SPEC.md §3). Do not swap frameworks or add libraries without a reason logged in `DECISIONS.md`.
- Scope is fixed. Anything in SPEC.md §2 "Non-goals" is OFF LIMITS. No auth, no multi-user, no payments.
- NEVER trust model output. Every LLM response is parsed and validated with Zod before use.
- API keys stay server-side. Never log prompts, answers, or keys. Never commit `.env*` (except `.env.example`).
- No employer, client, or real-company data anywhere in the repo (code, examples, evals, docs). All sample data is generic.
- TypeScript strict. No `any` unless commented with why.
- Keep it simple. Prefer boring, readable code over clever abstractions. Small files, clear names.

## Working style (usage is limited, so be economical)
- Do not read the whole repo. Read only files relevant to the current task.
- Do not paste long logs. Summarise failures in a few lines.
- Make small commits per task: `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`, `chore: ...`.
- Definition of done for every task: `npm run typecheck`, `npm run lint`, `npm run test` all pass, the TASKS.md checkbox is ticked, and the work is committed.
- When you make a non-obvious decision, append an entry to `DECISIONS.md`:
  `## YYYY-MM-DD: <decision>` then **Context**, **Decision**, **Alternatives**, **Consequence** (1 to 2 lines each).
  This file is raw material for the final documentation, so be honest and specific.
- When you hit a real problem (bad JSON from a model, rate limits, a bug that took effort), add it to `DECISIONS.md` under the heading `## Problem: <title>` with what happened and how it was fixed. These become the best parts of the final docs.

## Commands (create these npm scripts in T0)
`dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `eval`, `screenshots`

## Documentation policy
- During the build, keep README.md to a short stub (name, one-line description, how to run).
- The full portfolio documentation is produced once, by `/signoff`, from SPEC.md, DECISIONS.md, TASKS.md, git history, and real eval results. Do not write it earlier.
