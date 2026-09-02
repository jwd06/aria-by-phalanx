import ResumeUpload from "../components/ResumeUpload";
import SiteNav from "../components/SiteNav";

export default function AtsCheckerPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[880px] px-24 py-80 sm:px-48">
        <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-berry-lipstick">
          ATS checker
        </span>
        <h1 className="mt-24 font-matter text-heading font-medium leading-none text-platinum">
          See what an ATS reads.
        </h1>
        <p className="mt-24 max-w-xl text-body text-pale-oak">
          Drop in your PDF or DOCX and Aria pulls out the raw text an applicant
          tracking system would see. If something is missing here, it is missing
          for the parser too. Nothing is stored — the text stays in your browser.
        </p>

        <div className="mt-64">
          <ResumeUpload />
        </div>
      </main>
    </>
  );
}
