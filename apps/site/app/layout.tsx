import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import "./site.css";

// Headings only: a high-contrast serif against the system sans of the text.
const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--serif" });

export const metadata: Metadata = {
  title: { default: "Duet", template: "%s · Duet" },
  description: "A React library that approximates the native vertical controls of the iPhone Duo on the web.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Duet", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable}>
      <body>{children}</body>
    </html>
  );
}
