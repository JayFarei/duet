import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Duo3D } from "./duo3d";

export const metadata: Metadata = { title: "Duo 3D (local)" };

// The web Duo's controls driving doan-labs/duo's 3D device, which needs Apple's model and so runs only on this
// machine (tools/duo3d/setup.sh). Dev only: the model is never shipped.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Duo3D />;
}
