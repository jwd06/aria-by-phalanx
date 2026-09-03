import {
  DECORATIVE_SYMBOL_RATIO,
  LONG_LINE_CHARS,
  LONG_LINE_CHARS_DOCX,
  LONG_LINE_RATIO,
  MAX_INVISIBLE_CHARS,
  MIN_DECORATIVE_SYMBOLS,
  MIN_LONG_LINES,
} from "../constants";
import { DECORATIVE_SYMBOL_RE, INVISIBLE_RE, countMatches } from "../patterns";
import { check } from "../score";
import type { SectionIndex } from "../sectionIndex";
import type { ATSCheck, ResumeDocument } from "../types";

/**
 * Formatting safety - 10 points.
 *
 * Everything here is a heuristic reported as a suspicion, not a verdict. The
 * category is deliberately the smallest of the five: these are the checks most
 * likely to be wrong about a perfectly good resume.
 */
export function formattingChecks(
  doc: ResumeDocument,
  index: SectionIndex
): ATSCheck[] {
  return [decorativeSymbols(doc), longLines(doc, index), invisibleCharacters(doc)];
}

/**
 * Scored on rate, not presence. One star in a skills line is a style choice;
 * a page of them is a parsing hazard. Ordinary bullet glyphs are never counted -
 * see the exemption list on DECORATIVE_SYMBOL_RE.
 */
function decorativeSymbols(doc: ResumeDocument): ATSCheck {
  const count = countMatches(doc.text, DECORATIVE_SYMBOL_RE);

  const threshold = Math.max(
    MIN_DECORATIVE_SYMBOLS,
    doc.nonEmptyLines.length * DECORATIVE_SYMBOL_RATIO
  );

  const excessive = count > threshold;

  return check({
    id: "formatting.decorative-symbols",
    name: "Decorative symbols",
    severity: excessive ? "warning" : "info",
    maxScore: 4,
    earned: excessive ? 0 : 4,
    message: excessive
      ? `${count} decorative symbols (stars, arrows, rating blocks) found. ` +
        `These often drop out or render as boxes, and star ratings in ` +
        `particular carry no meaning once the glyph is gone - write the level ` +
        `out instead. Ordinary bullets are fine and are not counted here.`
      : "No problematic decorative symbols. Standard bullets parse fine.",
  });
}

/**
 * A two-column collapse produces MANY long interleaved lines. A single long
 * line is just a paragraph - and mammoth emits one line per DOCX paragraph with
 * no wrapping at all, so a DOCX legitimately runs longer than a PDF before this
 * means anything. Hence both the higher DOCX threshold and the requirement for
 * several long lines rather than one.
 */
function longLines(doc: ResumeDocument, index: SectionIndex): ATSCheck {
  const limit =
    doc.sourceKind === "docx" ? LONG_LINE_CHARS_DOCX : LONG_LINE_CHARS;

  // Reads `raw` rather than `text`: normalization collapses runs of spaces,
  // which is exactly the column-layout signal this check is looking for.
  const lines = doc.raw.split(/\r\n?|\n/);

  const longLineCount = lines.filter((line) => line.length > limit).length;
  const ratio = lines.length > 0 ? longLineCount / lines.length : 0;

  const suspicious =
    longLineCount >= MIN_LONG_LINES || ratio > LONG_LINE_RATIO;

  if (index.hasInlineHeadings) {
    return check({
      id: "formatting.long-lines",
      name: "Line layout",
      severity: "warning",
      maxScore: 4,
      earned: 0,
      message:
        "Section headings are running into the text beneath them rather than " +
        "sitting on their own lines. That is the signature of a two-column or " +
        "table-based layout being flattened during extraction, which means " +
        "your content is likely being read out of order. A single-column " +
        "layout fixes it.",
    });
  }

  return check({
    id: "formatting.long-lines",
    name: "Line layout",
    severity: suspicious ? "warning" : "info",
    maxScore: 4,
    earned: suspicious ? 0 : 4,
    message: suspicious
      ? `${longLineCount} unusually long lines came through. That can mean a ` +
        `multi-column layout was flattened into a single run of text, which ` +
        `scrambles the reading order. Compare the extracted text below ` +
        `against your original - if it reads out of order, switch to a ` +
        `single-column layout.`
      : "Line lengths look normal - no sign of a flattened column layout.",
  });
}

/**
 * Extraction succeeded, but the characters will not match a keyword search:
 * non-breaking spaces, zero-width spaces, soft hyphens, and ligature glyphs.
 * Worth only 2 points - it is invisible to the reader and usually harmless in
 * small amounts.
 */
function invisibleCharacters(doc: ResumeDocument): ATSCheck {
  const count = countMatches(doc.text, INVISIBLE_RE);
  const excessive = count > MAX_INVISIBLE_CHARS;

  return check({
    id: "formatting.invisible-characters",
    name: "Invisible characters",
    // Always info: this is a real problem but a small and easily fixed one,
    // and it should never read as louder than a missing Experience section.
    severity: "info",
    maxScore: 2,
    earned: excessive ? 0 : 2,
    message: excessive
      ? `${count} invisible characters (non-breaking spaces, zero-width ` +
        `spaces, or ligature glyphs) are embedded in the text. They look ` +
        `normal to you but break exact keyword matching - a ligature in ` +
        `"classification" means a search for that word misses it. Retyping ` +
        `the affected lines, or pasting as plain text, clears them.`
      : "No invisible characters interfering with keyword matching.",
  });
}
