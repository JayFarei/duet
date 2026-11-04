import type { NextConfig } from "next";

const config: NextConfig = {
  // The Playwright site suite builds into its own folder (NEXT_DIST_DIR=.next-test), so a test build never swaps the
  // files under a review server running from .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Such a build type-checks without .next's generated route types, which go stale under a running review server
  // when a route is removed (Next adds the build's own folder to this file's include list).
  typescript: { tsconfigPath: process.env.NEXT_DIST_DIR ? "tsconfig.isolated.json" : "tsconfig.json" },
  // Lets a phone on the tailnet (or DUET_DEV_ORIGIN) load the dev server: without it Next blocks its dev scripts
  // there and the page never hydrates.
  allowedDevOrigins: ["**.ts.net", ...(process.env.DUET_DEV_ORIGIN ? [process.env.DUET_DEV_ORIGIN] : [])],
  devIndicators: false, // the badge would sit on the control strip in captures
};

export default config;
