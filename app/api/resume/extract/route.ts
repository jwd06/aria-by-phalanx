import { runAtsReport } from "@/lib/ats/engine";
import type { ATSReport } from "@/lib/ats/types";
import { extractDocx } from "@/lib/resume/extractDocx";
import { extractPdf } from "@/lib/resume/extractPdf";
import { ResumeParseError } from "@/lib/resume/errors";
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_LABEL,
  MAX_UPLOAD_BYTES,
  resolveResumeKind,
  sniffResumeKind,
} from "@/lib/resume/fileTypes";

// pdf.js needs Node APIs — it cannot run on the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

// Deliberately public, and note the project currently has no auth and no database
// at all. That's fine here only because this endpoint persists nothing — the
// extracted text is returned to the caller and never stored, so the product's "no
// guest mode" rule (which exists to protect persisted user data) doesn't bite yet.
// The first feature that writes a resume, session, or progress row needs auth
// landed first. Also still unthrottled: add a rate limit before this is publicly
// reachable.

export async function POST(request: Request) {
  try {
    // Cheap early-out before `formData()` buffers the whole body into memory. The
    // header is client-supplied, so the check against the parsed file below is
    // still the authoritative one.
    const declaredLength = Number(request.headers.get("content-length"));

    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: `Resume must be smaller than ${MAX_RESUME_LABEL}` },
        { status: 413 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Resume file is required" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return Response.json({ error: "That file is empty" }, { status: 400 });
    }

    if (file.size > MAX_RESUME_BYTES) {
      return Response.json(
        { error: `Resume must be smaller than ${MAX_RESUME_LABEL}` },
        { status: 413 }
      );
    }

    const declaredKind = resolveResumeKind(file);

    if (!declaredKind) {
      return Response.json(
        { error: "Only PDF and DOCX files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // Bytes win over the client-supplied name/MIME, so a mislabelled file is read
    // correctly instead of being handed to the wrong parser.
    const kind = sniffResumeKind(buffer) ?? declaredKind;

    let raw: string;

    try {
      raw = kind === "pdf" ? await extractPdf(buffer) : await extractDocx(buffer);
    } catch (error) {
      // The file is the problem, not the server.
      if (error instanceof ResumeParseError) {
        console.error(error);

        return Response.json({ error: error.message }, { status: 422 });
      }

      throw error;
    }

    const text = raw.replace(/\n{3,}/g, "\n\n").trim();

    // A scanned/image-only PDF extracts to nothing and would otherwise look
    // like a successful upload.
    if (!text) {
      return Response.json(
        {
          error:
            "No text could be read from that file. If it's a scanned or image-only PDF, export a text-based version and try again.",
        },
        { status: 422 }
      );
    }

    // Absent means true, which runs the stricter rule set (an Experience
    // section is expected and worth points). A stale client or a direct `curl`
    // therefore gets the conservative score rather than a quietly inflated one.
    const hasExperience = formData.get("hasExperience") !== "no";

    let report: ATSReport | undefined;

    try {
      report = runAtsReport({ text, hasExperience, sourceKind: kind });
    } catch (error) {
      // Extraction already succeeded and is useful on its own. A bug in the
      // scoring rules must never turn a working upload into a failed request.
      console.error(error);
    }

    return Response.json({
      text,
      filename: file.name,
      characters: text.length,
      report,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to extract resume" },
      { status: 500 }
    );
  }
}
