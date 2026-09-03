import {
  BULLET_RATIO_FULL,
  BULLET_RATIO_PARTIAL,
  IDEAL_MAX_WORDS,
  IDEAL_MIN_WORDS,
  MAX_REASONABLE_WORDS,
  MIN_DATE_RANGES,
  MIN_DATE_SIGNALS,
  MIN_QUANTIFIED_FULL,
  MIN_QUANTIFIED_PARTIAL,
  THIN_WORD_COUNT,
} from "../constants";
import {
  BARE_YEAR_RE,
  BULLET_LINE_RE,
  DATE_RANGE_RE,
  MONTH_YEAR_RE,
  NUM_MONTH_YEAR_RE,
  QUANTIFIED_RE,
  countMatches,
  hasMatch,
} from "../patterns";
import { check } from "../score";
import type { ATSCheck, ResumeDocument } from "../types";

/**
 * Content structure - 20 points.
 *
 * Whether the resume is shaped like a resume: dated entries, scannable bullets,
 * evidence of impact, and a sane length.
 */
export function structureChecks(doc: ResumeDocument): ATSCheck[] {
  const bulletLines = doc.nonEmptyLines.filter((line) =>
    hasMatch(line, BULLET_LINE_RE)
  );

  return [
    bullets(doc, bulletLines),
    dates(doc),
    // Blocks, not lines: a PDF wraps one bullet across several unmarked lines,
    // so reading `bulletLines` here would miss every metric past the wrap and
    // score the same resume lower as a PDF than as a DOCX.
    quantified(doc.bulletBlocks),
    length(doc),
  ];
}

function bullets(doc: ResumeDocument, bulletLines: string[]): ATSCheck {
  const total = doc.nonEmptyLines.length;
  const ratio = total > 0 ? bulletLines.length / total : 0;

  if (ratio >= BULLET_RATIO_FULL) {
    return check({
      id: "structure.bullets",
      name: "Bullet points",
      severity: "info",
      maxScore: 6,
      earned: 6,
      message: `${bulletLines.length} bulleted lines - easy to scan and to parse.`,
    });
  }

  if (ratio >= BULLET_RATIO_PARTIAL) {
    return check({
      id: "structure.bullets",
      name: "Bullet points",
      severity: "warning",
      maxScore: 6,
      earned: 3,
      message:
        `Only ${bulletLines.length} bulleted lines. Most of your content is ` +
        `in paragraphs - breaking each role into three to five bullets makes ` +
        `it far easier for a recruiter to skim.`,
    });
  }

  return check({
    id: "structure.bullets",
    name: "Bullet points",
    severity: "warning",
    maxScore: 6,
    earned: 0,
    message:
      "Almost no bullet points found. Recruiters skim rather than read, and " +
      "solid paragraphs are the fastest way to lose them. Break each role " +
      "into short bulleted achievements.",
  });
}

/**
 * Chronology, scored on the strength of the evidence rather than the count.
 *
 * A bare four-digit year is the weakest signal there is - "2020 Bloor St W" and
 * "CS 2110" both match it, and no regex fixes that. So bare years can only ever
 * reach the partial band; full credit requires actual ranges, which are the
 * thing an ATS reconstructs employment history from.
 */
function dates(doc: ResumeDocument): ATSCheck {
  const ranges = countMatches(doc.text, DATE_RANGE_RE);

  const monthYears =
    countMatches(doc.text, MONTH_YEAR_RE) +
    countMatches(doc.text, NUM_MONTH_YEAR_RE);

  const bareYears = countMatches(doc.text, BARE_YEAR_RE);

  if (ranges >= MIN_DATE_RANGES) {
    return check({
      id: "structure.dates",
      name: "Dates and chronology",
      severity: "info",
      maxScore: 6,
      earned: 6,
      message: `${ranges} date ranges detected - your timeline is legible to a parser.`,
    });
  }

  if (ranges + monthYears + bareYears >= MIN_DATE_SIGNALS) {
    return check({
      id: "structure.dates",
      name: "Dates and chronology",
      severity: "warning",
      maxScore: 6,
      earned: 3,
      message:
        "Dates are present, but not as clear start-and-end ranges. ATS " +
        "systems reconstruct your timeline from these, so write them as " +
        "\"Jan 2024 - Present\" or \"May 2022 - Aug 2023\" on each entry.",
    });
  }

  return check({
    id: "structure.dates",
    name: "Dates and chronology",
    severity: "warning",
    maxScore: 6,
    earned: 0,
    message:
      "No recognisable dates found. Every role, degree and major project " +
      "should carry a date range such as \"Jan 2024 - Present\" - without " +
      "them a parser cannot work out your timeline at all.",
  });
}

/**
 * Bullets carrying a number, percentage or currency figure.
 *
 * Takes whole bullet blocks rather than bullet lines - see `buildBulletBlocks`.
 * Date ranges are stripped from each block first, so "Software Engineer, 2021 -
 * 2023" is not mistaken for a metric.
 */
function quantified(bulletBlocks: string[]): ATSCheck {
  const dateRanges = new RegExp(DATE_RANGE_RE.source, `${DATE_RANGE_RE.flags}g`);

  const count = bulletBlocks.filter((block) =>
    hasMatch(block.replace(dateRanges, " "), QUANTIFIED_RE)
  ).length;

  if (count >= MIN_QUANTIFIED_FULL) {
    return check({
      id: "structure.quantified",
      name: "Quantified impact",
      severity: "info",
      maxScore: 4,
      earned: 4,
      message: `${count} bullets include a concrete number or percentage.`,
    });
  }

  if (count >= MIN_QUANTIFIED_PARTIAL) {
    return check({
      id: "structure.quantified",
      name: "Quantified impact",
      severity: "warning",
      maxScore: 4,
      earned: 2,
      message:
        `${count} bullets include a number. Aim for most of them - "cut page ` +
        `load by 40%" lands where "improved performance" does not.`,
    });
  }

  return check({
    id: "structure.quantified",
    name: "Quantified impact",
    severity: "warning",
    maxScore: 4,
    earned: 0,
    message:
      "Almost none of your bullets include a measurable result. Add the " +
      "numbers you already have: users served, percentage improved, time " +
      "saved, size of the team, volume handled.",
  });
}

function length(doc: ResumeDocument): ATSCheck {
  const { wordCount } = doc;

  if (wordCount >= IDEAL_MIN_WORDS && wordCount <= IDEAL_MAX_WORDS) {
    return check({
      id: "structure.length",
      name: "Resume length",
      severity: "info",
      maxScore: 4,
      earned: 4,
      message: `${wordCount.toLocaleString()} words - a comfortable one to two pages.`,
    });
  }

  if (wordCount > MAX_REASONABLE_WORDS) {
    return check({
      id: "structure.length",
      name: "Resume length",
      severity: "warning",
      maxScore: 4,
      earned: 0,
      message:
        `${wordCount.toLocaleString()} words is long enough to read as a CV ` +
        `rather than a resume. Cut older or less relevant roles down to a ` +
        `line each and keep the detail on the recent, relevant ones.`,
    });
  }

  if (wordCount < THIN_WORD_COUNT) {
    return check({
      id: "structure.length",
      name: "Resume length",
      severity: "warning",
      maxScore: 4,
      earned: 0,
      message:
        `${wordCount.toLocaleString()} words is thin. There is likely more to ` +
        `say about what you built and what came of it - aim for 300 to 1,000.`,
    });
  }

  return check({
    id: "structure.length",
    name: "Resume length",
    severity: "info",
    maxScore: 4,
    earned: 2,
    message:
      `${wordCount.toLocaleString()} words - workable, but slightly outside ` +
      `the 300 to 1,000 range most resumes sit in.`,
  });
}
