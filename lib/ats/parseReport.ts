import type {
  ATSCategory,
  ATSCheck,
  ATSCheckStatus,
  ATSReport,
  ATSSeverity,
} from "./types";

/**
 * Runtime narrowing for the report as it arrives over the wire.
 *
 * Hand-rolled rather than schema-validated, matching the convention already set
 * by `extractedFrom` in ResumeUpload - the project has no validation library and
 * one shape is not worth adding one for.
 *
 * Deliberately structural: it checks `version` and the primitive types, but does
 * NOT enumerate the known check ids or category ids. Pinning those would turn
 * every new check into a client-side breaking change, where an older tab would
 * silently drop a perfectly good report.
 */

const SEVERITIES: ATSSeverity[] = ["info", "warning", "critical"];
const STATUSES: ATSCheckStatus[] = ["pass", "fail", "skipped"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function checkFrom(value: unknown): ATSCheck | null {
  if (!isRecord(value)) return null;

  const { id, name, status, passed, score, maxScore, severity, message } = value;

  if (typeof id !== "string") return null;
  if (typeof name !== "string") return null;
  if (typeof message !== "string") return null;
  if (typeof passed !== "boolean") return null;
  if (typeof score !== "number") return null;
  if (typeof maxScore !== "number") return null;
  if (!STATUSES.includes(status as ATSCheckStatus)) return null;
  if (!SEVERITIES.includes(severity as ATSSeverity)) return null;

  return {
    id,
    name,
    status: status as ATSCheckStatus,
    passed,
    score,
    maxScore,
    severity: severity as ATSSeverity,
    message,
  };
}

function categoryFrom(value: unknown): ATSCategory | null {
  if (!isRecord(value)) return null;

  const { id, name, weight, score, maxScore, checks } = value;

  if (typeof id !== "string") return null;
  if (typeof name !== "string") return null;
  if (typeof weight !== "number") return null;
  if (typeof score !== "number") return null;
  if (typeof maxScore !== "number") return null;
  if (!Array.isArray(checks)) return null;

  const parsed: ATSCheck[] = [];

  for (const item of checks) {
    const check = checkFrom(item);

    if (!check) return null;

    parsed.push(check);
  }

  return {
    id: id as ATSCategory["id"],
    name,
    weight,
    score,
    maxScore,
    checks: parsed,
  };
}

export function isAtsReport(value: unknown): ATSReport | null {
  if (!isRecord(value)) return null;

  const {
    version,
    score,
    band,
    confidence,
    confidenceMessage,
    hasExperience,
    categories,
    stats,
  } = value;

  // The one literal worth pinning: a future report shape should be ignored
  // outright rather than half-rendered.
  if (version !== 1) return null;

  if (typeof score !== "number") return null;
  if (band !== "not-ready" && band !== "needs-work" && band !== "strong") {
    return null;
  }
  if (confidence !== "high" && confidence !== "low") return null;
  if (confidenceMessage !== null && typeof confidenceMessage !== "string") {
    return null;
  }
  if (typeof hasExperience !== "boolean") return null;
  if (!Array.isArray(categories) || categories.length === 0) return null;
  if (!isRecord(stats)) return null;
  if (typeof stats.characters !== "number") return null;
  if (typeof stats.wordCount !== "number") return null;
  if (typeof stats.lineCount !== "number") return null;

  const parsed: ATSCategory[] = [];

  for (const item of categories) {
    const category = categoryFrom(item);

    if (!category) return null;

    parsed.push(category);
  }

  return {
    version: 1,
    score,
    band,
    confidence,
    confidenceMessage,
    hasExperience,
    categories: parsed,
    stats: {
      characters: stats.characters,
      wordCount: stats.wordCount,
      lineCount: stats.lineCount,
    },
  };
}
