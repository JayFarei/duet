import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InspectorLab } from "./inspector-lab";

export const metadata: Metadata = { title: "Inspector Lab" };

// Six cards on useInspector + DuetInspector (a pane beside the overview where two fit, full screen where not) and a
// DuetViewerGroup of three figures. e2e/inspector.spec.ts drives it at /lab/inspector?plain. Dev only.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InspectorLab />;
}
