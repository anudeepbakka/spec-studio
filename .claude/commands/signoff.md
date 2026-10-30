---
description: Final sign-off. Verify the project and generate portfolio-grade documentation
---
The user has signed off on the project. Produce the final documentation that a recruiter or engineer
can read on GitHub in 3 to 5 minutes and come away understanding what was built, how, and why.
Read `docs/DOC_STANDARD.md` first. It defines the required files, structure, and quality bar.

## Phase 1: Verify (stop and report if anything fails)
1. All tasks T0 to T8 in TASKS.md are ticked.
2. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass.
3. Run `npm run eval` fresh. Confirm `evals/results/latest.json` was updated. Use ONLY these numbers in docs.
4. Search the repo for secrets, `.env` files, employer or client names. Remove anything found.

## Phase 2: Gather facts (do not invent anything)
Read SPEC.md, DECISIONS.md, TASKS.md, `git log --oneline`, `package.json`, `src/lib/prompts/*`, and eval results.
Ask the user ONE short question for the missing items: live demo URL, their display name, GitHub/LinkedIn links
(optional), preferred license (default MIT).

## Phase 3: Generate (follow docs/DOC_STANDARD.md)
- `README.md` (the front door)
- `docs/ARCHITECTURE.md`
- `docs/DESIGN_DECISIONS.md`
- `docs/PROMPT_DESIGN.md`
- `docs/EVALS.md`
- `docs/BUILD_PROCESS.md`
- `docs/images/*` (run `npm run screenshots`; if it cannot run, leave clearly marked TODO placeholders and list what the user must capture)
- `LICENSE`
- `RESUME_NOTES.md` (gitignored, personal; see standard)

## Phase 4: Quality check
- Every relative link resolves. Every command in the README quick start has been executed or is copied from a command that works.
- Every Mermaid diagram is valid. Every number traces to eval results, code, or git history.
- No placeholder text, no "lorem", no marketing fluff, no claims the code does not back up.
- Finish with a checklist of what was generated, what the user still must do manually (screenshots, demo URL, repo description and topics), and suggested GitHub repo description and 6 topics.
Commit as `docs: final portfolio documentation`.
