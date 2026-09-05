import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Absolute, on-disk locations of the pdf.js runtime files.
 *
 * pdf.js reaches for all four through specifiers no bundler can see - the
 * worker via `await import(GlobalWorkerOptions.workerSrc)` behind a
 * `webpackIgnore`, the rest via `fs.readFile(baseUrl + filename)` - so nothing
 * in the build graph records that they are needed. `outputFileTracingIncludes`
 * in next.config.ts is what gets them into the Vercel lambda; this is what
 * points pdf.js at them once they are there.
 */
export interface PdfjsAssets {
  workerSrc: string;
  /** Trailing slash required - pdf.js concatenates, and rejects the value without it. */
  standardFontDataUrl: string;
  cMapUrl: string;
  wasmUrl: string;
}

/** `undefined` = not tried yet, `null` = tried and failed. */
let cached: PdfjsAssets | null | undefined;

/**
 * Node's real `createRequire`, not the bundler's.
 *
 * Importing it from "node:module" is not enough: Turbopack recognises
 * `createRequire` and swaps in its own shim, whose `.resolve()` returns an
 * internal module id (a number) instead of a path. Reaching through
 * `process.getBuiltinModule` is opaque to that analysis - it is the same escape
 * hatch pdf.js uses internally for exactly this reason.
 */
function nodeCreateRequire() {
  return process.getBuiltinModule("module").createRequire;
}

function resolveAssets(): PdfjsAssets | null {
  // `import.meta.url` points into the emitted chunk under .next/server, which
  // still resolves up into node_modules; cwd is the fallback for any build
  // layout where the bundler rewrote it. createRequire wants a *file*, not a
  // directory - it resolves relative to the dirname.
  const bases = [import.meta.url, pathToFileURL(join(process.cwd(), "-")).href];

  const failures: unknown[] = [];

  for (const base of bases) {
    try {
      // pdfjs-dist declares no `exports` field, so this subpath is reachable.
      const root = dirname(
        nodeCreateRequire()(base).resolve("pdfjs-dist/package.json")
      );

      if (typeof root !== "string") throw new Error(`Resolved to ${typeof root}`);

      return {
        workerSrc: join(root, "legacy", "build", "pdf.worker.mjs"),
        // A literal "/" rather than path.sep: pdf.js validates these with
        // `endsWith("/")` and every platform's fs accepts a forward slash.
        standardFontDataUrl: `${join(root, "standard_fonts")}/`,
        cMapUrl: `${join(root, "cmaps")}/`,
        wasmUrl: `${join(root, "wasm")}/`,
      };
    } catch (error) {
      failures.push(error);
    }
  }

  // Deliberately soft. Returning null leaves pdf.js on its own relative
  // defaults, which is exactly the behaviour that shipped before this file -
  // so a failed resolve can never be worse than not having tried.
  console.error("Could not locate pdfjs-dist on disk", failures);

  return null;
}

/** Memoised: resolved once per process, not once per upload. */
export function pdfjsAssets(): PdfjsAssets | null {
  if (cached === undefined) cached = resolveAssets();

  return cached;
}
