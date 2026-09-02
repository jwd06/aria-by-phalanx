import { PDFParse } from "pdf-parse";
import { ResumeParseError } from "./errors";

// pdf.js tags its own recoverable failures with a `name`. Anything else coming out
// of the parser is a genuine fault (dead worker, OOM) and must stay a 500, so only
// these are converted into user-facing errors.
const PDF_ERRORS: Record<string, string> = {
  PasswordException:
    "That PDF is password-protected. Remove the password and try again.",
  InvalidPDFException:
    "That file isn't a readable PDF — it may be corrupt or not actually a PDF.",
};

export async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    try {
      // pageJoiner defaults to "\n-- page_number of total_number --", which would
      // land inside the resume text and make a text-less PDF look non-empty.
      const result = await parser.getText({ pageJoiner: "" });

      return result.text;
    } catch (error) {
      const message =
        error instanceof Error ? PDF_ERRORS[error.name] : undefined;

      if (!message) throw error;

      throw new ResumeParseError(message, { cause: error });
    }
  } finally {
    // Tears down the pdf.js worker — without it every request leaks one.
    await parser.destroy();
  }
}
