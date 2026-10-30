// SPEC §15 / TASKS T8: screenshots of the five screens, using a seeded demo owner.
// Run `npm run dev` first, then `npm run screenshots`. Needs DATABASE_URL in .env.local (the same database
// the dev server uses). The demo owner is a fixed UUID, so real owners' specs are never touched.
// Output: screenshots/*.png (gitignored).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createDb } from "@/lib/db/client";
import { createSpec, deleteSpec, listSpecs, updateSpec } from "@/lib/db/repo";
import { sampleSpec } from "@/test/sample-spec";
import type { Turn } from "@/lib/schemas/turn";

const DEMO_OWNER = "5e7d0000-0000-4000-8000-000000000001";
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "screenshots");
const VIEWPORT = { width: 1280, height: 900 };

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}
const db = createDb(url);

const COVERED = { usersRoles: "covered", scope: "covered", businessRules: "partial", failureCases: "unknown", nonFunctional: "unknown", dependencies: "unknown" } as const;

// A mid-interview transcript: three resolved turns, one skipped, and one pending question.
const midTurns: Turn[] = [
  {
    index: 1,
    question: { id: "Q-1", question: "Who can request a reset?", why: "Access rules decide the flow.", type: "choice", options: ["Any registered user", "Admins only"] },
    coverage: { ...COVERED, usersRoles: "partial" },
    knownFacts: ["Users forget passwords and need email-based recovery"],
    answer: { text: "Any registered user", status: "answered" },
    answeredAt: new Date().toISOString(),
  },
  {
    index: 2,
    question: { id: "Q-2", question: "How long should a reset link stay valid?", why: "Expiry drives security rules.", type: "text" },
    coverage: { ...COVERED, usersRoles: "covered", businessRules: "unknown" },
    knownFacts: ["Any registered user can request a reset", "Links are sent by email"],
    answer: { text: "", status: "skipped" },
    answeredAt: new Date().toISOString(),
  },
  {
    index: 3,
    question: { id: "Q-3", question: "What happens if the email address is not registered?", why: "Avoids leaking which accounts exist.", type: "choice", options: ["Show the same message", "Show an error"] },
    coverage: COVERED,
    knownFacts: ["Any registered user can request a reset", "Links are sent by email", "Expiry is not decided yet"],
    answer: { text: "Show the same message", status: "answered" },
    answeredAt: new Date().toISOString(),
  },
  {
    index: 4,
    question: { id: "Q-4", question: "Should a used reset link stop working right away?", why: "Single use limits replay attacks.", type: "choice", options: ["Yes, single use", "No"] },
    coverage: COVERED,
    knownFacts: ["Any registered user can request a reset", "Links are sent by email"],
    answer: null,
    answeredAt: null,
  },
];

// Clears earlier demo specs so the run is repeatable.
for (const spec of await listSpecs(db, DEMO_OWNER)) {
  await deleteSpec(db, DEMO_OWNER, spec.id);
}

// A draft with no questions yet, so the home page has a card in every status.
await createSpec(db, DEMO_OWNER, "Let users reset a forgotten password from an emailed link.");
const interviewing = await createSpec(db, DEMO_OWNER, "Add CSV export to the orders page so finance can reconcile payouts.");
await updateSpec(db, DEMO_OWNER, interviewing.id, { status: "interviewing", interview: midTurns, title: "Add CSV export to the orders page" });
const generating = await createSpec(db, DEMO_OWNER, "Add comment notifications for document owners.");
await updateSpec(db, DEMO_OWNER, generating.id, { status: "generating", interview: midTurns.slice(0, 3) });
const done = await createSpec(db, DEMO_OWNER, "Password reset by email.");
await updateSpec(db, DEMO_OWNER, done.id, { status: "done", title: sampleSpec.title, spec: sampleSpec, interview: midTurns.slice(0, 3), provider: "demo", model: "demo", promptVersion: "v2" });

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

const shots: { file: string; path: string }[] = [
  { file: "home", path: "/" },
  { file: "interview-mid", path: `/specs/${interviewing.id}` },
  { file: "generating", path: `/specs/${generating.id}` },
  { file: "result", path: `/specs/${done.id}` },
  { file: "history", path: "/history" },
];

// SPEC §11 / T10: every screen in both themes, at desktop and 375px. The theme is set through the saved choice,
// the same key the toggle uses, so the real pre-paint script runs.
const THEMES = ["dark", "light"] as const;
const VIEWPORTS = [
  { label: "desktop", size: VIEWPORT },
  { label: "mobile", size: { width: 375, height: 812 } },
] as const;

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: viewport.size,
      reducedMotion: "reduce",
      colorScheme: theme,
    });
    await context.addInitScript(`localStorage.setItem("spec-studio-theme", "${theme}");`);
    // The owner cookie decides which specs the pages show (SPEC §5).
    await context.addCookies([{ name: "ss_owner", value: DEMO_OWNER, url: BASE_URL, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();

    for (const shot of shots) {
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle" });
      const file = `${shot.file}-${theme}-${viewport.label}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true });
      console.log(`saved screenshots/${file}`);
    }
    await context.close();
  }
}

await browser.close();
