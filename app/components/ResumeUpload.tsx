"use client";

import { useRef, useState } from "react";
import {
  ACCEPT,
  MAX_RESUME_BYTES,
  MAX_RESUME_LABEL,
  resolveResumeKind,
} from "@/lib/resume/fileTypes";

type Status = "idle" | "extracting" | "done" | "error";

interface Extracted {
  text: string;
  filename: string;
  characters: number;
}

// Above the route's own 30s `maxDuration`, so the server's limit normally wins and
// this only catches a genuinely stuck connection.
const REQUEST_TIMEOUT_MS = 45_000;

/** A platform-level 413/504 returns HTML or plain text, not our JSON envelope. */
async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function errorFrom(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;

  const { error } = data as { error?: unknown };

  return typeof error === "string" && error ? error : null;
}

function extractedFrom(data: unknown): Extracted | null {
  if (typeof data !== "object" || data === null) return null;

  const { text, filename, characters } = data as Record<string, unknown>;

  if (typeof text !== "string") return null;
  if (typeof filename !== "string") return null;
  if (typeof characters !== "number") return null;

  return { text, filename, characters };
}

export default function ResumeUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  // A ref, not `status` — `handleFile` closes over the state from the render it
  // was created in, which is too stale to gate a second upload against.
  const inFlightRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extracted | null>(null);
  const [dragging, setDragging] = useState(false);

  const extracting = status === "extracting";

  function reset() {
    setStatus("idle");
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  async function handleFile(file: File) {
    // Two overlapping uploads would race, and the loser could paint its text
    // under the winner's filename.
    if (inFlightRef.current) return;

    setError(null);
    setResult(null);

    // Pre-checks so obvious rejects never round-trip.
    if (!resolveResumeKind(file)) {
      fail("Only PDF and DOCX files are supported");
      return;
    }

    if (file.size > MAX_RESUME_BYTES) {
      fail(`Resume must be smaller than ${MAX_RESUME_LABEL}`);
      return;
    }

    inFlightRef.current = true;
    setStatus("extracting");

    try {
      const body = new FormData();
      body.append("resume", file);

      const response = await fetch("/api/resume/extract", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const data = await readJson(response);

      if (!response.ok) {
        fail(
          errorFrom(data) ??
            (response.status === 413
              ? `Resume must be smaller than ${MAX_RESUME_LABEL}`
              : "Failed to extract resume")
        );
        return;
      }

      const extracted = extractedFrom(data);

      if (!extracted) {
        fail("Got an unexpected response from the server. Try again.");
        return;
      }

      setResult(extracted);
      setStatus("done");
    } catch (caught) {
      fail(
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? "That took too long to read. Try again, or try a smaller file."
          : "Something went wrong uploading that file. Try again."
      );
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`rounded-card border border-dashed p-48 text-center transition-colors ${
          dragging
            ? "border-berry-lipstick bg-berry-lipstick/5"
            : "border-graphite bg-pitch-black/60"
        }`}
      >
        {/* A <label> can't be disabled, but pointing it at a disabled input makes
            it inert — the styling below just makes that visible. */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={extracting}
          className="sr-only"
          id="resume-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <p className="font-matter text-subheading font-medium text-platinum">
          Drop your resume here
        </p>
        <p className="mt-12 font-arial text-[14px] text-pale-oak">
          PDF or DOCX, up to {MAX_RESUME_LABEL}
        </p>

        <label
          htmlFor="resume-file"
          aria-disabled={extracting}
          className={`mt-32 inline-block rounded-button bg-berry-lipstick px-32 py-16 font-arial text-[14px] text-platinum transition-colors ${
            extracting
              ? "pointer-events-none cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-[#b32a56]"
          }`}
        >
          {extracting ? "Reading…" : "Choose a file"}
        </label>
      </div>

      {status === "error" && error ? (
        <p className="font-arial text-[14px] text-berry-lipstick">{error}</p>
      ) : null}

      {status === "done" && result ? (
        <div className="rounded-card border border-graphite bg-pitch-black/60 p-32">
          <div className="flex flex-wrap items-baseline justify-between gap-16">
            <div>
              <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-pale-oak/60">
                Extracted text
              </span>
              <p className="mt-12 font-matter text-subheading font-medium text-platinum">
                {result.filename}
              </p>
              <p className="mt-12 font-arial text-[14px] text-pale-oak">
                {result.characters.toLocaleString()} characters
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-button border border-pale-oak/30 px-20 py-12 font-arial text-[14px] text-platinum transition-colors hover:border-pale-oak/60"
            >
              Choose a different file
            </button>
          </div>

          <pre className="mt-24 max-h-[420px] overflow-y-auto whitespace-pre-wrap border-t border-graphite pt-24 font-arial text-[14px] leading-[1.43] text-pale-oak">
            {result.text}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
