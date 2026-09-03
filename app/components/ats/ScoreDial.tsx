import type { ATSReport } from "@/lib/ats/types";

const BAND_LABELS: Record<ATSReport["band"], string> = {
  "not-ready": "Not ready",
  "needs-work": "Needs work",
  strong: "Strong",
};

const SIZE = 148;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The headline number. Graphite track, berry-lipstick arc - no green, per the
 * failure-only colour rule in CheckRow.
 */
export default function ScoreDial({ report }: { report: ATSReport }) {
  const filled = Math.max(0, Math.min(100, report.score)) / 100;

  return (
    <div className="flex items-center gap-24">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`ATS readiness score ${report.score} out of 100. ${BAND_LABELS[report.band]}.`}
        >
          {/* Rotated so the arc starts at twelve o'clock rather than three. */}
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-graphite)"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-berry-lipstick)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
            />
          </g>
        </svg>

        {/* The number belongs inside the ring - the arc is the same
            measurement, and splitting them reads as two separate facts. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-matter text-heading font-medium leading-none text-platinum">
            {report.score}
          </span>
          <span className="mt-12 font-arial text-[10px] uppercase tracking-[0.15em] text-pale-oak/60">
            out of 100
          </span>
        </div>
      </div>

      <div>
        <p className="font-matter text-subheading font-medium text-berry-lipstick">
          {BAND_LABELS[report.band]}
        </p>
        <p className="mt-12 font-arial text-[14px] text-pale-oak">
          {report.stats.wordCount.toLocaleString()} words ·{" "}
          {report.stats.lineCount.toLocaleString()} lines read
        </p>
      </div>
    </div>
  );
}
