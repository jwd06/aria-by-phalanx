import type { ATSCategoryId } from "./types";

/**
 * The five scoring categories. These sum to 100, and `buildCategory` asserts
 * that each category's checks sum to its weight — so the total is always exactly
 * 100 with no normalization and no float drift.
 */
export const CATEGORY_WEIGHTS: Record<ATSCategoryId, number> = {
  parsing: 30,
  contact: 15,
  sections: 25,
  structure: 20,
  formatting: 10,
};

export const CATEGORY_NAMES: Record<ATSCategoryId, string> = {
  parsing: "Parsing & extractability",
  contact: "Contact information",
  sections: "Resume sections",
  structure: "Content structure",
  formatting: "Formatting safety",
};

/** Order the report renders categories in — extractability first, since it gates the rest. */
export const CATEGORY_ORDER: ATSCategoryId[] = [
  "parsing",
  "contact",
  "sections",
  "structure",
  "formatting",
];

// ---------------------------------------------------------------------------
// Thresholds. All heuristics, none of them universal truths — named so they can
// be tuned in one place once there is real upload data to tune against.
// ---------------------------------------------------------------------------

/**
 * Below this, essentially nothing was extracted. Catches scanned/image-only PDFs
 * and little else — a two-column resume extracts plenty of words, just in the
 * wrong order, which is what the line-structure signals are for.
 */
export const MIN_MEANINGFUL_WORD_COUNT = 50;

/**
 * Below this, extraction probably dropped part of the document even though it
 * did not fail outright. Deliberately well under a short-but-complete resume:
 * whether a resume is too SHORT is `structure.length`'s job, and having both
 * checks penalize the same word count would charge the user twice in two
 * different categories for one property.
 */
export const PARTIAL_EXTRACTION_WORDS = 120;

/** A resume this short is a stub, not a document, even if it parsed cleanly. */
export const THIN_WORD_COUNT = 250;

/** Comfortable one-to-two page band. */
export const IDEAL_MIN_WORDS = 300;
export const IDEAL_MAX_WORDS = 1000;

/** Past this it reads as a CV or a dumped document, not a resume. */
export const MAX_REASONABLE_WORDS = 1500;

/** Contact details live at the top. Searching the whole document invites false positives. */
export const HEADER_ZONE_LINES = 12;

/** A resume is never this long. Truncate rather than run every regex over it. */
export const MAX_ANALYZED_CHARS = 200_000;

/** Section headings are short by nature; prose bullets are not. */
export const MAX_HEADER_CHARS = 40;
export const MAX_HEADER_WORDS = 5;

/**
 * Bullet reflow. A line only wrapped onto the next one if it ran close to the
 * document's own wrap width, so the width is measured per document (the 90th
 * percentile line length, which ignores the handful of outliers a max would
 * chase) and a line counts as full at this fraction of it.
 */
export const WRAP_WIDTH_PERCENTILE = 0.9;
export const WRAP_FULL_RATIO = 0.85;

/** Fewer lines than this means the layout collapsed into a blob. */
export const MIN_STRUCTURED_LINES = 8;

/** Words per non-empty line, above which the document has no line structure left. */
export const MAX_WORDS_PER_LINE = 40;

/** A column extracted as a stack of one-word lines. */
export const STUB_LINE_CHARS = 15;
export const STUB_LINE_RATIO = 0.5;

/** Glued tokens like `ExperienceEducation`. Longest real English word is ~30. */
export const MAX_PLAUSIBLE_TOKEN = 45;

/** `E x p e r i e n c e` — character-spaced text that no ATS will keyword-match. */
export const MAX_SINGLE_CHAR_TOKEN_RATIO = 0.2;

/** Replacement characters and CID artifacts, absolute count and share of text. */
export const MAX_GARBLE_HITS = 5;
export const MAX_GARBLE_RATIO = 0.01;

/**
 * A two-column PDF collapse produces *many* long interleaved lines. A single
 * long line is just a paragraph — mammoth emits one line per DOCX paragraph
 * with no wrapping at all, so DOCX legitimately runs longer.
 */
export const LONG_LINE_CHARS = 250;
export const LONG_LINE_CHARS_DOCX = 400;
export const MIN_LONG_LINES = 3;
export const LONG_LINE_RATIO = 0.1;

/** One decorative glyph is a style choice; a page of them is a parsing hazard. */
export const MIN_DECORATIVE_SYMBOLS = 3;
export const DECORATIVE_SYMBOL_RATIO = 0.05;

/** Invisible characters break keyword matching silently. */
export const MAX_INVISIBLE_CHARS = 3;

/** Bulleted-line share of the body, for the partial/full credit bands. */
export const BULLET_RATIO_PARTIAL = 0.1;
export const BULLET_RATIO_FULL = 0.25;

/** Date signals needed before chronology counts as legible. */
export const MIN_DATE_RANGES = 2;
export const MIN_DATE_SIGNALS = 2;

/** Bullets carrying a number, percentage, or dollar figure. */
export const MIN_QUANTIFIED_PARTIAL = 2;
export const MIN_QUANTIFIED_FULL = 5;

/**
 * Below half the parsing budget, the extraction is unreliable enough that the
 * other categories are measuring noise.
 */
export const LOW_CONFIDENCE_RATIO = 0.5;

/** Score bands for the headline. */
export const BAND_NEEDS_WORK = 50;
export const BAND_STRONG = 80;
