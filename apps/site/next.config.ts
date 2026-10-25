import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets a phone on the tailnet (or DUET_DEV_ORIGIN) load the dev server: without it Next blocks its dev scripts
  // there and the page never hydrates.
  allowedDevOrigins: ["**.ts.net", ...(process.env.DUET_DEV_ORIGIN ? [process.env.DUET_DEV_ORIGIN] : [])],
  devIndicators: false, // the badge would sit on the control strip in captures
};

export default config;
