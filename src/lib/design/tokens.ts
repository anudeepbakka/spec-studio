// SPEC §11: the dark-first design tokens. globals.css holds the same values as CSS variables.
// A test checks the WCAG contrast of the text pairs, and that globals.css matches this file.
export const TOKENS = {
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
} as const;

export type TokenName = keyof typeof TOKENS;
