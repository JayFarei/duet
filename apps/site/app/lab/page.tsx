import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Duet Lab",
  manifest: "/lab.webmanifest",
  appleWebApp: { capable: true, title: "Duet Lab", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#edf0f5", viewportFit: "cover" };

// Every control combination from query keys (?menu=4&back=1&actions=2&primary=1...), so captures and tests can
// target one layout. Installed to the Home Screen, it follows /api/lab-scenario instead. Dev only.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab />;
}
