import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mockup } from "./mockup";

export const metadata: Metadata = { title: "Mockup" };

// The open Duo in split view, for trying Duet's split-view behaviour on a desktop browser.
//   /mockup                       open Duo, split view, Duet running in the Safari pane
//   /mockup?pane=left             Safari in the left pane
//   /mockup?src=/lab?tabs=3       what runs in the Safari pane
// Dev only, like the lab it frames.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  return (
    <Mockup
      pane={q.pane === "left" ? "left" : "right"}
      src={q.src ?? "/lab?tabs=4,searchTab=1,back=1,actions=2,title=1,feed=1"}
      caption={q.caption}
      dark={q.dark === "1"}
    />
  );
}
