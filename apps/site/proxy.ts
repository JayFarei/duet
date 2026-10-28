import { NextResponse, type NextRequest } from "next/server";

// e2e only (tools/e2e): a page opened with ?slowjs=<ms> gets its JS chunks that much later, so the server-rendered
// page paints and stays unhydrated as on a slow network (#143: the in-app preview's first frames). Scripts only: a held
// stylesheet would hold the first paint too. The matcher only runs this for chunk requests whose Referer carries
// slowjs, so every other request skips it.
export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.endsWith(".js")) return NextResponse.next();
  const ms = Number(new URL(req.headers.get("referer") ?? "", req.url).searchParams.get("slowjs"));
  if (ms > 0) await new Promise((ok) => setTimeout(ok, Math.min(ms, 5000)));
  return NextResponse.next();
}

export const config = {
  matcher: [{ source: "/_next/static/chunks/:path*", has: [{ type: "header", key: "referer", value: ".*[?&]slowjs=\\d+.*" }] }],
};
