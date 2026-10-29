import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import path from "node:path";
import { enabled, reportsRoot } from "./reports";
import { Workbench, type Data } from "./workbench";

// The system journeys workbench (dev only): every placement a Safari window can land in on the Duo, drawn on the
// web Duo, with what the e2e harness saw there. tools/e2e/workbench.py writes the data after each run.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workbench" };

export default function Page() {
  if (!enabled()) notFound();
  const root = reportsRoot();
  let data: Data;
  try {
    data = JSON.parse(readFileSync(path.join(root, "workbench.json"), "utf8"));
  } catch {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 16px", lineHeight: 1.5 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 40, margin: 0 }}>Workbench</h1>
        <p>No <code>workbench.json</code> in <code>{root}</code> yet. Run the matrix, or build it from the reports there:</p>
        <pre style={{ background: "var(--code)", padding: 12, borderRadius: 10, overflowX: "auto" }}>python3 -I tools/e2e/workbench.py</pre>
      </main>
    );
  }
  return <Workbench data={data} />;
}
