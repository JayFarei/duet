import type { Metadata, Viewport } from "next";
import { Qa } from "./qa";

export const metadata: Metadata = { title: "Duet QA", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#edf0f5", viewportFit: "cover" };

// Manual QA on a real Duo: one scenario per menu fix, with a tap counter that shows whether a tap reached the page.
export default function Page() {
  return <Qa />;
}
