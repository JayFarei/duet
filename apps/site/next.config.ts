import type { NextConfig } from "next";

const config: NextConfig = {
  // The Playwright site suite builds into its own folder (NEXT_DIST_DIR=.next-test), so a test build never swaps the
  // files under a review server running from .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lets a phone on the tailnet (or DUET_DEV_ORIGIN) load the dev server: without it Next blocks its dev scripts
  // there and the page never hydrates.
  allowedDevOrigins: ["**.ts.net", ...(process.env.DUET_DEV_ORIGIN ? [process.env.DUET_DEV_ORIGIN] : [])],
  devIndicators: false, // the badge would sit on the control strip in captures
};

export default config;
