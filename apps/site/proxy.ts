import { NextResponse, type NextRequest } from "next/server";

const PLAIN = /^\/examples\/(inbox|checkout|reader|inspector)\/?$/;

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // An example's bare app keeps its public URL, /examples/<name>?plain, but is its own route (app/plain), so the
  // server sends the app alone and the device stage's screens never paint the example page first. Here, not a
  // next.config rewrite: a `has` query condition does not match the empty value `?plain` carries.
  const plain = PLAIN.exec(pathname);
  if (plain) return searchParams.has("plain") ? NextResponse.rewrite(new URL(`/plain/${plain[1]}${req.nextUrl.search}`, req.url)) : NextResponse.next();
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
