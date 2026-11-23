"use client";

import { Duo } from "../../duo/duo";
import { useDesktop } from "../../duo/web-duo";
import { InspectorApp } from "../../examples/inspector/app";

// The inspector example's app (app/examples/inspector) on the dev-only lab route the e2e tools drive.
export function InspectorLab() {
  const desktop = useDesktop();
  return desktop ? <Duo src="/lab/inspector" /> : <div className={desktop === null ? "ssr-site" : undefined}><InspectorApp /></div>;
}
