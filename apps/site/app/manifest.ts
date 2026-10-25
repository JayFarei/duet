import type { MetadataRoute } from "next";

// Saved to the Home Screen the site opens standalone, where Duet takes iOS's strip.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Duet",
    short_name: "Duet",
    description: "Native controls for React web apps on the iPhone Duo.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
