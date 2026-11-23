import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InspectorLab } from "./inspector-lab";

export const metadata: Metadata = { title: "Inspector Lab", robots: { index: false } };

// The inspector example (app/examples/inspector) on its own route: e2e/inspector.spec.ts and tools/e2e drive it at
// /lab/inspector?plain. Dev only; in production the route sends a visitor to the example page.
export default function Page() {
  if (process.env.NODE_ENV === "production") redirect("/examples/inspector");
  return <InspectorLab />;
}
