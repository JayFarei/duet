import type { Metadata, Viewport } from "next";
import { Probe } from "./probe";

export const metadata: Metadata = { title: "Probe", robots: { index: false } };
export const viewport: Viewport = { viewportFit: "cover" };

// Live readout of what Duet sees on a real device: mode, the in-app preview verdict and the geometry behind it, with
// a log of every change. Mounts <Duet> with no children, like RegTail, so the document scrolls. Open it from
// Messages to get the in-app Safari preview.
export default function Page() {
  return <Probe />;
}
