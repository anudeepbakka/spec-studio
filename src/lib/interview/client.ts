// The answer sent to POST /interview/next (SPEC §10). Kept apart from the server code, so client components can import it.
export type AnswerPayload = {
  questionId: string;
  answer: string;
  skipped?: boolean;
  notSure?: boolean;
};
