import type { ResumeKind } from "@/lib/resume/fileTypes";
import {
  HEADER_ZONE_LINES,
  MAX_HEADER_CHARS,
  MAX_HEADER_WORDS,
  WRAP_FULL_RATIO,
  WRAP_WIDTH_PERCENTILE,
} from "./constants";
import { ANY_DATE_RE, BULLET_LINE_RE, hasMatch } from "./patterns";
import { normalizeResumeText, truncateForAnalysis } from "./normalize";
import type { ResumeDocument } from "./types";

/**
 * The width this document wraps at, in characters.
 *
 * A PDF's wrap width is a property of the column it was typeset in, not of the
 * format, so it is measured rather than assumed - a two-column resume wraps at
 * half the width of a one-column one. The 90th percentile is used instead of
 * the maximum because a single long line (a skills list, a header with tabs)
 * would otherwise set a width no real body line reaches.
 */
function measureWrapWidth(nonEmptyLines: string[]): number {
  if (nonEmptyLines.length === 0) return 0;

  const lengths = nonEmptyLines
    .map((line) => line.trim().length)
    .sort((a, b) => a - b);

  const index = Math.min(
    lengths.length - 1,
    Math.floor(lengths.length * WRAP_WIDTH_PERCENTILE)
  );

  return lengths[index];
}

/**
 * Re-joins each bullet with the lines it wrapped onto.
 *
 * A PDF breaks a bullet across as many lines as the column is wide, and the
 * continuation lines carry no marker - so a metric that happens to land past
 * the wrap point is invisible to any check that reads bullet lines alone. The
 * same resume exported as DOCX has one line per paragraph and hides nothing,
 * which is how the file format ends up moving the score.
 *
 * The test for "did this line wrap onto the next" is the width of the line
 * itself: text only flows onto a new line once it has filled the current one,
 * so a line that stops short of the wrap width ended its paragraph. That is
 * what separates a wrap tail from the next entry line, which length and case
 * cannot - "Security Tools | Phishing Detection, Password Policy Analysis" is
 * longer than most tails and starts a new block, while "premium flows" is
 * shorter than any heading and continues one.
 *
 * Under-merging costs at most a point; the opposite error - swallowing a
 * heading or an entry into a bullet - would invent evidence, and this engine
 * must never do that.
 *
 * DOCX is exempt entirely. Mammoth emits one line per paragraph and wraps
 * nothing, so every line is already whole and "the previous line was full
 * width" measures nothing there - it just means the previous paragraph was
 * long, which would merge the next entry line into it. That exemption is a
 * property of the extractor rather than a threshold fitted to a sample: line
 * lengths alone do not separate a wrapped document from an unwrapped one.
 * An unknown source is treated as wrapped, so the debug route sees what a PDF
 * upload would.
 */
function buildBulletBlocks(
  nonEmptyLines: string[],
  sourceKind: ResumeKind | null
): string[] {
  if (sourceKind === "docx") {
    return nonEmptyLines
      .filter((line) => hasMatch(line, BULLET_LINE_RE))
      .map((line) => line.trim());
  }

  const fullWidth = measureWrapWidth(nonEmptyLines) * WRAP_FULL_RATIO;

  const blocks: string[] = [];
  let open = false;
  let previousLength = 0;

  for (const line of nonEmptyLines) {
    const trimmed = line.trim();
    const wrapped = previousLength >= fullWidth;
    previousLength = trimmed.length;

    if (hasMatch(line, BULLET_LINE_RE)) {
      blocks.push(trimmed);
      open = true;
      continue;
    }

    if (!open) continue;

    // Case still matters even after the width test: a heading can follow a
    // line that did wrap, and "EDUCATION" sitting under a full-width bullet
    // must not be read as its tail. A tail carries on mid-sentence, so it
    // begins lowercase - or with the digit of the metric pushed past the wrap,
    // which is the case this function exists for.
    const headingShaped =
      /^[A-Z]/.test(trimmed) &&
      trimmed.length <= MAX_HEADER_CHARS &&
      trimmed.split(/\s+/).length <= MAX_HEADER_WORDS;

    if (!wrapped || headingShaped || hasMatch(line, ANY_DATE_RE)) {
      open = false;
      continue;
    }

    blocks[blocks.length - 1] += ` ${trimmed}`;
  }

  return blocks;
}

/**
 * Computes every derived view of the resume once, so rules never re-split or
 * re-normalize. Two checks disagreeing about how many lines the document has is
 * the kind of bug that is invisible until a score looks wrong and nobody can
 * say why.
 */
export function buildResumeDocument(
  rawText: string,
  sourceKind: ResumeKind | null = null
): ResumeDocument {
  const raw = truncateForAnalysis(rawText);
  const text = normalizeResumeText(raw);

  const lines = text.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);

  return {
    text,
    raw,
    lines,
    nonEmptyLines,
    words,
    wordCount: words.length,
    bulletBlocks: buildBulletBlocks(nonEmptyLines, sourceKind),
    headerZone: nonEmptyLines.slice(0, HEADER_ZONE_LINES).join("\n"),
    sourceKind,
  };
}
