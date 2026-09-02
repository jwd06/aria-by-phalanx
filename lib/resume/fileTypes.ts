export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** `accept` value for the upload input. */
export const ACCEPT = `${PDF_MIME},${DOCX_MIME},.pdf,.docx`;

/** 4MB — under Vercel's ~4.5MB request ceiling, far above any real resume. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

export const MAX_RESUME_LABEL = "4MB";

export type ResumeKind = "pdf" | "docx";

/**
 * Browsers routinely send DOCX as `application/octet-stream` or an empty
 * string, so the extension is a necessary fallback — matching on MIME alone
 * rejects legitimate uploads.
 */
export function resolveResumeKind(file: {
  type: string;
  name: string;
}): ResumeKind | null {
  if (file.type === PDF_MIME) return "pdf";
  if (file.type === DOCX_MIME) return "docx";

  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";

  return null;
}

/**
 * Ceiling for the raw request body, with slack for multipart boundary and header
 * overhead. Only used for the cheap `Content-Length` early-out before the body is
 * buffered — `MAX_RESUME_BYTES` against the parsed file stays authoritative, since
 * a client controls the header it sends.
 */
export const MAX_UPLOAD_BYTES = MAX_RESUME_BYTES + 8 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 — DOCX is a zip archive

function startsWith(buffer: Buffer, magic: number[]) {
  if (buffer.length < magic.length) return false;

  return magic.every((byte, index) => buffer[index] === byte);
}

/**
 * Identifies the format from the bytes rather than the client-supplied name and
 * MIME type. Used to *choose* the parser, never to reject: an unrecognised header
 * falls back to `resolveResumeKind` and fails in the parser with a clear message,
 * so a slightly unusual file is never turned away for the wrong reason.
 */
export function sniffResumeKind(buffer: Buffer): ResumeKind | null {
  if (startsWith(buffer, PDF_MAGIC)) return "pdf";
  if (startsWith(buffer, ZIP_MAGIC)) return "docx";

  return null;
}
