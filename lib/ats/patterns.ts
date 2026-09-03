/**
 * Every regular expression the ATS engine uses, in one place, because they are
 * the highest-risk surface in the whole feature and need testing in isolation.
 *
 * Two conventions here:
 *
 * 1. Every exported RegExp is NON-GLOBAL. A global RegExp carries `lastIndex`
 *    between calls, so `re.test(x)` twice on the same input returns true then
 *    false. Counting goes through the helpers below, which clone the pattern
 *    with `g` instead of mutating a shared one.
 * 2. Non-ASCII characters are written as `\uXXXX` escapes inside `new RegExp`
 *    strings rather than pasted literally. Several of the characters that
 *    matter here (zero-width space, soft hyphen, byte-order mark) are invisible
 *    in an editor, and a pasted one is impossible to review or diff.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withGlobal(re: RegExp): RegExp {
  return re.flags.includes("g") ? re : new RegExp(re.source, `${re.flags}g`);
}

export function hasMatch(text: string, re: RegExp): boolean {
  return withGlobal(re).test(text);
}

export function countMatches(text: string, re: RegExp): number {
  return (text.match(withGlobal(re)) ?? []).length;
}

export function allMatches(text: string, re: RegExp): string[] {
  return [...text.matchAll(withGlobal(re))].map((match) => match[0]);
}

export function firstMatch(text: string, re: RegExp): string | null {
  return text.match(withGlobal(re))?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/** The hyphen is last in each class - anywhere else it would open a range. */
export const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/;

/**
 * North American (US/Canada) numbers only for now. Global support is a later
 * pass, and a loose "any ten digits" pattern would make this check useless.
 *
 * Three things here are load-bearing:
 *
 * - `[ .-]` rather than `[\s.-]`. `\s` matches a newline, which would let
 *   "...revenue 250\n555 1234 units" read as a phone number spanning two
 *   unrelated lines. Normalization already collapsed tabs, so a literal space
 *   is the only whitespace that can legitimately sit inside a number.
 * - `(?<!\d)` / `(?!\d)` stop a ten-digit window inside a longer digit run
 *   (student numbers, order IDs) from matching. Lookbehind is safe because the
 *   engine only ever runs under `runtime = "nodejs"`.
 * - NANP `[2-9]` on both the area code and the exchange. This is what rejects
 *   the noise: "90210-1234" fails at every alignment, and a year range like
 *   "2019 - 2021" cannot match at all because the pattern needs 3+3+4 digits.
 */
export const PHONE_NA_RE =
  /(?<!\d)(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[ .-]?[2-9]\d{2}[ .-]?\d{4}(?!\d)/;

/**
 * `[a-z]{2,3}\.` covers both `www.` and country subdomains like `ca.`. The slug
 * class excludes `/`, `?` and `)`, so a trailing query string or bracket ends
 * the match cleanly.
 */
export const LINKEDIN_URL_RE =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9._%-]{2,100}/i;

/**
 * Deliberately separate from the URL form. In a PDF where "LinkedIn" is a
 * hyperlink, the URL lives in a link annotation, and `pdf-parse` returns text
 * runs rather than annotations - so a perfectly good resume extracts as the
 * bare word. Detecting that case earns a much more useful message than a flat
 * fail would.
 */
export const LINKEDIN_MENTION_RE = /\blinkedin\b/i;

/**
 * Trailing `)`, `>`, `]`, `,` and `;` are excluded so "(https://x.com)." does
 * not capture "x.com)." the way a plain `[^\s]+` tail does.
 */
export const URL_RE = /(?:https?:\/\/|www\.)[^\s)>\],;]+/i;

/**
 * GitHub gets a bare-domain form of its own, because "github.com/jane" written
 * with no scheme and no `www.` is extremely common on resumes and URL_RE misses
 * it entirely.
 */
export const GITHUB_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\/[A-Za-z0-9._-]+)?/i;

// ---------------------------------------------------------------------------
// Location - informational only, never deducts a point
// ---------------------------------------------------------------------------

const CA_CODES = "AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT";

const US_CODES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|" +
  "MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const REGION_NAMES = [
  // Canada
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Northwest Territories",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
  "Yukon",
  // United States
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

/**
 * Sorted longest-first. Alternation is leftmost-first, so an unsorted list lets
 * a short name shadow a longer one starting with it - "New" would make
 * "New York" unreachable.
 */
const REGION_NAMES_ALTERNATION = [...REGION_NAMES]
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * `’` is the typographic apostrophe (St. John's, Coeur d'Alene).
 *
 * NOTE: `-` is deliberately absent from the word class. Putting it in both the
 * inner `+` class and the `[- ]` separator makes the decomposition ambiguous
 * inside the bounded repetition, which backtracks catastrophically on
 * hyphen-heavy junk. Do not add it back.
 */
const CITY = "[A-Z][A-Za-z.'\\u2019]+(?:[- ][A-Z][A-Za-z.'\\u2019]+){0,3}";

/**
 * NO `i` FLAG, AND THAT IS THE POINT. `IN`, `OR`, `OK`, `ME`, `HI`, `DE`, `LA`
 * and `PA` are all ordinary English words; case is the only thing separating
 * "Toronto, ON" from "...the migration, IN progress". Adding `i` here turns the
 * check into a false-positive generator.
 *
 * Because location is worth zero points, a false positive costs nothing - so
 * resist over-tuning this in the other direction too.
 */
export const CITY_CODE_RE = new RegExp(
  `\\b${CITY},\\s?(?:${CA_CODES}|${US_CODES})(?![A-Za-z])`
);

/** Same case-sensitivity reasoning as above. */
export const CITY_REGION_NAME_RE = new RegExp(
  `\\b${CITY},\\s?(?:${REGION_NAMES_ALTERNATION})\\b`
);

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTH =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?" +
  "|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

const YEAR = "(?:19|20)\\d{2}";

/** "Jan 2025", "Jan. 2025", "January, 2025", "Jan2025". */
const MONTH_YEAR = `(?:${MONTH})\\.?,?[ ]?${YEAR}`;

/** "01/2025", "1-2025". */
const NUM_MONTH_YEAR = `(?:0?[1-9]|1[0-2])[/-]${YEAR}`;

/**
 * Plain hyphen, then U+2010-U+2015 (non-breaking hyphen, figure dash, en dash,
 * em dash, horizontal bar), then U+2212 minus. The spec named the hyphen and en
 * dash; U+2011 and U+2212 turn up constantly in Word exports and would silently
 * break range detection if left out.
 */
const DASH = "[-\\u2010-\\u2015\\u2212]";

const RANGE_SEP = `[ ]?(?:${DASH}|to|through|until)[ ]?`;

const OPEN_ENDED = "Present|Current|Now|Ongoing|Today";

export const MONTH_YEAR_RE = new RegExp(MONTH_YEAR, "i");

export const NUM_MONTH_YEAR_RE = new RegExp(`\\b${NUM_MONTH_YEAR}\\b`);

/** 1970-2049. Narrower than `(19|20)\d{2}` to shed a little street-number noise. */
export const BARE_YEAR_RE = /\b(?:19[7-9]\d|20[0-4]\d)\b/;

/**
 * The strongest chronology signal, and the only one worth full credit. See the
 * note on bare years in rules/structure.ts for why.
 */
export const DATE_RANGE_RE = new RegExp(
  `(?:${MONTH_YEAR}|\\b${NUM_MONTH_YEAR}\\b|\\b${YEAR}\\b)` +
    RANGE_SEP +
    `(?:${OPEN_ENDED}|${MONTH_YEAR}|\\b${NUM_MONTH_YEAR}\\b|\\b${YEAR}\\b)`,
  "i"
);

/** Used to reject header candidates: a section heading never carries a date. */
export const ANY_DATE_RE = new RegExp(
  `(?:${MONTH_YEAR}|\\b${NUM_MONTH_YEAR}\\b|\\b${YEAR}\\b|\\b(?:${OPEN_ENDED})\\b)`,
  "i"
);

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Decorative glyphs that confuse parsers or render as boxes: stars, arrows,
 * heavy check and cross marks, card suits, and emoji.
 *
 * U+2605 star, U+2606 white star, U+2726/U+2727 four-pointed stars,
 * U+25B6/U+25B8/U+25C0 triangles, U+25A0/U+25A1 large squares,
 * U+2660-U+2666 card suits, U+2794/U+279C/U+27A4 arrows,
 * U+2713/U+2714/U+2717/U+2718 checks and crosses, U+2756/U+274B ornaments,
 * U+2192/U+21D2 arrows, and the emoji block.
 *
 * Explicitly NOT here and never penalized: U+2022 bullet, U+25AA/U+25AB small
 * squares, U+25E6 white bullet, U+2023 triangular bullet, U+00B7 middle dot,
 * and the plain hyphen and en dash. U+25AA and U+25AB in particular are Word's
 * own default second-level bullet glyphs and appear in completely ATS-safe
 * documents - so although the spec listed filled squares as decorative, only
 * the large U+25A0/U+25A1 pair is flagged.
 */
export const DECORATIVE_SYMBOL_RE = new RegExp(
  "[\\u2605\\u2606\\u2726\\u2727\\u25B6\\u25B8\\u25C0\\u25A0\\u25A1" +
    "\\u2660-\\u2666\\u2794\\u279C\\u27A4\\u2713\\u2714\\u2717\\u2718" +
    "\\u2756\\u274B\\u2192\\u21D2]|[\\u{1F300}-\\u{1FAFF}]",
  "u"
);

/**
 * Extraction FAILED: U+FFFD replacement characters, pdf.js `(cid:NN)` fallbacks
 * for glyphs it could not map, and stray C0 control codes. Tab, newline and
 * carriage return are excluded on purpose.
 *
 * U+FFFD lives here and nowhere else - listing it as decorative as well would
 * punish one root cause across two separate categories.
 */
export const GARBLE_RE = new RegExp(
  "\\uFFFD|\\(cid:\\d+\\)|[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"
);

/**
 * Extraction SUCCEEDED but keyword matching will break: U+00A0 non-breaking
 * space, U+00AD soft hyphen, U+200B-U+200D zero-width spaces and joiners,
 * U+2060 word joiner, U+FEFF byte-order mark, and the U+FB00-U+FB06 Latin
 * ligatures (a single "fi" ligature glyph defeats a search for
 * "classification").
 *
 * Different failure, different remedy, hence a different category from
 * GARBLE_RE above.
 */
export const INVISIBLE_RE = new RegExp(
  "[\\u00A0\\u00AD\\u200B-\\u200D\\u2060\\uFEFF]|[\\uFB00-\\uFB06]"
);

/**
 * A line that opens with a bullet glyph: U+2022, U+25AA, U+25AB, U+25E6,
 * U+2023, U+00B7, U+2043, U+25CF, U+25CB, asterisk, en dash, hyphen.
 */
export const BULLET_LINE_RE = new RegExp(
  "^[ ]*[\\u2022\\u25AA\\u25AB\\u25E6\\u2023\\u00B7\\u2043\\u25CF\\u25CB*\\u2013-][ \\t]+\\S"
);

/**
 * Evidence of impact: a percentage, a currency figure (`$`, U+00A3, U+20AC), a
 * scaled number (2.5x, 40k), or any number of two or more digits. Callers strip
 * date ranges from the line first, so "2021 - 2023" does not read as a metric.
 */
export const QUANTIFIED_RE = new RegExp(
  "\\d+(?:\\.\\d+)?[ ]?%|[$\\u00A3\\u20AC][ ]?\\d" +
    "|\\b\\d+(?:\\.\\d+)?[ ]?(?:x|k|m|bn)\\b|\\b\\d{2,}",
  "i"
);

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * UPPERCASE ONLY, no `i` flag. This one runs against long lines, where a PDF has
 * glued a heading onto the entry beneath it ("EXPERIENCE Software Engineer,
 * Acme"), and requiring all-caps is the only thing keeping it off ordinary
 * prose.
 */
export const GLUED_HEADER_RE =
  /^(EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|WORK HISTORY|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS)\b/;

/**
 * Used only to soften the message when an Education heading is missing but the
 * content is plainly there. Never enough to pass the check: ATS parsers key off
 * the heading, so "we found degrees but no heading" is the honest finding.
 */
export const DEGREE_KEYWORD_RE =
  /\b(?:Bachelor|Bachelors|B\.?A\.?|B\.?Sc|BEng|Master|Masters|M\.?Sc|M\.?Eng|MBA|Ph\.?D|Doctorate|Diploma|University|College|Polytechnic)\b/i;
