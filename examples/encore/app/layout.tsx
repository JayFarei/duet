import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encore",
  description: "A music player built with Duet: native-feeling Liquid Glass controls beside the page on the foldable iPhone.",
  applicationName: "Encore",
  appleWebApp: { capable: true, title: "Encore", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.png", sizes: "64x64" }, { url: "/icon-512.png", sizes: "512x512" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
