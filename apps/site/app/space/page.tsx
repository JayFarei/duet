import type { Metadata } from "next";
import { Space } from "./space";

export const metadata: Metadata = { title: "Space" };

// One web Duo scene, still and unscaled, for the space map oracle (e2e/site/space.spec.ts): ?s= a State as JSON.
export default function Page() {
  return <Space />;
}
