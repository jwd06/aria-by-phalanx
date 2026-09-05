/**
 * Fails the build when pdf.js's runtime files are missing from the deployed
 * function.
 *
 * Vercel ships only what `route.js.nft.json` lists. pdf.js loads its worker
 * through `await import(workerSrc)`, its fonts/cmaps/wasm through `fs.readFile`,
 * and @napi-rs/canvas through `createRequire`, none of which @vercel/nft can follow, so they land in the
 * bundle only because `outputFileTracingIncludes` in next.config.ts names them.
 * That is easy to break by accident — a dependency bump, a moved directory, a
 * renamed route — and the symptom is a 500 in production while every local run
 * still works off the real node_modules. This turns that into a build failure.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TRACE = ".next/server/app/api/resume/extract/route.js.nft.json";

/** Substrings, because a glob include expands to many concrete paths. */
const REQUIRED = [
  "pdfjs-dist/package.json",
  "pdfjs-dist/legacy/build/pdf.mjs",
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  "pdfjs-dist/standard_fonts/",
  "pdfjs-dist/cmaps/",
  "pdfjs-dist/wasm/",
  // pdf.mjs does `new DOMMatrix()` at module scope, and canvas is where that
  // global comes from in Node - without it the external module never imports.
  "@napi-rs/canvas/",
  // Whichever `canvas-<platform>` binary this deploy installed.
  "@napi-rs/canvas-",
];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!existsSync(TRACE)) {
  fail(
    `No trace at ${TRACE}.\n` +
      "  Either the build did not run, or /api/resume/extract no longer emits a\n" +
      "  server trace — in which case the include key in next.config.ts is stale."
  );
}

const base = dirname(TRACE);

// Trace entries are relative to the .nft.json itself.
const traced = JSON.parse(readFileSync(TRACE, "utf8")).files.map((file) => ({
  entry: file,
  absolute: resolve(base, file),
}));

const missing = [];

for (const needle of REQUIRED) {
  // Listed in the trace AND actually on disk — a stale entry pointing at a file
  // that no longer exists would ship just as broken.
  const hit = traced.find(
    ({ entry, absolute }) => entry.includes(needle) && existsSync(absolute)
  );

  if (!hit) missing.push(needle);
}

if (missing.length > 0) {
  fail(
    `${missing.length} pdf.js runtime file(s) missing from ${TRACE}:\n` +
      missing.map((name) => `    ${name}`).join("\n") +
      "\n\n  PDF upload would 500 on Vercel with \"Failed to extract resume\"\n" +
      "  while still working locally. Check `outputFileTracingIncludes` in\n" +
      "  next.config.ts against the current pdfjs-dist layout."
  );
}

console.log(
  `✓ pdf.js runtime files traced into /api/resume/extract ` +
    `(${traced.filter(({ entry }) => entry.includes("pdfjs-dist")).length} pdfjs-dist files)`
);
