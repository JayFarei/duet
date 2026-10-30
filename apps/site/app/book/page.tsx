import type { Metadata } from "next";
import { BookDemo } from "./book-demo";

export const metadata: Metadata = { title: "Call to action" };

// A per-page call to action: the class page passes a primary (Book, confirmed in a box it grows into) and folds its other
// actions into "…"; booking changes the label, icon and tint at runtime, and the controls reshape on a spring (#101).
export default function Page() {
  return <BookDemo />;
}
