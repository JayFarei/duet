import type { Metadata, Viewport } from "next";
import "./site.css";

export const metadata: Metadata = {
  title: { default: "Duet", template: "%s · Duet" },
  description: "Native-feeling controls for React web apps on the foldable iPhone.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
