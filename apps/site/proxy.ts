import { NextResponse, type NextRequest } from "next/server";

const PLAIN = /^\/examples\/(inbox|checkout|reader|inspector)\/?$/;
const PLAIN_HEADER = "x-duet-plain"; // next.config.ts rewrites on it

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // An example's bare app keeps its public URL, /examples/<name>?plain, but is its own route (app/plain), so the
  // server sends the app alone and the device stage's screens never paint the example page first. A `has` query
  // condition in next.config does not match the empty value `?plain` carries, so this marks the request with a
  // header and next.config's rewrite (which does match a header) takes it to the route. Not NextResponse.rewrite:
  // its URL must be absolute, and behind a TLS-terminating proxy (tailscale serve) its origin (https://localhost)
  // differs from the server's own (http://127.0.0.1), so Next fetched it from itself over TLS on a plain port (#279).
  if (PLAIN.test(pathname)) {
    const headers = new Headers(req.headers);
    if (searchParams.has("plain")) headers.set(PLAIN_HEADER, "1");
    else headers.delete(PLAIN_HEADER);
    return NextResponse.next({ request: { headers } });
  }
  // e2e only (tools/e2e): a page opened with ?slowjs=<ms> gets its JS chunks that much later, so the server-rendered
  // page paints and stays unhydrated as on a slow network (#143: the in-app preview's first frames). Scripts only: a
  // held stylesheet would hold the first paint too. The matcher only runs this for chunk requests whose Referer
  // carries slowjs, so every other request skips it.
  if (!pathname.endsWith(".js")) return NextResponse.next();
  const ms = Number(new URL(req.headers.get("referer") ?? "", req.url).searchParams.get("slowjs"));
  if (ms > 0) await new Promise((ok) => setTimeout(ok, Math.min(ms, 5000)));
  return NextResponse.next();
}

export const config = {
  matcher: [
    { source: "/_next/static/chunks/:path*", has: [{ type: "header", key: "referer", value: ".*[?&]slowjs=\\d+.*" }] },
    "/examples/:name(inbox|checkout|reader|inspector)",
  ],
};
