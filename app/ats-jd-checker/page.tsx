import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import JDChecker from "../components/ats-jd/JDChecker";

export const metadata: Metadata = {
  title: "ATS JD checker | Aria",
  description: "Compare your resume with a job description to find matched and missing software skills.",
};

export default function AtsJDCheckerPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[880px] px-24 py-48 sm:px-48 sm:py-80">
        <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-berry-lipstick">
          ATS JD checker
        </span>
        <h1 className="mt-24 font-matter text-heading font-medium leading-none text-platinum">
          Find the skills your resume is missing.
        </h1>
        <p className="mt-24 max-w-xl text-body text-pale-oak">
          Upload your resume and paste a job description. Compare the software
          skills mentioned in the job with the words in your resume, including
          common names like Postgres and PostgreSQL.
        </p>
        <p className="mt-16 max-w-xl font-arial text-[14px] text-pale-oak">
          Your documents are processed on the server and are not stored.
          This checks keyword coverage, not your qualifications or ATS readiness.
        </p>
        <div className="mt-48">
          <JDChecker />
        </div>
      </main>
    </>
  );
}
