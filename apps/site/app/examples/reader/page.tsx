import type { Metadata } from "next";
import { Block } from "../block";
import { hasLoop, source } from "../source";
import { ReaderApp } from "./app";

export const metadata: Metadata = { title: "Reader", description: "A library and a book as two panes, the Pane bar, and a Primary that runs at once." };

export default function Page() {
  return <Block name="reader" title="Reader" code={source("reader")} loop={hasLoop("reader")} app={<ReaderApp />}
    intro="A library and the open book as two panes: one at a time closed, side by side open. The book's Pane bar closes it, and where two panes fit, takes it full screen. Next book is the Primary with no confirm box: one tap runs it." />;
}
