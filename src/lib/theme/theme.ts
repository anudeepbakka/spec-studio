// SPEC §11: the theme choice (Light, Dark, System). The choice is saved in localStorage and applied to <html> as
// data-theme before first paint, so no wrong theme flashes.

export const THEME_STORAGE_KEY = "spec-studio-theme";
export const THEME_CHOICES = ["light", "dark", "system"] as const;
export const DEFAULT_THEME_CHOICE = "system";

export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

// System follows prefers-color-scheme. Light and dark are used as chosen.
export function resolveTheme(choice: ThemeChoice, systemPrefersLight: boolean): ResolvedTheme {
  if (choice === "system") return systemPrefersLight ? "light" : "dark";
  return choice;
}

// Inline script for the document head (SPEC §11). Plain ES5 kept as a string so it runs before any bundle loads.
// The unit test runs this same string against fake globals, so the behaviour it checks is the shipped one.
export const THEME_INIT_SCRIPT = `(function () {
  var choice = "${DEFAULT_THEME_CHOICE}";
  try {
    var saved = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    if (saved === "light" || saved === "dark" || saved === "system") choice = saved;
  } catch (e) {}
  var prefersLight = false;
  try {
    prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  } catch (e) {}
  var resolved = choice === "system" ? (prefersLight ? "light" : "dark") : choice;
  var root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-choice", choice);
})();`;

// Browser-only helpers used by the theme toggle.
export function systemPrefersLight(): boolean {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolveTheme(choice, systemPrefersLight()));
  root.setAttribute("data-theme-choice", choice);
}

export function readSavedThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME_CHOICE;
  } catch {
    return DEFAULT_THEME_CHOICE;
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be blocked (private mode). The choice still applies for this page view.
  }
}
