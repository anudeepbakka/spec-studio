import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOKENS } from "./tokens";

// SPEC §11: WCAG AA on the dark theme. Normal text needs at least 4.5 to 1.

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

describe("contrast on the canvas", () => {
  const text: Array<[string, string]> = [
    ["text", TOKENS.text],
    ["muted", TOKENS.muted],
    ["cyan", TOKENS.cyan],
    ["focus", TOKENS.focus],
    ["danger", TOKENS.danger],
    ["success", TOKENS.success],
    ["warning", TOKENS.warning],
    ["info", TOKENS.info],
    ["must priority", TOKENS.priorityMust],
    ["should priority", TOKENS.priorityShould],
    ["could priority", TOKENS.priorityCould],
  ];

  it.each(text)("%s text reaches 4.5 to 1", (_name, color) => {
    expect(contrast(color, TOKENS.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("white button text on the primary gradient start reaches 4.5 to 1", () => {
    expect(contrast("#ffffff", TOKENS.accentStrong)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("globals.css matches the token file", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const cssValue = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1];

  it.each([
    ["canvas", TOKENS.canvas],
    ["surface", TOKENS.surface],
    ["text", TOKENS.text],
    ["muted", TOKENS.muted],
    ["accent", TOKENS.accent],
    ["accent-strong", TOKENS.accentStrong],
    ["cyan", TOKENS.cyan],
    ["focus", TOKENS.focus],
    ["danger", TOKENS.danger],
    ["success", TOKENS.success],
    ["warning", TOKENS.warning],
    ["info", TOKENS.info],
    ["priority-must", TOKENS.priorityMust],
    ["priority-should", TOKENS.priorityShould],
    ["priority-could", TOKENS.priorityCould],
  ])("--%s is %s", (name, value) => {
    expect(cssValue(name)).toBe(value);
  });
});
