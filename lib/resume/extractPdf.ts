import { PDFParse } from "pdf-parse";
import { ResumeParseError } from "./errors";
import { pdfjsAssets } from "./pdfjsAssets";

// pdf.js tags its own recoverable failures with a `name`. Anything else coming out
// of the parser is a genuine fault (dead worker, OOM) and must stay a 500, so only
// these are converted into user-facing errors.
const PDF_ERRORS: Record<string, string> = {
  PasswordException:
    "That PDF is password-protected. Remove the password and try again.",
  InvalidPDFException:
    "That file isn't a readable PDF — it may be corrupt or not actually a PDF.",
};

const ASSETS = pdfjsAssets();

// pdf.js otherwise defaults `workerSrc` to a bare "./pdf.worker.mjs" resolved
// against its own module URL. That is correct but implicit, and it silently
// resolves to nothing when the file was never deployed — the failure mode this
// pins down. `setWorker` is global state on pdf.js, so it is set once here
// rather than per parse.
if (ASSETS) PDFParse.setWorker(ASSETS.workerSrc);

/**
 * pdf-parse ships with the font/cmap/wasm wiring commented out, so by default
 * pdf.js has nowhere to read a non-embedded standard font or a CID encoding
 * from and quietly drops those glyphs. Pointing it at the real files is what
 * makes a Helvetica-with-no-embedded-font resume extract as text.
 */
const ASSET_OPTIONS = ASSETS
  ? {
      standardFontDataUrl: ASSETS.standardFontDataUrl,
      cMapUrl: ASSETS.cMapUrl,
      // pdfjs-dist ships .bcmap, the packed form.
      cMapPacked: true,
      wasmUrl: ASSETS.wasmUrl,
    }
  : {};

export async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({
    data: buffer,
    ...ASSET_OPTIONS,
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
