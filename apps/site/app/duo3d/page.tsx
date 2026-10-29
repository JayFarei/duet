import type { Metadata } from "next";
import { Duo3D } from "./duo3d";

export const metadata: Metadata = { title: "Duo 3D" };

// The web Duo's controls driving doan-labs/duo's 3D device, built into public/duo3d/app by tools/duo3d/build.sh.
export default function Page() {
  return <Duo3D />;
}
