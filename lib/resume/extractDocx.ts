import mammoth from "mammoth";
import { ResumeParseError } from "./errors";

/**
 * The marker re-attached to list items.
 *
 * Word never stores a bullet as a character - it stores numbering properties on
 * the paragraph and paints the glyph at render time - so nothing in the file
 * says which glyph the reader actually saw. U+2022 is a structural stand-in for
 * "this paragraph is a list item", which is the only thing downstream cares
 * about.
 */
const BULLET = "• ";

/**
 * The subset of mammoth's document AST we read. Mammoth types
 * `transformDocument` as `(element: any) => any`, so this narrowing is ours
 * rather than something imported.
 */
interface DocxNode {
  type: string;
  value?: string;
  numbering?: { level: string; isOrdered: boolean } | null;
  children?: DocxNode[];
}

/**
 * A port of mammoth's own `convertElementToRawText` (lib/raw-text.js) with one
 * addition: a paragraph carrying numbering gets its bullet marker back.
 *
 * It is reimplemented rather than imported because `extractRawText(input)`
 * accepts no options at all - it never runs `transformDocument`, so there is no
 * seam to hook. Every branch except the `numbering` one matches mammoth's
 * output character for character, which is what keeps this change additive:
 * the text is what it was before, plus the markers Word omitted.
 */
function toRawText(node: DocxNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "tab") return "\t";

  const text = (node.children ?? []).map(toRawText).join("");

  if (node.type !== "paragraph") return text;

  // An ordered item gets the same glyph. The AST carries `isOrdered` but not
  // the computed number, and every check downstream asks whether the content is
  // broken into list items at all - not which glyph Word would have painted.
  return `${node.numbering ? BULLET : ""}${text}\n\n`;
}

export async function extractDocx(buffer: Buffer) {
  try {
    let document: DocxNode | undefined;

    // The HTML is thrown away. `convertToHtml` is called only because it is the
    // one entry point that runs `transformDocument`, and that hook is the only
    // public access to the document AST.
    await mammoth.convertToHtml(
      { buffer },
      {
        transformDocument: (element: DocxNode) => {
          document = element;
          return element;
        },
      }
    );

    if (!document) {
      throw new Error("mammoth resolved without ever calling transformDocument");
    }

    return toRawText(document);
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
