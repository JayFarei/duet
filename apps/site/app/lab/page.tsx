import type { Metadata, Viewport } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Duet Lab",
  manifest: "/lab.webmanifest",
  appleWebApp: { capable: true, title: "Duet Lab", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#edf0f5", viewportFit: "cover" };

// Every control combination from query keys (?tabs=4&back=1&actions=2...), so captures and tests can
// target one layout. Installed to the Home Screen, it follows /api/lab-scenario instead.
export default function Page() {
  return <Lab />;
}
