// SPEC §9: bump this when any prompt text changes. It is stored on each spec and eval run.
export const PROMPT_VERSION = "v2";

export { buildInterviewMessages, INTERVIEW_SYSTEM_PROMPT } from "./interview";
export { buildSpecMessages, SPEC_SYSTEM_PROMPT } from "./spec";
export { formatTranscript } from "./transcript";
