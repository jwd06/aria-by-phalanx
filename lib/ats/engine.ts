import {
  BAND_NEEDS_WORK,
  BAND_STRONG,
  CATEGORY_ORDER,
  LOW_CONFIDENCE_RATIO,
} from "./constants";
import { buildResumeDocument } from "./document";
import { contactChecks } from "./rules/contact";
import { formattingChecks } from "./rules/formatting";
import { parsingChecks } from "./rules/parsing";
import { sectionChecks } from "./rules/sections";
import { structureChecks } from "./rules/structure";
import { buildCategory } from "./score";
import { detectSections } from "./sectionIndex";
import type {
  ATSCategory,
  ATSCheck,
  ATSReport,
  AtsEngineInput,
} from "./types";

/**
 * The only public entry point. Pure: same text in, same report out, every time.
 *
 * That determinism is the point of building this as a rules engine rather than
 * a model call. A readiness score that moves between two runs of the same file
 * is worthless, and a deterministic engine cannot invent a finding that is not
 * in the text.
 */
export function runAtsReport(input: AtsEngineInput): ATSReport {
  const doc = buildResumeDocument(input.text, input.sourceKind ?? null);
  const index = detectSections(doc);

  const built: Record<string, ATSCategory> = {
    parsing: buildCategory("parsing", parsingChecks(doc)),
    contact: buildCategory("contact", contactChecks(doc)),
    sections: buildCategory(
      "sections",
      sectionChecks(doc, index, input.hasExperience)
    ),
    structure: buildCategory("structure", structureChecks(doc)),
    formatting: buildCategory("formatting", formattingChecks(doc, index)),
  };

  const categories = CATEGORY_ORDER.map((id) => built[id]);

  const score = categories.reduce((total, category) => total + category.score, 0);

  // Derived from the parsing category rather than recomputed from the word
  // count, so the confidence flag can never contradict the parsing score the
  // user is looking at. The text-volume clause is an explicit floor: a resume
  // that yielded almost no text is low-confidence no matter how clean the
  // little that did come through happens to be.
  const parsing = built.parsing;

  const textVolume = parsing.checks.find(
    (item) => item.id === "parsing.text-volume"
  );

  const lowConfidence =
    parsing.score < parsing.weight * LOW_CONFIDENCE_RATIO ||
    textVolume?.score === 0;

  return {
    version: 1,
    score,
    band:
      score >= BAND_STRONG
        ? "strong"
        : score >= BAND_NEEDS_WORK
          ? "needs-work"
          : "not-ready",
    confidence: lowConfidence ? "low" : "high",
    confidenceMessage: lowConfidence ? confidenceMessage(doc.wordCount) : null,
    hasExperience: input.hasExperience,
    categories: lowConfidence ? demoteDownstream(categories) : categories,
    stats: {
      characters: doc.text.length,
      wordCount: doc.wordCount,
      lineCount: doc.nonEmptyLines.length,
    },
  };
}

function confidenceMessage(wordCount: number): string {
  return (
    `We could only read ${wordCount.toLocaleString()} ` +
    `${wordCount === 1 ? "word" : "words"} out of this file, so the checks ` +
    `below are measuring the extraction rather than your resume. Fix the ` +
    `parsing problem first and re-run - the rest will change with it.`
  );
}

/**
 * When extraction itself failed, every downstream check fails too, and showing
 * fifteen critical rows implies fifteen separate problems when there is really
 * one. So non-parsing criticals are demoted to warnings.
 *
 * Scores and messages are untouched: the score is not softened, because a
 * resume an ATS genuinely cannot read IS a low score, and pretending otherwise
 * would defeat the point of the page. Only the visual shouting is turned down,
 * and the parsing checks stay critical so the actual root cause stays loud.
 *
 * This is why severity is finalized at report level rather than baked into each
 * check - the projects severity flip in rules/sections.ts is the other case.
 */
function demoteDownstream(categories: ATSCategory[]): ATSCategory[] {
  return categories.map((category) => {
    if (category.id === "parsing") return category;

    return {
      ...category,
      checks: category.checks.map(
        (item): ATSCheck =>
          item.severity === "critical"
            ? { ...item, severity: "warning" }
            : item
      ),
    };
  });
}
