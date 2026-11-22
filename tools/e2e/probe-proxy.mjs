// e2e probe proxy for a consumer app run as a Home Screen web app (tools/e2e, scenario standalone-wealth, sa10+).
// The site has its own reporter and relay; a consumer app has neither, so this proxy puts one origin in front of it:
//   every request goes to the current upstream (a local build serving synthetic fixture data only), uncached;
//   HTML gets <script src="/__duet-e2e/probe.js"> before </head>: a sampler posting the reporter's fields the sa*
//   checks read (standalone proof, column groups, drag leftovers, data-press, mode, side, visual viewport, touches);
//   GET/POST /api/e2e-relay is the same relay as the site's ({beacon, s, path}), plus {upstream, build}: switching the
//   upstream bumps gen and the installed app reloads onto the other build, so one clip and one origin serve both.
// Loopback only: the upstream and the beacon must be localhost. Usage: node probe-proxy.mjs <port> <upstream origin> [build]
import http from "node:http";

const port = Number(process.argv[2] ?? 18460);
const loop = (o) => { try { const u = new URL(o); return /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : null; } catch { return null; } };
let upstream = loop(process.argv[3] ?? "") ?? "http://127.0.0.1:18452";
let relay = { beacon: null, s: null, path: null, build: process.argv[4] ?? null, gen: 1 };

const PROBE = `(() => {
  if (window.top !== window) return;
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  if (!standalone) return;
  const PAGE = Math.random().toString(36).slice(2, 10);
  let beacon = null, s = null, build = null, gen = null, frameAt = 0;
  const taps = [];
  const r1 = (v) => Math.round(v * 10) / 10;
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: r1(b.left), y: r1(b.top), w: r1(b.width), h: r1(b.height) }; };
  const shown = (el) => { const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01; };
  const label = (el) => { const c = typeof el.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""; return el.tagName.toLowerCase() + (c ? "." + c : ""); };
  const buttons = (el) => [...el.querySelectorAll("button")].filter(shown).map((b) => ({ label: b.getAttribute("aria-label") || "", rect: rect(b) }));
  const sample = () => {
    const h = document.documentElement, v = visualViewport;
    return {
      t: Date.now(), page: PAGE, path: location.pathname + location.search, s, build, visible: document.visibilityState, frameAt,
      sig: { innerWidth, innerHeight, outerWidth, outerHeight, angle: (screen.orientation && screen.orientation.angle) || 0 },
      standalone: { navigator: navigator.standalone === true, displayMode: matchMedia("(display-mode: standalone)").matches },
      column: {
        groups: [...document.querySelectorAll(".duet .duet-group")].filter(shown).map((g) => ({ rect: rect(g), buttons: buttons(g), press: g.getAttribute("data-press") })),
        dragLeft: [...document.querySelectorAll("[style*='--duet-drag'], [data-drag]")].map(label),
      },
      html: { mode: h.getAttribute("data-duet-mode") },
      navs: [...document.querySelectorAll("nav.duet")].map((n) => ({ mode: n.getAttribute("data-mode"), side: n.getAttribute("data-side"), hidden: n.getAttribute("data-hidden"), rect: rect(n) })),
      inspector: { level: "closed" },
      scroll: { scrollWidth: h.scrollWidth, clientWidth: h.clientWidth, x: scrollX, y: scrollY },
      vv: v ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height, scale: v.scale } : null,
      taps: taps.slice(),
    };
  };
  const touch = (e) => {
    const p = e.changedTouches ? e.changedTouches[0] : e;
    if (!p) return;
    taps.push({ t: Date.now(), type: e.type, x: Math.round(p.clientX), y: Math.round(p.clientY), target: e.target instanceof Element ? label(e.target) : "" });
    if (taps.length > 8) taps.shift();
  };
  for (const t of ["touchstart", "pointerdown", "click"]) addEventListener(t, touch, { capture: true, passive: true });
  const frame = () => { frameAt = Date.now(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  const poll = async () => {
    try {
      const r = await (await fetch("/api/e2e-relay", { cache: "no-store" })).json();
      if (gen !== null && r.gen !== gen) return location.reload();
      gen = r.gen; build = r.build; s = r.s;
      beacon = r.beacon && /^http:\\/\\/(localhost|127\\.0\\.0\\.1):\\d+$/.test(r.beacon) ? r.beacon : null;
      if (beacon && r.path && r.path !== location.pathname + location.search) return location.replace(r.path);
    } catch {}
    setTimeout(poll, 500);
  };
  poll();
  setInterval(() => { if (beacon) try { fetch(beacon + "/beacon", { method: "POST", body: JSON.stringify(sample()), headers: { "content-type": "text/plain" }, keepalive: true }).catch(() => {}); } catch {} }, 40);
})();`;

const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const json = (res, obj) => { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__duet-e2e/probe.js") {
    res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
    return res.end(PROBE);
  }
  if (u.pathname === "/api/e2e-relay") {
    if (req.method === "POST") {
      let b = {};
      try { b = JSON.parse((await body(req)).toString() || "{}"); } catch { /* empty */ }
      const str = (v) => (typeof v === "string" && v ? v : null);
      const path = str(b.path);
      const up = b.upstream !== undefined ? loop(b.upstream) : null;
      const moved = (up && up !== upstream) || b.reload === true;
      if (up) upstream = up;
      relay = { beacon: str(b.beacon), s: str(b.s), path: path && path.startsWith("/") && !path.startsWith("//") ? path : null,
        build: str(b.build) ?? relay.build, gen: relay.gen + (moved ? 1 : 0) };
    }
    return json(res, { ...relay, upstream });
  }
  const headers = { ...req.headers, host: new URL(upstream).host };
  delete headers["accept-encoding"];
  delete headers["if-none-match"];
  delete headers["if-modified-since"];
  const data = req.method === "GET" || req.method === "HEAD" ? undefined : await body(req);
  const up = http.request(upstream + req.url, { method: req.method, headers }, (r) => {
    const h = { ...r.headers, "cache-control": "no-store" };
    delete h.etag;
    delete h["last-modified"];
    if (!/text\/html/.test(r.headers["content-type"] ?? "")) {
      res.writeHead(r.statusCode ?? 502, h);
      return r.pipe(res);
    }
    const c = [];
    r.on("data", (d) => c.push(d));
    r.on("end", () => {
      const html = Buffer.concat(c).toString().replace(/<\/head>/i, '<script src="/__duet-e2e/probe.js"></script></head>');
      delete h["content-length"];
      res.writeHead(r.statusCode ?? 502, h);
      res.end(html);
    });
  });
  up.on("error", (e) => { res.writeHead(502, { "content-type": "text/plain" }); res.end(`upstream ${upstream}: ${e.message}`); });
  up.end(data);
}).listen(port, "127.0.0.1", () => console.log(`probe proxy on :${port} -> ${upstream}`));
