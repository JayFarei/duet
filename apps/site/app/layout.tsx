import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./site.css";
import { bootScript } from "duet-ui/boot";
import { E2EReporter } from "./e2e-reporter";
import { e2eEarly } from "./e2e-early";

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
    <html lang="en" className={serif.variable} suppressHydrationWarning>
      {/* The visitor's light/dark pick (theme.ts), on <html> before first paint. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("duet-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-lg-theme",t)}catch(e){}` }} />
        <script dangerouslySetInnerHTML={{ __html: e2eEarly }} />
      </head>
      {/* Duet's pre-paint boot (README, Pre-paint boot), first in <body>; Vercel Web Analytics and Speed Insights last. */}
      <body><script dangerouslySetInnerHTML={{ __html: bootScript }} />{children}<E2EReporter /><Analytics /><SpeedInsights /></body>
    </html>
  );
}
