import type { Metadata } from "next";
import { Duo } from "./duo";

export const metadata: Metadata = { title: "Simulator" };

// The full web Duo: every posture and app, the fold scrubber, slow motion and the slot call-out. The 3D Duo instead
// where it runs beside this site (duo.tsx).
export default function Page() {
  return <Duo src="/examples/inbox?plain" title="Duet simulator" intro="The Inbox example on a web iPhone Duo. Fold it, turn it, split it, and watch Duet pick its place." />;
}
