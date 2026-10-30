import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_CHOICE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isThemeChoice,
  resolveTheme,
} from "./theme";

// SPEC §11 and AC-16. The inline script is the shipped code, so these tests run that exact string against fake globals.

function fakeBrowser(saved: string | null, prefersLight: boolean) {
  const attributes: Record<string, string> = {};
  const storage = new Map<string, string>(saved === null ? [] : [[THEME_STORAGE_KEY, saved]]);
  const window = {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    matchMedia: (query: string) => ({ matches: query === "(prefers-color-scheme: light)" && prefersLight }),
  };
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value) },
  };
  return { window, document, attributes };
}

function runInitScript(saved: string | null, prefersLight: boolean) {
  const browser = fakeBrowser(saved, prefersLight);
  new Function("window", "document", THEME_INIT_SCRIPT)(browser.window, browser.document);
  return browser.attributes;
}

describe("resolveTheme", () => {
  it("uses light and dark as chosen, whatever the system says", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("follows the system when the choice is System", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
});

describe("isThemeChoice", () => {
  it("accepts only the three choices", () => {
    expect(["light", "dark", "system"].every(isThemeChoice)).toBe(true);
    expect(isThemeChoice("auto")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT (before first paint)", () => {
  it("defaults to System when nothing is saved, and follows a light system", () => {
    expect(DEFAULT_THEME_CHOICE).toBe("system");
    expect(runInitScript(null, true)).toEqual({ "data-theme": "light", "data-theme-choice": "system" });
  });

  it("applies a saved Dark choice even when the system is light", () => {
    expect(runInitScript("dark", true)).toEqual({ "data-theme": "dark", "data-theme-choice": "dark" });
  });

  it("applies a saved Light choice even when the system is dark", () => {
    expect(runInitScript("light", false)).toEqual({ "data-theme": "light", "data-theme-choice": "light" });
  });

  it("ignores a saved value that is not a known choice", () => {
    expect(runInitScript("neon", false)).toEqual({ "data-theme": "dark", "data-theme-choice": "system" });
  });

  it("falls back to System when storage throws", () => {
    const browser = fakeBrowser(null, true);
    browser.window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    new Function("window", "document", THEME_INIT_SCRIPT)(browser.window, browser.document);
    expect(browser.attributes["data-theme"]).toBe("light");
  });
});
