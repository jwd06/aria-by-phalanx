import { MAX_HEADER_CHARS, MAX_HEADER_WORDS } from "./constants";
import { ANY_DATE_RE, BULLET_LINE_RE, GLUED_HEADER_RE, hasMatch } from "./patterns";
import type { ResumeDocument } from "./types";

export type SectionId = "experience" | "education" | "skills" | "projects";

export const SECTION_IDS: SectionId[] = [
  "experience",
  "education",
  "skills",
  "projects",
];

export const SECTION_LABELS: Record<SectionId, string> = {
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
};

/**
 * Aliases are stored normalized the same way candidate lines are (lowercase,
 * letters/ampersand/spaces only), so the tables never have to enumerate
 * punctuation or casing variants.
 */
export const SECTION_ALIASES: Record<SectionId, string[]> = {
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "relevant experience",
    "industry experience",
    "employment",
    "employment history",
    "work history",
    "career history",
    "professional background",
  ],
  education: [
    "education",
    "academic background",
    "academics",
    "education and training",
    "educational background",
    "academic qualifications",
  ],
  skills: [
    "skills",
    "technical skills",
    "core skills",
    "technical proficiencies",
    "technologies",
    "tools and technologies",
    "core competencies",
    "technical expertise",
    "skills and abilities",
  ],
  projects: [
    "projects",
    "personal projects",
    "academic projects",
    "selected projects",
    "side projects",
    "technical projects",
    "project experience",
    "portfolio",
  ],
};

/** The bare noun each section is built around, for the modifier + noun fallback. */
const BASE_NOUNS: Record<SectionId, string> = {
  experience: "experience",
  education: "education",
  skills: "skills",
  projects: "projects",
};

export interface DetectedSection {
  id: SectionId;
  /** The heading exactly as it appeared, for showing the user what we read. */
  heading: string;
  lineIndex: number;
  /**
   * True when the heading was only found glued onto the line beneath it, which
   * is a two-column export artifact rather than a real heading.
   */
  inline: boolean;
}

export interface SectionIndex {
  found: Record<SectionId, DetectedSection | null>;
  /** Detected headings in the order they appear in the document. */
  order: DetectedSection[];
  /** True when at least one heading was only recoverable in glued form. */
  hasInlineHeadings: boolean;
}

/**
 * Reduces a line to a comparable form: lowercase, letters, ampersands and
 * spaces only. Trailing colons, leading bullet glyphs, numbering and casing all
 * disappear here rather than being enumerated in the alias tables.
 */
function normalizeCandidate(line: string): string {
  return line
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Section headings are short. Prose is not. This single constraint is the whole
 * defense against matching the word "experience" inside a bullet like "5 years
 * of experience building distributed systems".
 */
function isHeadingShaped(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_HEADER_CHARS) return false;
  if (trimmed.split(/\s+/).length > MAX_HEADER_WORDS) return false;

  // A sentence, not a heading.
  if (trimmed.endsWith(".")) return false;

  // A bullet point that happens to be short.
  if (hasMatch(trimmed, BULLET_LINE_RE)) return false;

  // A job or degree entry. "Software Engineer, 2023 - Present" is four words
  // and would otherwise sail through every check above.
  if (hasMatch(trimmed, ANY_DATE_RE)) return false;

  return true;
}

/**
 * Matches a normalized candidate against the alias tables.
 *
 * LONGEST MATCHING ALIAS WINS, and that rule is load-bearing: "project
 * experience" matches both the experience table (via the base-noun fallback)
 * and the projects table (exactly). Resolving it to Experience would read a
 * student's projects section as work history, which silently breaks the whole
 * `hasExperience: false` path.
 */
function classify(candidate: string): SectionId | null {
  let best: { id: SectionId; length: number } | null = null;

  for (const id of SECTION_IDS) {
    for (const alias of SECTION_ALIASES[id]) {
      if (candidate === alias && (!best || alias.length > best.length)) {
        best = { id, length: alias.length };
      }
    }
  }

  if (best) return best.id;

  // Fallback: "modifier + base noun". Generalizes to headings the alias tables
  // do not list ("core technical skills", "capstone projects") without an
  // exhaustive enumeration. Only reachable for lines that already passed the
  // heading-shape test, so the false-positive surface is small.
  for (const id of SECTION_IDS) {
    const noun = BASE_NOUNS[id];

    if (candidate === noun || candidate.endsWith(` ${noun}`)) {
      if (!best || noun.length > best.length) {
        best = { id, length: noun.length };
      }
    }
  }

  return best?.id ?? null;
}

/**
 * Finds the four sections the score cares about.
 *
 * Section ORDER is recorded but never penalized. Education before Experience is
 * completely normal for a student, and an ATS does not care either - the report
 * shows the order it read as context and deducts nothing for it.
 */
export function detectSections(doc: ResumeDocument): SectionIndex {
  const found: Record<SectionId, DetectedSection | null> = {
    experience: null,
    education: null,
    skills: null,
    projects: null,
  };

  const order: DetectedSection[] = [];
  let hasInlineHeadings = false;

  doc.lines.forEach((line, lineIndex) => {
    if (!isHeadingShaped(line)) return;

    const id = classify(normalizeCandidate(line));

    if (!id) return;

    const section: DetectedSection = {
      id,
      heading: line.trim(),
      lineIndex,
      inline: false,
    };

    order.push(section);

    // First occurrence wins. A resume that repeats a heading is unusual, and
    // the first is the one an ATS keys off.
    found[id] ??= section;
  });

  // Second pass, only for sections still missing. A two-column PDF collapse
  // glues the heading onto the entry beneath it, so the heading exists but is
  // no longer on a line of its own. Recovering it here stops a badly-exported
  // resume from being told it has no sections at all, while the `inline` flag
  // keeps the real defect visible in Formatting Safety.
  doc.lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    const glued = trimmed.match(GLUED_HEADER_RE);

    if (!glued) return;

    const id = classify(normalizeCandidate(glued[1]));

    if (!id || found[id]) return;

    const section: DetectedSection = {
      id,
      heading: glued[1],
      lineIndex,
      inline: true,
    };

    found[id] = section;
    order.push(section);
    hasInlineHeadings = true;
  });

  order.sort((a, b) => a.lineIndex - b.lineIndex);

  return { found, order, hasInlineHeadings };
}
