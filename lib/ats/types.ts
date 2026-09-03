import type { ResumeKind } from "@/lib/resume/fileTypes";

export type ATSSeverity = "info" | "warning" | "critical";

/**
 * `skipped` is distinct from `fail`: the check did not apply to this resume at
 * all (no formal work experience yet), so it contributes nothing and must not be
 * rendered as a problem.
 */
export type ATSCheckStatus = "pass" | "fail" | "skipped";

export type ATSCategoryId =
  | "parsing"
  | "contact"
  | "sections"
  | "structure"
  | "formatting";

export interface ATSCheck {
  id: string;
  name: string;
  status: ATSCheckStatus;
  /** Mirror of `status === "pass"`. Always false when skipped. */
  passed: boolean;
  score: number;
  /** 0 means the check carries no points — it is informational or skipped. */
  maxScore: number;
  severity: ATSSeverity;
  message: string;
}

export interface ATSCategory {
  id: ATSCategoryId;
  name: string;
  /** Nominal budget from CATEGORY_WEIGHTS. Always equals the sum of check maxScores. */
  weight: number;
  score: number;
  maxScore: number;
  checks: ATSCheck[];
}

export interface ATSReport {
  /**
   * A literal, not a number, so the client's runtime guard rejects a future
   * shape outright instead of half-rendering it.
   */
  version: 1;
  /** Integer 0-100. Every check score is an integer, so this needs no rounding. */
  score: number;
  band: "not-ready" | "needs-work" | "strong";
  /**
   * "low" means the extraction itself is suspect, so the downstream checks are
   * measuring garbage rather than a bad resume.
   */
  confidence: "high" | "low";
  confidenceMessage: string | null;
  hasExperience: boolean;
  categories: ATSCategory[];
  stats: {
    characters: number;
    wordCount: number;
    lineCount: number;
  };
}

/**
 * Every derived view of the resume text, computed once and handed to every rule.
 * Rules must not re-split or re-normalize — that is how two checks end up
 * disagreeing about what the document says.
 */
export interface ResumeDocument {
  /** Normalized. Every rule matches against this unless noted otherwise. */
  text: string;
  /**
   * Pre-normalize, as the route returns it to the browser. Only the indentation
   * and long-line checks read this: normalizing collapses runs of spaces, which
   * destroys exactly the column-layout signal those checks look for.
   */
  raw: string;
  lines: string[];
  nonEmptyLines: string[];
  words: string[];
  wordCount: number;
  /**
   * Each bullet joined with the lines it wrapped onto. Checks that read the
   * *content* of a bullet must use this; a PDF wraps a bullet across several
   * unmarked lines, so `nonEmptyLines` only ever shows the first of them.
   */
  bulletBlocks: string[];
  /** The first few non-empty lines joined — where contact details live. */
  headerZone: string;
  sourceKind: ResumeKind | null;
}

export interface AtsEngineInput {
  text: string;
  hasExperience: boolean;
  sourceKind?: ResumeKind | null;
}
