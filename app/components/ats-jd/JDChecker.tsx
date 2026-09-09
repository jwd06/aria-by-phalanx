"use client";

import { useRef, useState, type FormEvent } from "react";
import { MAX_JOB_DESCRIPTION_CHARS } from "@/lib/ats-jd/constants";
import { parseJDMatch } from "@/lib/ats-jd/parseMatch";
import type { JDMatch } from "@/lib/ats-jd/types";
import { ACCEPT, MAX_RESUME_BYTES, MAX_RESUME_LABEL, resolveResumeKind } from "@/lib/resume/fileTypes";

const REQUEST_TIMEOUT_MS = 45_000;

export default function JDChecker() {
  const inFlightRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JDMatch | null>(null);

  function clearResult() {
    setResult(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;
    clearResult();

    if (!file || !jobDescription.trim()) {
      setError("Choose a resume and paste a job description first.");
      return;
    }
    if (!resolveResumeKind(file)) {
      setError("Only PDF and DOCX files are supported");
      return;
    }
    if (file.size === 0) {
      setError("That file is empty");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError(`Resume must be smaller than ${MAX_RESUME_LABEL}`);
      return;
    }
    if (jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) {
      setError("Job description must be 30,000 characters or fewer");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      body.append("jobDescription", jobDescription);
      const response = await fetch("/api/resume/extract", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // Platform errors may return HTML rather than our JSON envelope.
      const data: unknown = await response.json().catch(() => null);
      const record = data && typeof data === "object" ? data as Record<string, unknown> : null;
      if (!response.ok) {
        setError(
          typeof record?.error === "string" ? record.error : response.status === 413
            ? "That upload is too large. Try a smaller resume or shorter job description."
            : "Unable to check this resume. Please try again."
        );
        return;
      }
      const match = parseJDMatch(record?.jdMatch);
      if (!match) {
        setError("Got an unexpected response from the server. Try again.");
        return;
      }
      setResult(match);
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? "That took too long to read. Try again, or try a smaller file."
          : "Something went wrong uploading that file. Try again."
      );
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <form onSubmit={submit} aria-busy={loading} className="rounded-card border border-graphite bg-pitch-black/60 p-20 sm:p-32">
        <fieldset disabled={loading} className="flex min-w-0 flex-col gap-24 disabled:opacity-60">
          <legend className="sr-only">Compare your resume with a job description</legend>
          <div>
            <label htmlFor="jd-resume" className="block font-matter text-subheading font-medium text-platinum">Your resume</label>
            <p id="jd-resume-help" className="mt-12 font-arial text-[14px] text-pale-oak">PDF or DOCX, up to {MAX_RESUME_LABEL}</p>
            <input
              id="jd-resume"
              type="file"
              accept={ACCEPT}
              required
              aria-describedby="jd-resume-help"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                clearResult();
              }}
              className="mt-16 block w-full min-w-0 rounded-small font-arial text-[14px] text-pale-oak file:mr-16 file:cursor-pointer file:rounded-button file:border-0 file:bg-graphite file:px-20 file:py-12 file:text-platinum focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-berry-lipstick"
            />
          </div>
          <div>
            <label htmlFor="job-description" className="block font-matter text-subheading font-medium text-platinum">Job description</label>
            <p id="jd-help" className="mt-12 font-arial text-[14px] text-pale-oak">Paste the job description, including the skills and requirements.</p>
            <textarea
              id="job-description"
              required
              rows={9}
              maxLength={MAX_JOB_DESCRIPTION_CHARS}
              value={jobDescription}
              aria-describedby="jd-help jd-character-count"
              placeholder="We are looking for a software engineer experienced with React, TypeScript, PostgreSQL, AWS, REST APIs and Docker…"
              onChange={(event) => {
                setJobDescription(event.target.value);
                clearResult();
              }}
              className="mt-16 block w-full resize-y rounded-small border border-graphite bg-pitch-black p-16 font-arial text-body text-platinum placeholder:text-pale-oak/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-lipstick"
            />
            <p id="jd-character-count" className="mt-12 text-right font-arial text-[12px] text-pale-oak">{jobDescription.length.toLocaleString("en-US")} / 30,000 characters</p>
          </div>
          <button
            type="submit"
            disabled={loading || !file || !jobDescription.trim()}
            className="self-start rounded-button bg-berry-lipstick px-24 py-16 font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-platinum disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking…" : "Check JD match"}
          </button>
        </fieldset>
      </form>
      {error ? <p role="alert" className="font-arial text-[14px] text-berry-lipstick">{error}</p> : null}
      <div aria-live="polite" aria-atomic="true">
        {loading ? <p className="font-arial text-[14px] text-pale-oak">Reading your resume and comparing job keywords…</p> : null}
        {result ? (
          <section aria-labelledby="jd-results-title" className="rounded-card border border-graphite bg-pitch-black/60 p-20 sm:p-32">
            <h2 id="jd-results-title" className="font-matter text-subheading font-medium text-platinum">Your JD keyword match</h2>
            <p className="mt-12 font-arial text-[14px] text-pale-oak">
              {result.keywords.length} recognized job keywords · {result.matched.length} matched · {result.missing.length} missing
            </p>
            {result.keywords.length === 0 ? (
              <p className="mt-24 text-body text-pale-oak">No supported software skills were found in this job description. Try a description that includes specific technologies or tools.</p>
            ) : (
              <div className="mt-24 grid gap-24 sm:grid-cols-2">
                <KeywordList title="Matched" keywords={result.matched} empty="No recognized job keywords were found in your resume." />
                <KeywordList title="Missing" keywords={result.missing} empty="All recognized job keywords were found in your resume." />
              </div>
            )}
            <p className="mt-24 font-arial text-[14px] text-pale-oak">Missing means the keyword or a recognized alias was not found in your resume text. Only include skills you actually have. This check covers a curated set of software skills and counts each once.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function KeywordList({ title, keywords, empty }: { title: string; keywords: string[]; empty: string }) {
  return (
    <div>
      <h3 className="font-matter text-body font-medium text-platinum">{title} ({keywords.length})</h3>
      {keywords.length ? (
        <ul className="mt-16 flex flex-wrap gap-2">
          {keywords.map((keyword) => <li key={keyword} className="rounded-small border border-graphite px-12 py-2 font-arial text-[14px] text-pale-oak">{keyword}</li>)}
        </ul>
      ) : <p className="mt-16 font-arial text-[14px] text-pale-oak">{empty}</p>}
    </div>
  );
}
