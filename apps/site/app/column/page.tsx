import type { Metadata, Viewport } from "next";
import { ColumnProto } from "./column-proto";
import "./column.css";

export const metadata: Metadata = { title: "Column prototype", robots: { index: false } };
export const viewport: Viewport = { viewportFit: "cover" };

// The templated column (#169): burger plus key buttons on every layout, a liquid "…" menu, the sidebar under a
// sliding page card, and an interactive checkout. A prototype to align on before it moves into duet-ui.
// Live but unlisted (noindex), to try on a real Duo.
export default function Page() {
  return <ColumnProto />;
}
