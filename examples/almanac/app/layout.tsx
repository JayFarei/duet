import type { Metadata, Viewport } from "next";
import "./almanac.css";

export const metadata: Metadata = {
  title: "Almanac",
  description: "A calm long-form reader. A Duet example for the foldable iPhone.",
  appleWebApp: { capable: true, title: "Almanac", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.png", sizes: "64x64" }, { url: "/icon-512.png", sizes: "512x512" }], apple: { url: "/apple-touch-icon.png", sizes: "180x180" } },
};
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
