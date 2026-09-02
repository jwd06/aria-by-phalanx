import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse isn't on Next's auto-externalized list. Externalizing it leaves its
  // transitive pdfjs-dist require resolving at runtime, which the worker's dynamic
  // requires need — they don't survive server bundling.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
