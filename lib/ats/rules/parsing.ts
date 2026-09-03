import {
  MAX_GARBLE_HITS,
  MAX_GARBLE_RATIO,
  MAX_PLAUSIBLE_TOKEN,
  MAX_SINGLE_CHAR_TOKEN_RATIO,
  MAX_WORDS_PER_LINE,
  MIN_MEANINGFUL_WORD_COUNT,
  MIN_STRUCTURED_LINES,
  PARTIAL_EXTRACTION_WORDS,
  STUB_LINE_CHARS,
  STUB_LINE_RATIO,
} from "../constants";
import { GARBLE_RE, countMatches } from "../patterns";
import { check } from "../score";
import type { ATSCheck, ResumeDocument } from "../types";

/**
 * Parsing / extractability - 30 points.
 *
 * The most important category, because everything downstream is measuring
 * whatever came out of the parser. If extraction went wrong, the other four
 * categories are scoring noise.
 *
 * Note this is four checks, not one. A single `wordCount < 50` boolean cannot
 * carry 30 points, and it is also the wrong instrument for the failure people
 * assume it catches: a two-column resume extracts plenty of words, just
 * interleaved and out of order. The word count catches scanned/image-only PDFs;
 * the line-structure and word-integrity checks catch layout collapse.
 */
export function parsingChecks(doc: ResumeDocument): ATSCheck[] {
  return [
    textVolume(doc),
    characterIntegrity(doc),
    wordIntegrity(doc),
    lineStructure(doc),
  ];
}

function textVolume(doc: ResumeDocument): ATSCheck {
  const { wordCount } = doc;

  if (wordCount < MIN_MEANINGFUL_WORD_COUNT) {
    return check({
      id: "parsing.text-volume",
      name: "Text extraction",
      severity: "critical",
      maxScore: 10,
      earned: 0,
      message:
        `Very little text could be extracted from this resume - only ` +
        `${wordCount} ${wordCount === 1 ? "word" : "words"}. This is what a ` +
        `scanned or image-only PDF looks like to an ATS: effectively blank. ` +
        `Export a text-based version from your editor rather than scanning ` +
        `or photographing a printout.`,
    });
  }

  if (wordCount < PARTIAL_EXTRACTION_WORDS) {
    return check({
      id: "parsing.text-volume",
      name: "Text extraction",
      severity: "warning",
      maxScore: 10,
      earned: 5,
      message:
        `Only ${wordCount} words were extracted. Enough to read, but little ` +
        `enough that part of the document may not have come through. Compare ` +
        `the extracted text below against your original before anything else.`,
    });
  }

  return check({
    id: "parsing.text-volume",
    name: "Text extraction",
    severity: "info",
    maxScore: 10,
    earned: 10,
    message: `${wordCount.toLocaleString()} words extracted cleanly.`,
  });
}

/**
 * Extraction failed at the character level: replacement characters, pdf.js
 * `(cid:NN)` fallbacks for glyphs it could not map, stray control codes.
 */
function characterIntegrity(doc: ResumeDocument): ATSCheck {
  const hits = countMatches(doc.text, GARBLE_RE);
  const ratio = doc.text.length > 0 ? hits / doc.text.length : 0;
  const broken = hits >= MAX_GARBLE_HITS || ratio > MAX_GARBLE_RATIO;

  return check({
    id: "parsing.character-integrity",
    name: "Character integrity",
    severity: broken ? "critical" : "info",
    maxScore: 8,
    earned: broken ? 0 : 8,
    message: broken
      ? `${hits} unreadable characters came through instead of letters. That ` +
        `usually means the fonts are not embedded properly, or the PDF was ` +
        `produced by a tool that writes glyph codes rather than text. ` +
        `Re-export it from Word, Google Docs or your resume builder.`
      : "No corrupted or unreadable characters.",
  });
}

/**
 * Extraction produced characters, but not words. Two distinct failure shapes:
 * character-spaced text ("E x p e r i e n c e", from letter-spaced headings)
 * and glued tokens ("ExperienceEducation", from lost spacing between columns).
 * Neither will ever match an ATS keyword search.
 */
function wordIntegrity(doc: ResumeDocument): ATSCheck {
  if (doc.wordCount === 0) {
    return check({
      id: "parsing.word-integrity",
      name: "Word integrity",
      severity: "warning",
      maxScore: 6,
      earned: 0,
      message: "No words could be read from this resume.",
    });
  }

  const singleCharTokens = doc.words.filter(
    (word) => word.replace(/[^A-Za-z]/g, "").length === 1
  ).length;

  const singleCharRatio = singleCharTokens / doc.wordCount;
  const spacedOut = singleCharRatio > MAX_SINGLE_CHAR_TOKEN_RATIO;

  const longest = doc.words.reduce(
    (max, word) => Math.max(max, word.length),
    0
  );
  const glued = longest > MAX_PLAUSIBLE_TOKEN;

  if (spacedOut) {
    return check({
      id: "parsing.word-integrity",
      name: "Word integrity",
      severity: "warning",
      maxScore: 6,
      earned: 0,
      message:
        `${Math.round(singleCharRatio * 100)}% of the extracted tokens are ` +
        `single letters, so words are arriving split apart ("E x p e r i e n ` +
        `c e"). Letter-spaced headings do this. An ATS will not match any ` +
        `keyword in text like that.`,
    });
  }

  if (glued) {
    return check({
      id: "parsing.word-integrity",
      name: "Word integrity",
      severity: "warning",
      maxScore: 6,
      earned: 3,
      message:
        `Some words are running together into ${longest}-character blocks, ` +
        `which happens when spacing is lost between columns or table cells. ` +
        `A single-column layout avoids it.`,
    });
  }

  return check({
    id: "parsing.word-integrity",
    name: "Word integrity",
    severity: "info",
    maxScore: 6,
    earned: 6,
    message: "Words came through intact and separately.",
  });
}

/**
 * Did the document keep any line structure? An ATS reads a resume top to
 * bottom, and both failure shapes here destroy that: everything collapsing into
 * one paragraph-sized blob, or a column extracting as a tall stack of one-word
 * lines.
 */
function lineStructure(doc: ResumeDocument): ATSCheck {
  const lineCount = doc.nonEmptyLines.length;

  if (lineCount === 0) {
    return check({
      id: "parsing.line-structure",
      name: "Line structure",
      severity: "warning",
      maxScore: 6,
      earned: 0,
      message: "This resume has no readable line structure at all.",
    });
  }

  const wordsPerLine = doc.wordCount / lineCount;

  const stubLines = doc.nonEmptyLines.filter(
    (line) => line.trim().length < STUB_LINE_CHARS
  ).length;

  const stubRatio = stubLines / lineCount;

  if (lineCount < MIN_STRUCTURED_LINES || wordsPerLine > MAX_WORDS_PER_LINE) {
    return check({
      id: "parsing.line-structure",
      name: "Line structure",
      severity: "warning",
      maxScore: 6,
      earned: 0,
      message:
        `The resume came out as ${lineCount} very dense ` +
        `${lineCount === 1 ? "line" : "lines"} rather than distinct entries. ` +
        `Text boxes, tables and multi-column layouts collapse like this. A ` +
        `plain single-column layout extracts in the order you wrote it.`,
    });
  }

  if (stubRatio > STUB_LINE_RATIO) {
    return check({
      id: "parsing.line-structure",
      name: "Line structure",
      severity: "warning",
      maxScore: 6,
      earned: 2,
      message:
        `${Math.round(stubRatio * 100)}% of lines are only a word or two ` +
        `long, which is what a column looks like when it is extracted as a ` +
        `narrow stack. Your content is probably being read out of order.`,
    });
  }

  return check({
    id: "parsing.line-structure",
    name: "Line structure",
    severity: "info",
    maxScore: 6,
    earned: 6,
    message: `Readable structure across ${lineCount} lines.`,
  });
}
