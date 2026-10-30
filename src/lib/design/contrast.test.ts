import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, type ThemeTokens } from "./tokens";

// SPEC §11: WCAG AA in both themes. Normal text needs at least 4.5 to 1. Focus rings and non-text marks need 3 to 1.

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const TEXT_TOKENS: Array<keyof ThemeTokens> = [
  "text",
  "muted",
  "cyan",
  "focus",
  "danger",
  "success",
  "warning",
  "info",
  "priorityMust",
  "priorityShould",
  "priorityCould",
  "tintViolet",
  "tintCyan",
];

describe.each([
  ["dark", DARK_TOKENS],
  ["light", LIGHT_TOKENS],
] as const)("%s theme contrast", (_name, tokens) => {
  it.each(TEXT_TOKENS)("%s text reaches 4.5 to 1 on the canvas and the surface", (token) => {
    expect(contrast(tokens[token], tokens.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens[token], tokens.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring reaches 3 to 1 on the canvas", () => {
    expect(contrast(tokens.focus, tokens.canvas)).toBeGreaterThanOrEqual(3);
  });

  it("primary button text reaches 4.5 to 1 on the accent gradient start", () => {
    expect(contrast("#ffffff", tokens.accentStrong)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("globals.css matches the token files", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  // The dark values live in :root, the light values in :root[data-theme="light"].
  const block = (selector: string) => css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? "";
  const darkCss = block(":root");
  const lightCss = block(':root\\[data-theme="light"\\]');
  const cssValue = (source: string, name: string) =>
    source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1];

  const MAPPED: Array<[string, keyof ThemeTokens]> = [
    ["canvas", "canvas"],
    ["surface", "surface"],
    ["text", "text"],
    ["muted", "muted"],
    ["accent", "accent"],
    ["accent-strong", "accentStrong"],
    ["cyan", "cyan"],
    ["focus", "focus"],
    ["danger", "danger"],
    ["success", "success"],
    ["warning", "warning"],
    ["info", "info"],
    ["priority-must", "priorityMust"],
    ["priority-should", "priorityShould"],
    ["priority-could", "priorityCould"],
    ["tint-violet", "tintViolet"],
    ["tint-cyan", "tintCyan"],
  ];

  it.each(MAPPED)("dark --%s is %s", (cssName, token) => {
    expect(cssValue(darkCss, cssName)).toBe(DARK_TOKENS[token]);
  });

  it.each(MAPPED)("light --%s is %s", (cssName, token) => {
    expect(cssValue(lightCss, cssName)).toBe(LIGHT_TOKENS[token]);
  });
});
