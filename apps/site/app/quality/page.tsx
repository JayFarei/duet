import { notFound } from "next/navigation";
import { QualityFixture } from "./fixture";
export default async function Page({ searchParams }: { searchParams: Promise<{ document?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  return <QualityFixture documentScroll={"document" in query} />;
}
