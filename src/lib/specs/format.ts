// SPEC §11: pure helpers and copy for the screens. Kept free of React so they can be unit tested.

// "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", or a short date after a week.
export function relativeDate(iso: string, now: Date): string {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The generation stages shown while the model writes (SPEC §11 Generating).
export const GENERATION_STAGES = [
  "Reading your answers",
  "Drafting user stories",
  "Writing acceptance criteria",
  "Mapping edge cases",
  "Building the task plan",
] as const;

// Characters received at which each stage starts. The stages are a visual guide; the counter is the real progress.
const STAGE_STARTS = [0, 400, 1200, 2000, 2800];

export function stageForProgress(chars: number): number {
  let stage = 0;
  STAGE_STARTS.forEach((start, index) => {
    if (chars >= start) stage = index;
  });
  return stage;
}

// Estimated progress bar value. A typical spec is about 4,000 characters, so the bar stops short of done until the spec arrives.
export function estimatedProgress(chars: number): number {
  return Math.min(0.95, chars / 4000);
}

export const EXAMPLE_REQUESTS = [
  "Let admins export order history as a CSV file, with a date range filter.",
  "Add a weekly digest email that summarises each team member's open and overdue tasks.",
  "Let customers reschedule an appointment from the confirmation email, without logging in.",
] as const;

export const HOW_IT_WORKS = [
  { title: "Describe", body: "Write the request in a few sentences." },
  { title: "Answer", body: "Answer one question at a time. Each one builds on what you said." },
  { title: "Generate", body: "A developer-ready spec is written from your answers." },
  { title: "Ship", body: "Copy it as Markdown, or download the .md file." },
] as const;

export const DIMENSION_LABELS = {
  usersRoles: "Users and roles",
  scope: "Scope",
  businessRules: "Business rules",
  failureCases: "Failure cases",
  nonFunctional: "Non-functional",
  dependencies: "Dependencies",
} as const;

// Filters the history list. Matches the title and the status label, ignoring case and extra spaces.
export function matchesQuery(title: string, statusLabel: string, query: string): boolean {
  const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!needle) return true;
  return `${title} ${statusLabel}`.toLowerCase().includes(needle);
}
