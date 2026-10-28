import type { Metadata } from "next";
import summary from "../../public/e2e/summary.json";
import { Testing, type Summary } from "./testing";

export const metadata: Metadata = { title: "How Duet is tested" };

// Every number, film and verdict on this page comes from one e2e matrix run, snapshotted into public/e2e by
// scripts/e2e-snapshot.mjs. Regenerate it from a newer run; the page has no numbers of its own.
export default function Page() {
  return <Testing data={summary as unknown as Summary} />;
}
