import mammoth from "mammoth";
import { ResumeParseError } from "./errors";

export async function extractDocx(buffer: Buffer) {
  try {
    const result = await mammoth.extractRawText({
      buffer,
    });

    return result.value;
  } catch (error) {
    // Broader than the pdf.js mapping on purpose: mammoth throws plain `Error`s
    // with no discriminator, but it does no I/O and spawns no worker, so every
    // throw traces back to the bytes it was handed. The original is preserved as
    // `cause` and still logged by the route.
    throw new ResumeParseError(
      "That file couldn't be read as a DOCX. It may be corrupt or saved in an older .doc format.",
      { cause: error }
    );
  }
}
