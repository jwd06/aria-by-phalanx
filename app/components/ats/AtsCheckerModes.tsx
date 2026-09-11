"use client";

import { useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import ResumeUpload from "../ResumeUpload";
import JDChecker from "../ats-jd/JDChecker";

const MODES = [
  { id: "readiness", label: "ATS Readiness Checker" },
  { id: "jd", label: "ATS JD Checker" },
] as const;

type Mode = (typeof MODES)[number]["id"];

export default function AtsCheckerModes() {
  const searchParams = useSearchParams();
  const activeMode: Mode = searchParams.get("mode") === "jd" ? "jd" : "readiness";
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function selectMode(mode: Mode) {
    if (mode === activeMode) return;

    const url = new URL(window.location.href);
    if (mode === "jd") url.searchParams.set("mode", "jd");
    else url.searchParams.delete("mode");

    // Next syncs native history with useSearchParams without remounting forms.
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % MODES.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + MODES.length) % MODES.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = MODES.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    selectMode(MODES[nextIndex].id);
  }

  return (
    <div className="mt-48">
      <div role="tablist" aria-label="ATS checker mode" className="grid grid-cols-2 gap-2 rounded-card border border-graphite bg-pitch-black/60 p-2">
        {MODES.map((mode, index) => (
          <button
            key={mode.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`ats-tab-${mode.id}`}
            type="button"
            role="tab"
            aria-selected={activeMode === mode.id}
            aria-controls={`ats-panel-${mode.id}`}
            tabIndex={activeMode === mode.id ? 0 : -1}
            onClick={() => selectMode(mode.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-w-0 rounded-button px-12 py-16 font-arial text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platinum sm:px-24 ${
              activeMode === mode.id
                ? "bg-berry-lipstick text-platinum"
                : "text-pale-oak hover:bg-graphite hover:text-platinum"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Keep both forms mounted so changing modes preserves independent work. */}
      <section
        id="ats-panel-readiness"
        role="tabpanel"
        aria-labelledby="ats-tab-readiness"
        hidden={activeMode !== "readiness"}
        tabIndex={0}
        className="mt-32 rounded-small focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-platinum"
      >
        <h2 className="font-matter text-subheading font-medium text-platinum">See what an ATS reads.</h2>
        <p className="mt-16 max-w-xl text-body text-pale-oak">
          Drop in your PDF or DOCX. Aria pulls out the raw text an applicant
          tracking system would see, then scores it out of 100 across parsing,
          contact details, sections, structure and formatting — with the exact
          reason behind every point. If something is missing here, it is missing
          for the parser too.
        </p>
        <div className="mt-48">
          <ResumeUpload />
        </div>
      </section>

      <section
        id="ats-panel-jd"
        role="tabpanel"
        aria-labelledby="ats-tab-jd"
        hidden={activeMode !== "jd"}
        tabIndex={0}
        className="mt-32 rounded-small focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-platinum"
      >
        <h2 className="font-matter text-subheading font-medium text-platinum">Find the skills your resume is missing.</h2>
        <p className="mt-16 max-w-xl text-body text-pale-oak">
          Upload your resume and paste a job description. Compare the software
          skills mentioned in the job with the words in your resume, including
          common names like Postgres and PostgreSQL.
        </p>
        <p className="mt-16 max-w-xl font-arial text-[14px] text-pale-oak">
          This checks keyword coverage, not your qualifications or ATS readiness.
        </p>
        <div className="mt-48">
          <JDChecker />
        </div>
      </section>
    </div>
  );
}
