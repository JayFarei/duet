import type { Metadata } from "next";
import { PanesDemo } from "./panes-demo";

export const metadata: Metadata = { title: "Panes" };

// A path of screens (mailboxes, inbox, message, attachment) on <DuetPanes>: one pane folded, two unfolded.
export default function Page() {
  return <PanesDemo />;
}
