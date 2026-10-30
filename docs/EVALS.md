# Evals

How the eval suite runs an interview for each case, what it measures, what the saved results say, and what they do not show.

Related: [Prompt design](PROMPT_DESIGN.md) · [Design decisions](DESIGN_DECISIONS.md) · [README](../README.md#eval-results)

## Summary

The saved run covers **2 of 8 cases**, with prompt version **v2**, on **30 October 2026**. One case finished with a spec. The other hit the 12-call cap during generation and produced no spec.

Treat these numbers as a snapshot of one run. Two cases is too few for a rate to mean much. The point of the suite is that it can be rerun and compared, not that these numbers are a benchmark.

## Method

For each case, the runner:

1. Starts an interview from the case's request, using a fresh in-memory database, so evals never touch the real database or use up the daily limit.
2. Takes the first question. It does not read the question text. It sends the next pre-written clarification as the answer, in order.
3. Stops when the model says the interview is done, when the clarification list runs out (then finishes early, if at least three real answers were given), or at the eight-turn maximum.
4. Generates the spec from the transcript.
5. Records the results, the provider used, the model, the number of LLM calls, and the latency.

Clarifications can be `[skip]` or `[not sure]`. These send a skipped or "not sure" answer, so the assumption metric has something to check.

### Cases

Eight generic cases, one per topic. Each has six pre-written clarifications.

| ID | Topic |
|---|---|
| `password-reset` | Reset a forgotten password by email link |
| `csv-export` | Export a team's task list to CSV |
| `comment-notifications` | Notify document owners of new comments |
| `appointment-booking` | Book a 30-minute appointment with staff |
| `search-filters` | Filter the product search results |
| `invite-teammates` | Invite teammates by email and set roles |
| `offline-mode` | Record checklist answers without a connection |
| `bulk-delete` | Select several files and delete them together |

The cases are in [`evals/cases.json`](../evals/cases.json). None uses real company data.

## Metrics

The metric functions are in [`src/lib/evals/metrics.ts`](../src/lib/evals/metrics.ts) and the runner is [`evals/run.ts`](../evals/run.ts).

**Interview**

| Metric | Definition |
|---|---|
| Question valid on first attempt | Steps whose first provider response passed validation, divided by all steps. A step passes when it made exactly one provider request. |
| Turns in the 4 to 8 range | Finished cases whose resolved turns are between 4 and 8, divided by finished cases. |
| LLM done reached | Cases where the model said `done`, divided by all cases. |
| Adaptive follow-up | Turns after the first whose question shares a content word with an earlier answer, divided by checked turns. Content words are lower-case words of five or more letters, without a short stop-word list. |
| Average turns | Mean resolved turns per case. |

**Spec**

| Metric | Definition |
|---|---|
| Schema valid on first attempt | Cases whose spec validated on the first request. |
| Valid after repair | Cases whose spec validated after at most one repair. |
| Final success | Cases that reached `done`. |

**Assumptions**

| Metric | Definition |
|---|---|
| Covered share | Skipped and "not sure" turns whose topic appears in the summary or the open questions, using the same content-word check. |

**Structure**

Average stories, criteria per story, edge cases and tasks, and the share of stories referenced by at least one task (the target is 100%).

**Operations**

Average latency, failed attempts, average and maximum LLM calls per case, and whether every case stayed within the cap of 12.

### What the metrics cannot tell you

- **Repairs are inferred, not observed.** The client does not report whether a response was repaired. "First attempt" means "exactly one provider request", and a repair always adds a request.
- **The follow-up check is a word overlap.** A follow-up can count because two texts share a common word. It measures reference to an earlier answer, not quality.
- **The assumption check is a word overlap too.** It can miss an assumption worded differently from the answer.

## Results

From [`evals/results/latest.json`](../evals/results/latest.json), run on 2026-10-30 with prompt v2.

### Summary

| Area | Metric | Result |
|---|---|---|
| Interview | Question valid on first attempt | 86% (12 of 14 steps) |
| Interview | Turns in the 4 to 8 range | 100% (2 of 2 finished cases) |
| Interview | LLM done reached | 0% (both cases ended by finishing early) |
| Interview | Adaptive follow-up | 50% (5 of 10 checked turns) |
| Interview | Average resolved turns | 6 |
| Spec | Schema valid on first attempt | 50% (1 of 2 cases) |
| Spec | Valid after repair | 50% (1 of 2 cases) |
| Spec | Final success | 50% (1 of 2 cases) |
| Assumptions | Covered share | 100% (1 of 1 checked turn) |
| Structure | Average stories | 5 (one case) |
| Structure | Criteria per story | 2 (one case) |
| Structure | Edge cases | 4 (one case) |
| Structure | Tasks | 6 (one case) |
| Structure | Stories covered by tasks | 100% (one case) |
| Ops | Average latency | 72.8 s (across both cases, the failed one included) |
| Ops | Failed attempts | 3 |
| Ops | LLM calls per case | 10 on average, maximum 12 |
| Ops | Within the call cap | Yes, for both cases |

### Per case

| Case | Outcome | Provider and model | Calls | Latency | Resolved turns | Follow-ups | Stories, edge cases, tasks |
|---|---|---|---|---|---|---|---|
| `password-reset` | Done | Groq, `openai/gpt-oss-120b` | 8 | 17.7 s | 6 | 3 of 5 | 5, 4, 6 |
| `csv-export` | Failed: call cap reached | None succeeded | 12 | 127.9 s | 6 | 2 of 5 | none |

The `csv-export` failure is the important result here. Its interview completed, but generation used all 12 calls on repairs and fallbacks, and the spec was not saved. The error the user would see is the cap message: "This spec has used its AI calls. Start a new request."

## Known gaps

- **Only 2 of 8 cases were run.** The other six have not been run with the current code. Running them would show whether the cap failure is common.
- **The call cap is tight for free models.** The cap of 12 is a spec rule, and the failure shows repairs and fallbacks can use the whole budget. The options are a separate repair budget or counting repairs separately. Neither is implemented.
- **Providers are unreliable on free tiers.** Across runs, Groq rate-limited, OpenRouter's free model timed out, and one Gemini model returned 404 for a key that could list it. The model list alone did not prove that a model accepts chat requests, so each model was picked by a one-request test.
- **The "LLM done" metric is 0%.** Both cases ended by finishing early, because the clarification list ran out before the model said done. A longer clarification list would test the model's own stopping decision.
- **Route handlers and SSE framing are not tested.** The eval calls the same service functions as the routes, but not the routes themselves.
- **Latency varies by time and load.** Free-tier latency changes between runs, so compare runs with care.
- **A fresh run was stopped partway.** Sign-off started a new eval. It was stopped at the owner's request, after two cases had completed and while the third was running. Its results were not saved, so `latest.json` is from the earlier run. The stopped run may have made some provider requests.

## How to rerun

Evals call the real providers and use your quota. A full run is roughly 50 to 100 requests. Run a subset first:

```bash
npm run eval -- --limit 2
```

Options:

- `--limit N` runs the first N cases.
- `--cases a,b` runs named cases.
- `--out path` writes the results to another file, so runs are kept apart.

Results include the prompt version, provider, model and date, so a run can be compared with a later run only when the prompt version matches.
