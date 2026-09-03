import {
  CITY_CODE_RE,
  CITY_REGION_NAME_RE,
  EMAIL_RE,
  GITHUB_RE,
  LINKEDIN_MENTION_RE,
  LINKEDIN_URL_RE,
  PHONE_NA_RE,
  firstMatch,
  hasMatch,
} from "../patterns";
import { check, infoCheck } from "../score";
import type { ATSCheck, ResumeDocument } from "../types";

/**
 * Contact information - 15 points.
 *
 * Email carries most of the weight because it is the one field whose absence
 * makes a resume unusable regardless of anything else. Location and the
 * portfolio links are worth zero: they are genuinely useful advice, but neither
 * is mandatory, and a check that cannot move the score is a check whose false
 * positives cost the user nothing.
 */
export function contactChecks(doc: ResumeDocument): ATSCheck[] {
  return [
    email(doc),
    phone(doc),
    linkedin(doc),
    location(doc),
    links(doc),
  ];
}

function email(doc: ResumeDocument): ATSCheck {
  const found = firstMatch(doc.text, EMAIL_RE);

  return check({
    id: "contact.email",
    name: "Email address",
    severity: found ? "info" : "critical",
    maxScore: 8,
    earned: found ? 8 : 0,
    message: found
      ? `Email address detected (${found}).`
      : "No email address found. This is the single field a recruiter cannot " +
        "work around - add it to the top of the resume in plain text, not " +
        "inside a header, footer, or image.",
  });
}

/**
 * US and Canadian formats only for now. A phone number in another format is
 * still a real phone number, so this is a warning rather than a critical - and
 * global support is a planned follow-up rather than a gap in the rules.
 */
function phone(doc: ResumeDocument): ATSCheck {
  const found = firstMatch(doc.text, PHONE_NA_RE);

  return check({
    id: "contact.phone",
    name: "Phone number",
    severity: found ? "info" : "warning",
    maxScore: 5,
    earned: found ? 5 : 0,
    message: found
      ? `Phone number detected (${found}).`
      : "No phone number found. Add one in a standard format such as " +
        "(416) 555-0134. Note that Aria currently recognises US and Canadian " +
        "numbers only, so a number from elsewhere may be here and simply not " +
        "detected yet.",
  });
}

/**
 * Worth only 2 points on purpose. In a PDF where "LinkedIn" is a hyperlink, the
 * URL lives in a link annotation and the extractor only sees the word - so this
 * check fails on a meaningful share of genuinely well-built resumes. It must
 * never be able to move someone between score bands.
 */
function linkedin(doc: ResumeDocument): ATSCheck {
  const url = firstMatch(doc.text, LINKEDIN_URL_RE);

  if (url) {
    return check({
      id: "contact.linkedin",
      name: "LinkedIn profile",
      severity: "info",
      maxScore: 2,
      earned: 2,
      message: `LinkedIn profile URL detected (${url}).`,
    });
  }

  const mentioned = hasMatch(doc.text, LINKEDIN_MENTION_RE);

  return check({
    id: "contact.linkedin",
    name: "LinkedIn profile",
    severity: "info",
    maxScore: 2,
    earned: 0,
    message: mentioned
      ? "LinkedIn is mentioned but no profile URL came through. If yours is a " +
        "hyperlink behind the word, some parsers will not follow it either - " +
        "write the address out as text: linkedin.com/in/your-name."
      : "No LinkedIn profile found. Not required, but recruiters look for it. " +
        "Add it as plain text: linkedin.com/in/your-name.",
  });
}

/**
 * Zero points, deliberately. Plenty of good resumes omit a full address on
 * purpose, and penalizing that would be advice pointing the wrong way. Detect
 * it, report it, score nothing.
 */
function location(doc: ResumeDocument): ATSCheck {
  // Searched in the header zone only. Two-letter state codes collide with
  // ordinary English words, and scanning the whole document produces hits
  // inside prose.
  const found =
    firstMatch(doc.headerZone, CITY_CODE_RE) ??
    firstMatch(doc.headerZone, CITY_REGION_NAME_RE);

  return infoCheck({
    id: "contact.location",
    name: "Location",
    passed: Boolean(found),
    message: found
      ? `Location detected (${found}). Useful for location-filtered searches.`
      : "No city and province or state found near the top. Optional - many " +
        "resumes leave the address off on purpose - but a line like " +
        "\"Toronto, ON\" helps when a recruiter filters by location.",
  });
}

/** Also zero points. A portfolio link is an asset, never a requirement. */
function links(doc: ResumeDocument): ATSCheck {
  const github = firstMatch(doc.text, GITHUB_RE);

  return infoCheck({
    id: "contact.links",
    name: "Portfolio links",
    passed: Boolean(github),
    message: github
      ? `GitHub profile detected (${github}).`
      : "No GitHub or portfolio link found. Optional, but for technical roles " +
        "it is often the strongest evidence on the page.",
  });
}
