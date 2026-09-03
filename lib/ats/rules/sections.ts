import { DEGREE_KEYWORD_RE, hasMatch } from "../patterns";
import { check, infoCheck, skippedCheck } from "../score";
import { SECTION_LABELS } from "../sectionIndex";
import type { SectionIndex } from "../sectionIndex";
import type { ATSCheck, ATSSeverity, ResumeDocument } from "../types";

/**
 * Resume sections - 25 points.
 *
 * The point budget shifts depending on whether the person has formal work
 * experience, and the two columns of this table both total 25:
 *
 *   check       hasExperience: true    hasExperience: false
 *   experience  10, critical           skipped, 0
 *   education    6, warning             6, warning
 *   skills       6, warning             6, warning
 *   projects     3, info               13, critical
 *
 * The transfer is explicit rather than emergent. Someone who has not held a job
 * yet is not penalized for the missing section - but Projects stops being a
 * bonus and becomes the load-bearing evidence of applied work, so its severity
 * flips too, not just its weight.
 */
export function sectionChecks(
  doc: ResumeDocument,
  index: SectionIndex,
  hasExperience: boolean
): ATSCheck[] {
  return [
    experience(index, hasExperience),
    education(doc, index),
    skills(index),
    projects(index, hasExperience),
    readingOrder(index),
  ];
}

function experience(index: SectionIndex, hasExperience: boolean): ATSCheck {
  if (!hasExperience) {
    return skippedCheck({
      id: "sections.experience",
      name: "Experience section",
      message:
        "Not applicable - you told us you do not have formal work experience " +
        "yet, so this is not counted against your score. Your Projects " +
        "section carries that weight instead.",
    });
  }

  const found = index.found.experience;

  return check({
    id: "sections.experience",
    name: "Experience section",
    severity: found ? "info" : "critical",
    maxScore: 10,
    earned: found ? 10 : 0,
    message: found
      ? `Experience section found ("${found.heading}").`
      : "No Experience heading found. ATS parsers look for these exact words " +
        "to decide where your work history begins - a creative heading like " +
        "\"Where I've Worked\" will not be recognised. Use \"Experience\" or " +
        "\"Work Experience\" on a line of its own.",
  });
}

/**
 * The degree-keyword fallback never makes this check pass: an ATS keys off the
 * heading, so "we found degrees but no heading" is the honest finding. It only
 * softens the severity and the wording, because that is much more useful advice
 * than a flat fail.
 */
function education(doc: ResumeDocument, index: SectionIndex): ATSCheck {
  const found = index.found.education;

  if (found) {
    return check({
      id: "sections.education",
      name: "Education section",
      severity: "info",
      maxScore: 6,
      earned: 6,
      message: `Education section found ("${found.heading}").`,
    });
  }

  const hasDegreeContent = hasMatch(doc.text, DEGREE_KEYWORD_RE);

  return check({
    id: "sections.education",
    name: "Education section",
    severity: "warning",
    maxScore: 6,
    earned: 0,
    message: hasDegreeContent
      ? "Degree and school keywords are in the text, but there is no " +
        "Education heading above them. ATS parsers key off the heading, so " +
        "add \"Education\" on a line of its own."
      : "No Education section found. Add one with \"Education\" as the " +
        "heading, listing your school, credential and completion date.",
  });
}

function skills(index: SectionIndex): ATSCheck {
  const found = index.found.skills;

  return check({
    id: "sections.skills",
    name: "Skills section",
    severity: found ? "info" : "warning",
    maxScore: 6,
    earned: found ? 6 : 0,
    message: found
      ? `Skills section found ("${found.heading}").`
      : "No Skills section found. This is where keyword matching does most of " +
        "its work - add a \"Skills\" heading listing your tools, languages " +
        "and technologies in plain text.",
  });
}

function projects(index: SectionIndex, hasExperience: boolean): ATSCheck {
  const found = index.found.projects;
  const maxScore = hasExperience ? 3 : 13;

  const severity: ATSSeverity = found
    ? "info"
    : hasExperience
      ? "info"
      : "critical";

  return check({
    id: "sections.projects",
    name: "Projects section",
    severity,
    maxScore,
    earned: found ? maxScore : 0,
    message: found
      ? `Projects section found ("${found.heading}").`
      : hasExperience
        ? "No Projects section found. Optional when you have work history, " +
          "but a short one is useful evidence for technical roles."
        : "No Projects section found. Without formal work experience this is " +
          "the only place a recruiter can see what you can actually build, " +
          "so it matters more here than anything else on the page. Add a " +
          "\"Projects\" heading with two or three projects, each with what " +
          "you built, the tools you used, and the outcome.",
  });
}

/**
 * Recorded, never penalized. Education before Experience is completely normal
 * for a student, and an ATS does not care about the order either - this exists
 * so the user can see what was actually read, which is the whole premise of the
 * page.
 */
function readingOrder(index: SectionIndex): ATSCheck {
  const detected = index.order.filter(
    (section, position) =>
      index.order.findIndex((other) => other.id === section.id) === position
  );

  const summary = detected
    .map((section) => SECTION_LABELS[section.id])
    .join(" > ");

  return infoCheck({
    id: "sections.reading-order",
    name: "Reading order",
    passed: detected.length > 0,
    message: summary
      ? `Sections were read in this order: ${summary}. Order is not scored - ` +
        `leading with Education is normal for a student, and an ATS reads ` +
        `whatever order you use.`
      : "No standard section headings were found, so there is no reading " +
        "order to report.",
  });
}
