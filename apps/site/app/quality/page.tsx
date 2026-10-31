import { notFound } from "next/navigation";
import { QualityFixture } from "./fixture";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <QualityFixture />;
}
