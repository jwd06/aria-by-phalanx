/**
 * Marks a failure caused by the uploaded file itself — corrupt, encrypted, or not
 * really the format it claims to be. The route turns these into a 422 with the
 * message shown to the user verbatim; anything else stays a 500.
 */
export class ResumeParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ResumeParseError";
  }
}
