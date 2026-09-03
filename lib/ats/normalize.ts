import { MAX_ANALYZED_CHARS } from "./constants";

/**
 * Collapses a resume into the one canonical form every rule matches against.
 *
 * This is deliberately a superset of the normalization the extract route
 * already applies to the text it returns to the browser. The two must never
 * disagree about what the document says, so the route keeps returning its own
 * lightly-cleaned text for display and the engine normalizes again internally -
 * rather than the route handing the browser engine-normalized text, which would
 * change what the ATS checker page shows for no user-visible benefit.
 *
 * Idempotent: normalize(normalize(x)) === normalize(x).
 */
export function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A resume is roughly 5,000 characters. Anything past the cap is not a resume,
 * and running every pattern over a megabyte of text buys nothing.
 */
export function truncateForAnalysis(text: string): string {
  return text.length > MAX_ANALYZED_CHARS
    ? text.slice(0, MAX_ANALYZED_CHARS)
    : text;
}
