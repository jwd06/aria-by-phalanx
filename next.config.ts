import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse isn't on Next's auto-externalized list. Externalizing it leaves its
  // transitive pdfjs-dist require resolving at runtime, which the worker's dynamic
  // requires need — they don't survive server bundling.
  serverExternalPackages: ["pdf-parse"],

  // Externalizing fixes module *resolution*; it does nothing about file
  // *inclusion*. nft can't follow pdf.js's `await import(workerSrc)` (a runtime
  // variable behind `webpackIgnore`), its `fs.readFile(baseUrl + name)` asset
  // loads, or the `createRequire` it uses to reach @napi-rs/canvas, so it ships
  // none of them and the route 500s on Vercel while working locally off the
  // real node_modules. Naming them here is what puts them in the lambda, and
  // `scripts/assert-pdf-trace.mjs` fails the build if they fall back out.
  outputFileTracingIncludes: {
    "/api/resume/extract": [
      // Read by Node's ESM resolver for the bare `pdfjs-dist/legacy/build/pdf.mjs`
      // specifier, and by `pdfjsAssets()` to locate the install on disk.
      "node_modules/pdfjs-dist/package.json",
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      // These three sit at the package root, not under legacy/build.
      "node_modules/pdfjs-dist/standard_fonts/**",
      "node_modules/pdfjs-dist/cmaps/**",
      "node_modules/pdfjs-dist/wasm/**",
      // Not optional, despite pdf.js only warning when it is absent: pdf.mjs
      // evaluates `new DOMMatrix()` at module scope (line ~15620) and canvas is
      // where that global comes from in Node, so without it the whole external
      // module fails to import on the first request. The wildcard picks up
      // whichever `canvas-<platform>` binary the deploy installed.
      "node_modules/@napi-rs/canvas/**",
      "node_modules/@napi-rs/canvas-*/**",
    ],
  },
};

export default nextConfig;
