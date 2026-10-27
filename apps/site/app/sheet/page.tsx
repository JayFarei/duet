import type { Metadata } from "next";
import { SheetDemo } from "./sheet-demo";

export const metadata: Metadata = { title: "Sheets" };

// A modal sheet over a full-screen position: fixed scrim, the usual web pattern. While it is open the page passes
// `close` to <Duet>: in Safari's column the controls' X closes it and the sheet's own X steps aside (#79).
export default function Page() {
  return <SheetDemo />;
}
