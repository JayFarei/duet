import { Home } from "./home";

const SUMMARY = "https://opentraces-metrics.fareiunastrage.workers.dev/v1/projects/duet/summary";

/** npm downloads over the last 30 days, or null when the worker can't say: the hero then shows the version alone. */
async function downloads(): Promise<number | null> {
  try {
    const res = await fetch(SUMMARY, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const value = (await res.json())?.sources?.npm?.metrics?.recent_last_month?.value;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export default async function Page() {
  return <Home downloads={await downloads()} />;
}
