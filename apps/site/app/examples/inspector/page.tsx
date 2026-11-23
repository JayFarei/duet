import type { Metadata } from "next";
import { Block } from "../block";
import { loops, source } from "../source";

export const metadata: Metadata = { title: "Inspector", description: "Cards that open in an inspector beside the overview, and figures in a viewer group: DuetInspector, useInspector, DuetViewer." };

export default function Page() {
  return <Block name="inspector" title="Inspector" code={source("inspector")} loops={loops()}
    intro={<>Six cards and three figures. <code>inspectable</code> and <code>DuetInspectButton</code> open a card through <code>useInspector</code>; <code>DuetInspector</code> shows it in a pane beside the month where two fit, full screen where not, and Duet&apos;s controls become the card&apos;s commands. The figures are <code>DuetViewer</code>s in a <code>DuetViewerGroup</code>: open one and step through the rest. Off a Duo the same commands stand in a <code>DuetControlColumn</code> on the window&apos;s edge. <code>paneGlyph</code> draws the Household icon.</>} />;
}
