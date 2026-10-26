import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScrollLab } from "./scroll-lab";

export const metadata: Metadata = { title: "Scroll lab" };

// A page shaped like a real site that mounts <Duet> with no children (RegTail): the document scrolls, a chip row
// scrolls sideways, and the tabs jump to sections with smooth scrollIntoView. Reproduces document-scroll bugs. Dev only.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ScrollLab />;
}
