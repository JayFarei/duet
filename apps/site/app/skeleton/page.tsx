import type { Metadata } from "next";
import { SkeletonApp } from "./skeleton-app";

export const metadata: Metadata = { title: "Skeleton" };

// A Duet app with ghost boxes for content: the hero and the web Duo show where content goes and what Duet adds.
export default function Page() {
  return <SkeletonApp />;
}
