import { CATEGORY_NAMES, CATEGORY_WEIGHTS } from "./constants";
import type {
  ATSCategory,
  ATSCategoryId,
  ATSCheck,
  ATSSeverity,
} from "./types";

/**
 * There are exactly three ways a check can exist here, and they are not
 * interchangeable:
 *
 * - `check()`      scored. Carries points and can fail.
 * - `infoCheck()`  worth zero points. Real advice that must never move the
 *                  score, so a false positive costs the user nothing.
 * - `skippedCheck()` worth zero points because it does not apply to this
 *                  person at all. Rendered as "not applicable", never as a
 *                  problem.
 *
 * Note what is deliberately absent: any notion of renormalizing a category over
 * "the checks that applied". That approach has a fatal property - passing a
 * skippable check and skipping it produce an identical category score, which
 * makes the check decorative exactly when it does apply. Where points need to
 * move (the experience/projects transfer in rules/sections.ts), they are moved
 * explicitly in the check table instead.
 */

export function check(spec: {
  id: string;
  name: string;
  severity: ATSSeverity;
  maxScore: number;
  earned: number;
  message: string;
}): ATSCheck {
  const score = Math.max(0, Math.min(spec.maxScore, spec.earned));
  const passed = score === spec.maxScore;

  return {
    id: spec.id,
    name: spec.name,
    status: passed ? "pass" : "fail",
    passed,
    score,
    maxScore: spec.maxScore,
    severity: spec.severity,
    message: spec.message,
  };
}

/** Advice only. Never mandatory, never scored - see the note above. */
export function infoCheck(spec: {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}): ATSCheck {
  return {
    id: spec.id,
    name: spec.name,
    status: spec.passed ? "pass" : "fail",
    passed: spec.passed,
    score: 0,
    maxScore: 0,
    severity: "info",
    message: spec.message,
  };
}

/** Does not apply to this resume. Distinct from failing it. */
export function skippedCheck(spec: {
  id: string;
  name: string;
  message: string;
}): ATSCheck {
  return {
    id: spec.id,
    name: spec.name,
    status: "skipped",
    passed: false,
    score: 0,
    maxScore: 0,
    severity: "info",
    message: spec.message,
  };
}

/**
 * Sums a category's checks and asserts the point budget still balances.
 *
 * This design admits exactly one class of bug: someone adds a check and forgets
 * to take the points from a sibling, so the category quietly starts scoring out
 * of 27 instead of 25 and every total shifts. The assertion catches it the
 * first time a test or a dev request runs, rather than in a user's report.
 */
export function buildCategory(
  id: ATSCategoryId,
  checks: ATSCheck[]
): ATSCategory {
  const weight = CATEGORY_WEIGHTS[id];
  const maxScore = checks.reduce((total, item) => total + item.maxScore, 0);
  const score = checks.reduce((total, item) => total + item.score, 0);

  if (maxScore !== weight) {
    const message =
      `ATS category "${id}" allocates ${maxScore} points but its weight is ` +
      `${weight}. The check table and CATEGORY_WEIGHTS have drifted apart.`;

    if (process.env.NODE_ENV === "production") {
      // Never take down a working extraction over a scoring bug.
      console.error(message);
    } else {
      throw new Error(message);
    }
  }

  return {
    id,
    name: CATEGORY_NAMES[id],
    weight,
    score,
    maxScore,
    checks,
  };
}
