// Any web page, framed in the 3D Duo's Safari as if it ran Duet: fetched here, so the page is this origin and the
// displays can emulate Safari's signals into it, with its frame blockers stripped, a <base> so its own links and
// assets resolve upstream, and duet-shell.tsx (Duet with Back, Forward and Reload) added. Local only: the page's
// own scripts run on this origin, so its API calls and history routing may fail, as any page framed this way.
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.ts\.net$)/;

export async function GET(req: Request) {
  // An open proxy anywhere else: never in production.
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let url: URL;
  try { url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`); } catch { return new Response("Bad url", { status: 400 }); }
  if (PRIVATE.test(url.hostname)) return new Response("Private hosts are not proxied", { status: 403 });
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", headers: { "user-agent": req.headers.get("user-agent") ?? "", "accept-language": req.headers.get("accept-language") ?? "en" } });
  } catch (e) { return new Response(`Could not load ${url}: ${(e as Error).message}`, { status: 502 }); }
  // Only the type passes on: the rest is the upstream's own (frame blockers, cookies, its encoding) or, from a Next.js
  // site, its middleware's headers, which Next would act on here.
  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "" });
  if (!(headers.get("content-type") ?? "").includes("text/html")) return new Response(res.body, { status: res.status, headers });

  // The origin is the frame's own, read in the page: behind tailscale serve the request's is localhost.
  const final = res.url || url.href;
  const head = `<base href="${final.replace(/"/g, "&quot;")}">
<script>(() => {
  const o = location.origin, proxy = (u) => o + "/duo3d/web?url=" + encodeURIComponent(u);
  window.__duo3dUrl = ${JSON.stringify(final).replace(/</g, "\\u003c")};
  // Parser-inserted, so it runs even where the site's own hydration then clears <head> of what it did not render.
  document.write('<script src="' + o + '/duo3d-web/duet.js"><\\/script>');
  if (parent !== window) parent.postMessage({ type: "duo3d:url", url: window.__duo3dUrl }, o);
  // Links load through here again, in this frame, as Safari's own tab would.
  addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const u = new URL(a.getAttribute("href"), document.baseURI);
    if (!/^https?:$/.test(u.protocol)) return;
    if (u.href.split("#")[0] === window.__duo3dUrl.split("#")[0] && u.hash) return;
    e.preventDefault();
    location.href = proxy(u.href);
  });
})();</script>`;
  const html = (await res.text())
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/<base[^>]*>/gi, "");
  const at = html.search(/<head[^>]*>/i);
  const out = at < 0 ? head + html : html.replace(/<head[^>]*>/i, (m) => m + head);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(out, { status: res.status, headers });
}
