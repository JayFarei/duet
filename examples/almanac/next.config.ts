import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets a phone on the tailnet load the dev server (set DUET_DEV_ORIGIN to your machine's name).
  allowedDevOrigins: process.env.DUET_DEV_ORIGIN ? [process.env.DUET_DEV_ORIGIN] : [],
  devIndicators: false, // the badge would sit on the control strip in captures
};

export default config;
