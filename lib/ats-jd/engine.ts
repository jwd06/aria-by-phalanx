import { normalizeResumeText } from "../ats/normalize";
import { SKILL_ALIASES } from "./aliases";
import type { JDMatch } from "./types";

function normalize(text: string): string {
  return normalizeResumeText(text.normalize("NFKC"))
    .toLowerCase()
    .replace(/\s+/gu, " ");
}

function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const canonicalByAlias = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    const key = normalize(alias);
    const existing = canonicalByAlias.get(key);
    if (existing && existing !== canonical) {
      throw new Error(`Conflicting skill alias: ${alias}`);
    }
    canonicalByAlias.set(key, canonical);
  }
}

// Longest first consumes phrases such as React Native before their shorter
// aliases. Unicode boundaries also prevent matching skills inside other words.
const alternatives = [...canonicalByAlias.keys()]
  .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0))
  .map(escapePattern)
  .join("|");
const pattern = `(?<![\\p{L}\\p{N}_+#])(?:${alternatives})(?![\\p{L}\\p{N}_+#]|\\.[\\p{L}\\p{N}])`;

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  // A fresh expression per call avoids shared lastIndex state between requests.
  for (const match of normalize(text).matchAll(new RegExp(pattern, "gu"))) {
    keywords.add(canonicalByAlias.get(match[0])!);
  }
  return [...keywords];
}

/** Called on the server with parsed resume text; never infer unmentioned skills. */
export function matchJobDescription(resumeText: string, jobDescription: string): JDMatch {
  const keywords = extractKeywords(jobDescription);
  const resumeKeywords = new Set(extractKeywords(resumeText));
  return {
    keywords,
    matched: keywords.filter((keyword) => resumeKeywords.has(keyword)),
    missing: keywords.filter((keyword) => !resumeKeywords.has(keyword)),
  };
}
