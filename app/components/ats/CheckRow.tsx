import type { ATSCheck } from "@/lib/ats/types";

/**
 * One check.
 *
 * Severity is carried by the text label as well as the colour. DESIGN.md has
 * five colours and no success green, so the palette encodes FAILURE only:
 * berry-lipstick is the alarm, everything healthy is platinum and pale oak.
 * That keeps the eye going straight to what is wrong, which is this page's
 * actual job, without inventing a sixth token.
 */

type Tone = {
  container: string;
  dot: string;
  label: string;
  text: string;
};

const TONES: Record<string, Tone> = {
  skipped: {
    container: "border-graphite opacity-50",
    dot: "bg-graphite",
    label: "Not applicable",
    text: "text-pale-oak/60",
  },
  critical: {
    container: "border-berry-lipstick/40 bg-berry-lipstick/10",
    dot: "bg-berry-lipstick",
    label: "Critical",
    text: "text-berry-lipstick",
  },
  warning: {
    container: "border-pale-oak/30",
    dot: "bg-pale-oak",
    label: "Needs work",
    text: "text-pale-oak",
  },
  info: {
    container: "border-graphite",
    dot: "bg-pale-oak/40",
    label: "Suggestion",
    text: "text-pale-oak/60",
  },
  pass: {
    container: "border-graphite",
    dot: "bg-pale-oak/30",
    label: "Passed",
    text: "text-platinum",
  },
};

function toneFor(check: ATSCheck): Tone {
  if (check.status === "skipped") return TONES.skipped;
  if (check.status === "pass") return TONES.pass;

  return TONES[check.severity] ?? TONES.warning;
}

export default function CheckRow({ check }: { check: ATSCheck }) {
  const tone = toneFor(check);

  return (
    <li
      className={`flex gap-16 rounded-small border p-20 ${tone.container}`}
    >
      {/* Arbitrary values, not `h-8 w-8`: this project's spacing scale only
          defines the tokens in DESIGN.md, so a bare number falls through to
          Tailwind's default rem scale and renders four times too large. */}
      <span
        aria-hidden="true"
        className={`mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full ${tone.dot}`}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-12">
          <span className="font-arial text-[14px] text-platinum">
            {check.name}
          </span>
          <span
            className={`font-arial text-[10px] uppercase tracking-[0.15em] ${tone.text}`}
          >
            {tone.label}
          </span>
          {check.maxScore > 0 ? (
            <span className="font-arial text-[10px] uppercase tracking-[0.15em] text-pale-oak/40">
              {check.score}/{check.maxScore}
            </span>
          ) : null}
        </div>

        <p className="mt-12 font-arial text-[14px] leading-[1.43] text-pale-oak">
          {check.message}
        </p>
      </div>
    </li>
  );
}
