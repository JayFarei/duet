import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ColumnProto } from "./column-proto";
import "./column.css";

export const metadata: Metadata = { title: "Column prototype" };
export const viewport: Viewport = { viewportFit: "cover" };

// The templated column (#169): burger plus key buttons on every layout, a liquid "…" menu, the sidebar under a
// sliding page card, and an interactive checkout. A prototype to align on before it moves into duet-ui. Dev only.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ColumnProto />;
}
