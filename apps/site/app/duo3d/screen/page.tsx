import { notFound } from "next/navigation";
import { Screen } from "../screen";

// One display of the 3D device: duo frames this page on its inner and outer panels (`?display=`). Dev only.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Screen />;
}
