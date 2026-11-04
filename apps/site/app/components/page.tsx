import type { Metadata } from "next";
import { clips } from "../clip";
import { Components } from "./components";

export const metadata: Metadata = { title: "Components", description: "Every control Duet draws: Group, Navigation, More, Actions, Primary, Close and the Pane bar, with their variants and props." };

const CLIPS = ["group", "navigation-tabs", "navigation-tabs-more", "navigation-sidebar", "more", "actions", "primary-confirm", "primary-direct", "primary-folded", "close", "pane-bar"];

export default function Page() {
  return <Components clips={clips(CLIPS)} />;
}
