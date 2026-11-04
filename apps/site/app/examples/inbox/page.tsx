import type { Metadata } from "next";
import { Block } from "../block";
import { loops, source } from "../source";
import { InboxApp } from "./app";

export const metadata: Metadata = { title: "Inbox", description: "Nine folders as Navigation in all three fits, Compose, Archive and Flag as Actions, and Close over a message." };

export default function Page() {
  return <Block name="inbox" title="Inbox" code={source("inbox")} loops={loops()} app={<InboxApp />}
    intro="Nine folders as Navigation: tabs where they all fit, Tabs + More where some do, the Sidebar where fewer than three would. Compose, Archive and Flag are Actions, Delete waits in More. Open a message and the controls become Close." />;
}
