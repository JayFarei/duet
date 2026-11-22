// e2e relay for a Home Screen web app (tools/e2e, sa*): iOS saves the clip with the manifest's fixed start URL, so the
// installed app never sees ?e2e or ?s, and it has its own storage, apart from Safari's. The driver POSTs
// {beacon, s, path}; the reporter of a standalone page polls GET, reports to that beacon under that run token and goes
// to that path. Dev only, like the lab pages it serves.
type Relay = { beacon: string | null; s: string | null; path: string | null };
let current: Relay = { beacon: null, s: null, path: null };

const dev = process.env.NODE_ENV !== "production";

export async function GET() {
  if (!dev) return new Response(null, { status: 404 });
  return Response.json(current, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!dev) return new Response(null, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  // Same-origin paths only: the relay moves the installed app within the site, never off it.
  const path = str(b.path);
  current = { beacon: str(b.beacon), s: str(b.s), path: path && path.startsWith("/") && !path.startsWith("//") ? path : null };
  return Response.json(current);
}
