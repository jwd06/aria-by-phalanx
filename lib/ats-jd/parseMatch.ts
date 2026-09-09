import type { JDMatch } from "./types";

function isKeywordList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

/** Validate the server result without importing the matching engine in the client. */
export function parseJDMatch(value: unknown): JDMatch | null {
  if (!value || typeof value !== "object") return null;
  const { keywords, matched, missing } = value as Record<string, unknown>;
  if (!isKeywordList(keywords) || !isKeywordList(matched) || !isKeywordList(missing)) return null;
  const partition = [...matched, ...missing];
  const keywordSet = new Set(keywords);
  if (
    keywordSet.size !== keywords.length ||
    new Set(partition).size !== partition.length ||
    partition.length !== keywords.length ||
    partition.some((keyword) => !keywordSet.has(keyword))
  ) return null;
  return { keywords, matched, missing };
}
