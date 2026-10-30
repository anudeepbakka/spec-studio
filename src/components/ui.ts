// Shared button classes. Every button gets a visible focus ring (SPEC §11).
const BASE =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-50";

export const PRIMARY_BUTTON = `${BASE} bg-neutral-900 text-white hover:bg-neutral-700`;
export const SECONDARY_BUTTON = `${BASE} border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100`;
export const DANGER_BUTTON = `${BASE} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
export const INPUT_CLASS =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900";
