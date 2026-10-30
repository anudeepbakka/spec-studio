import type { Turn } from "../schemas/turn";

// SPEC §13: the pure metric functions used by `npm run eval`. No database and no LLM here, so each rule is testable.

// Words that do not carry a topic. Only words of 5+ letters are compared, so this list stays short.
const STOP_WORDS = new Set([
  "about", "after", "again", "before", "being", "could", "every", "other", "should", "their", "there", "these",
  "those", "through", "under", "until", "using", "where", "which", "while", "would", "users", "user", "want",
  "needs", "need", "given", "whether", "something", "anything", "might", "later", "still",
]);

// Lower-case words of 5+ letters, without stop words. The check is deterministic and documented in DECISIONS.md.
export function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  return new Set(words.filter((word) => !STOP_WORDS.has(word)));
}

export function sharesContentWord(a: string, b: string): boolean {
  const wordsA = contentWords(a);
  for (const word of contentWords(b)) {
    if (wordsA.has(word)) return true;
  }
  return false;
}

// SPEC §13 adaptive follow-up: a turn after the first counts when its question shares a content word with an
// earlier answered reply. Skipped and "not sure" turns have no reply to refer to, so they are not counted as answers.
export function followUpRate(turns: Turn[]): { checked: number; followUps: number; rate: number | null } {
  let checked = 0;
  let followUps = 0;
  turns.forEach((turn, i) => {
    if (i === 0) return;
    checked += 1;
    const earlierAnswers = turns
      .slice(0, i)
      .filter((earlier) => earlier.answer?.status === "answered")
      .map((earlier) => earlier.answer?.text ?? "");
    if (earlierAnswers.some((answer) => sharesContentWord(turn.question.question, answer))) {
      followUps += 1;
    }
  });
  return { checked, followUps, rate: checked === 0 ? null : followUps / checked };
}

// SPEC §13 assumptions: each skipped or "not sure" turn should show up in the summary or the open questions.
// The turn's topic is its question's content words. Covered when any of them appears in that text.
export function assumptionCoverage(
  turns: Turn[],
  spec: { summary: string; openQuestions: string[] },
): { total: number; covered: number; rate: number | null } {
  const text = [spec.summary, ...spec.openQuestions].join(" ").toLowerCase();
  const unsure = turns.filter((turn) => turn.answer?.status === "skipped" || turn.answer?.status === "not_sure");
  const covered = unsure.filter((turn) => [...contentWords(turn.question.question)].some((word) => text.includes(word)));
  return { total: unsure.length, covered: covered.length, rate: unsure.length === 0 ? null : covered.length / unsure.length };
}

// SPEC §8 and §10: an interview that finished must have 4 to 8 resolved turns.
export function turnInRange(resolvedCount: number): boolean {
  return resolvedCount >= 4 && resolvedCount <= 8;
}

// SPEC §13 call cap: every spec stays at or under MAX_LLM_CALLS_PER_SPEC requests.
export function withinCallCap(calls: number, cap: number): boolean {
  return calls <= cap;
}

// Share of stories that at least one task references. SPEC §13 target: 100%.
export function storyTaskCoverage(
  stories: { id: string }[],
  tasks: { relatedStoryIds: string[] }[],
): number | null {
  if (stories.length === 0) return null;
  const referenced = new Set(tasks.flatMap((task) => task.relatedStoryIds));
  return stories.filter((story) => referenced.has(story.id)).length / stories.length;
}

// Average of a list of numbers. Null when the list is empty, so a table can show "n/a".
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
