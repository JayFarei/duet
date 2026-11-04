import type { Metadata } from "next";
import { Duo3DPage } from "./duo3d";

export const metadata: Metadata = { title: "Duo 3D" };

// The web Duo's controls driving doan-labs/duo's 3D device, built into public/duo3d/app by tools/duo3d/build.sh.
// `?clip=<name>` plays one of clips.ts once, for the recorder.
export default function Page() {
  return <Duo3DPage />;
}
