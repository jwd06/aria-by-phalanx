import type { Metadata } from "next";
import { Suspense } from "react";
import AtsCheckerModes from "../components/ats/AtsCheckerModes";
import SiteNav from "../components/SiteNav";

export const metadata: Metadata = {
  title: "ATS Checker | Aria",
  description:
    "Check your resume's ATS readiness or compare it with a job description to find matched and missing software skills.",
};

export default function AtsCheckerPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[880px] px-24 py-48 sm:px-48 sm:py-80">
        <h1 className="font-matter text-heading font-medium leading-none text-platinum">
          ATS Checker
        </h1>
        <p className="mt-24 max-w-xl text-body text-pale-oak">
          Check how your resume reads to an ATS or compare its skills with a job
          description.
        </p>
        <p className="mt-16 max-w-xl font-arial text-[14px] text-pale-oak">
          Your documents are processed on the server and are not stored.
        </p>

        <Suspense fallback={<p role="status" className="mt-48 text-body text-pale-oak">Loading checker modes…</p>}>
          <AtsCheckerModes />
        </Suspense>
      </main>
    </>
  );
}
