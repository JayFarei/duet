import { Home, type InstallStats } from "./home";

const METRICS = "https://opentraces-metrics.fareiunastrage.workers.dev/v1/projects/duet";

async function json(path: string) {
  try {
    const res = await fetch(`${METRICS}/${path}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** npm downloads over the last 30 days with their daily points, or null when the worker can't say: the hero then shows the version alone. */
async function installs(): Promise<InstallStats | null> {
  const [summary, series] = await Promise.all([json("summary"), json("timeseries?source=npm&metric=downloads&window=30d")]);
  const total = summary?.sources?.npm?.metrics?.recent_last_month?.value;
  if (!Number.isFinite(total) || total <= 0) return null;
  const points = series?.series?.find((s: { metric: string }) => s.metric === "downloads")?.points ?? [];
  return { total, daily: points.map((p: { value: number }) => p.value) };
}

export default async function Page() {
  return <Home installs={await installs()} />;
}
