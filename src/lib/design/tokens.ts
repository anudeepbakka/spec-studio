// SPEC §11: the design tokens for both themes. globals.css holds the same colour values as CSS variables.
// A test checks the WCAG contrast of the text pairs in each theme, and that globals.css matches this file.
export const DARK_TOKENS = {
  canvas: "#0a0a0f",
  surface: "#13131c",
  text: "#f4f4f7",
  muted: "#a3a3b3",
  accent: "#8b5cf6",
  accentStrong: "#7c3aed",
  cyan: "#22d3ee",
  focus: "#a78bfa",
  danger: "#fca5a5",
  success: "#6ee7b7",
  warning: "#fcd34d",
  info: "#93c5fd",
  priorityMust: "#fda4af",
  priorityShould: "#fcd34d",
  priorityCould: "#93c5fd",
  tintViolet: "#ddd6fe",
  tintCyan: "#a5f3fc",
} as const;

// The light theme is designed, not inverted (SPEC §11): darker accents and text colours that pass AA on off-white.
export const LIGHT_TOKENS = {
  canvas: "#f6f5fb",
  surface: "#ffffff",
  text: "#14121f",
  muted: "#55526a",
  accent: "#7c3aed",
  accentStrong: "#6d28d9",
  cyan: "#0e7490",
  focus: "#6d28d9",
  danger: "#b91c1c",
  success: "#047857",
  warning: "#92400e",
  info: "#1d4ed8",
  priorityMust: "#be123c",
  priorityShould: "#92400e",
  priorityCould: "#1d4ed8",
  tintViolet: "#5b21b6",
  tintCyan: "#155e75",
} as const;

export type TokenName = keyof typeof DARK_TOKENS;
export type ThemeTokens = Record<TokenName, string>;
