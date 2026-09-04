import type { ATSReport } from "@/lib/ats/types";
import CategoryBreakdown from "./CategoryBreakdown";
import CheckRow from "./CheckRow";
import LowConfidenceBanner from "./LowConfidenceBanner";
import ScoreDial from "./ScoreDial";

/**
 * The full report. Purely presentational - it renders whatever the engine
 * decided, and makes no scoring judgements of its own.
 *
 * No "use client" pragma: this only ever renders inside ResumeUpload, which is
 * already a client component, so the boundary has been crossed by the time we
 * get here.
 */
export default function AtsReportCard({ report }: { report: ATSReport }) {
  const lowConfidence = report.confidence === "low";

  // With a broken extraction, every downstream row fails for the same reason.
  // Collapsing them keeps the banner and the parsing checks as the story, while
  // leaving the rest one click away rather than hidden.
  const collapseDownstream = lowConfidence;

  return (
    <div className="flex flex-col gap-24">
      {lowConfidence && report.confidenceMessage ? (
        <LowConfidenceBanner message={report.confidenceMessage} />
      ) : null}

      <div className="rounded-card border border-graphite bg-pitch-black/60 p-20 sm:p-32">
        <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-pale-oak/60">
          ATS readiness
        </span>

        <div className="mt-24 flex flex-col gap-40 lg:flex-row lg:items-center lg:justify-between">
          <ScoreDial report={report} />

          <div className="w-full lg:max-w-[360px]">
            <CategoryBreakdown categories={report.categories} />
          </div>
        </div>

        {!report.hasExperience ? (
          <p className="mt-32 border-t border-graphite pt-24 font-arial text-[14px] text-pale-oak">
            Scored for someone without formal work experience yet, so a missing
            Experience section costs nothing here and your Projects section
            carries that weight instead.
          </p>
        ) : null}
      </div>

      {report.categories.map((category) => {
        const failing = category.checks.filter(
          (check) => check.status === "fail"
        ).length;

        const body = (
          <ul className="mt-24 flex flex-col gap-12">
            {category.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        );

        const header = (
          <div className="flex flex-wrap items-baseline justify-between gap-16">
            <span className="font-matter text-subheading font-medium text-platinum">
              {category.name}
            </span>
            <span className="font-arial text-[14px] text-pale-oak">
              {category.score}
              <span className="text-pale-oak/40">/{category.weight}</span>
              {failing > 0 ? (
                <span className="ml-16 text-berry-lipstick">
                  {failing} to fix
                </span>
              ) : null}
            </span>
          </div>
        );

        const collapsed = collapseDownstream && category.id !== "parsing";

        return (
          <div
            key={category.id}
            className="rounded-card border border-graphite bg-pitch-black/60 p-20 sm:p-32"
          >
            {collapsed ? (
              <details>
                <summary className="cursor-pointer list-none">
                  {header}
                  <span className="mt-12 block font-arial text-[14px] text-pale-oak/60">
                    Unreliable until the text extracts properly. Show anyway.
                  </span>
                </summary>
                {body}
              </details>
            ) : (
              <>
                {header}
                {body}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
