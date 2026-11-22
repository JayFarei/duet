// e2e probe proxy for a consumer app run as a Home Screen web app (tools/e2e, scenario standalone-wealth, sa10+).
// The site has its own reporter and relay; a consumer app has neither, so this proxy puts one origin in front of it:
//   every request goes to the current upstream (a local build serving synthetic fixture data only), uncached;
//   HTML gets <script src="/__duet-e2e/probe.js"> before </head>: a sampler posting the reporter's fields the sa*
//   checks read (standalone proof, column groups, drag leftovers, data-press, mode, side, visual viewport, touches);
//   GET/POST /api/e2e-relay is the same relay as the site's ({beacon, s, path}), plus {upstream, build}: switching the
//   upstream bumps gen and the installed app reloads onto the other build, so one clip and one origin serve both.
// Loopback only: the upstream and the beacon must be localhost. Usage: node probe-proxy.mjs <port> <upstream origin> [build]
import http from "node:http";
import net from "node:net";

const port = Number(process.argv[2] ?? 18460);
const loop = (o) => { try { const u = new URL(o); return /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : null; } catch { return null; } };
let upstream = loop(process.argv[3] ?? "") ?? "http://127.0.0.1:18452";
let relay = { beacon: null, s: null, path: null, build: process.argv[4] ?? null, gen: 1 };

const PROBE = `(() => {
  if (window.top !== window) return;
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  // ?duet-probe: a Safari tab reports too (the gutter scenario compares a tab's posture with the web app's).
  if (!standalone && !/[?&]duet-probe/.test(location.search)) return;
  const PAGE = Math.random().toString(36).slice(2, 10);
  let beacon = null, s = null, build = null, gen = null, frameAt = 0;
  const taps = [];
  const r1 = (v) => Math.round(v * 10) / 10;
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: r1(b.left), y: r1(b.top), w: r1(b.width), h: r1(b.height) }; };
  const shown = (el) => { const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01; };
  const label = (el) => { const c = typeof el.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""; return el.tagName.toLowerCase() + (c ? "." + c : ""); };
  const buttons = (el) => [...el.querySelectorAll("button")].filter(shown).map((b) => ({ label: b.getAttribute("aria-label") || "", rect: rect(b) }));
  // gutter (sa20+): where the page's content stops against the rail, and what paints between. Recomputed each second.
  // env: the computed safe-area insets (a hidden fixed div padded by env()); duet: Duet's page insets and mode;
  // col: the union of the column's groups; content: the outermost edges of painting non-Duet elements narrower than
  // the viewport (a full-width header or body says nothing about the grid); paint: the effective background at sample
  // points in the rail band and in the band between content and rail, against the page's own background.
  let envEl = null, gutter = null, gutterAt = 0;
  const bgOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== "transparent" && !/rgba\\(.*,\\s*0\\)$/.test(c)) return c; } return "none"; };
  const measure = () => {
    const h = document.documentElement, W = innerWidth, H = innerHeight;
    if (!envEl) { envEl = document.createElement("div"); envEl.setAttribute("aria-hidden", "true"); envEl.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"; document.body.appendChild(envEl); }
    const ec = getComputedStyle(envEl), hc = getComputedStyle(h);
    const env = { t: parseFloat(ec.paddingTop), r: parseFloat(ec.paddingRight), b: parseFloat(ec.paddingBottom), l: parseFloat(ec.paddingLeft) };
    const px = (n) => { const v = parseFloat(hc.getPropertyValue(n)); return Number.isFinite(v) ? v : null; };
    const nav = document.querySelector("nav.duet");
    const duet = { mode: h.getAttribute("data-duet-mode"), side: nav ? nav.getAttribute("data-side") : null, insetL: px("--duet-inset-left"), insetR: px("--duet-inset-right"), gap: px("--duet-rail-gap") };
    const gs = [...document.querySelectorAll(".duet .duet-group")].filter(shown).map((g) => g.getBoundingClientRect());
    const col = gs.length ? { x: r1(Math.min(...gs.map((b) => b.left))), r: r1(Math.max(...gs.map((b) => b.right))), y: r1(Math.min(...gs.map((b) => b.top))), b: r1(Math.max(...gs.map((b) => b.bottom))) } : null;
    let right = 0, left = W, who = { right: null, left: null }, n = 0;
    const take = (b, el) => {
      if (b.width < 1 || b.height < 1 || b.bottom < 0 || b.top > H || b.right < 0 || b.left > W) return;
      if (b.right > right) { right = b.right; who.right = label(el); }
      if (b.left < left) { left = b.left; who.left = label(el); }
    };
    const rg = document.createRange();
    for (const el of document.body.querySelectorAll("*")) {
      if (++n > 4000) break;
      if (el === envEl || el.closest(".duet, [data-duet], script, style, noscript")) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1 || b.bottom < 0 || b.top > H || b.right < 0 || b.left > W) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.02 || cs.position === "fixed") continue;
      // Text counts by its own extent, so a full-width paragraph still says where its words stop.
      for (const t of el.childNodes) if (t.nodeType === 3 && t.textContent.trim()) { rg.selectNodeContents(t); for (const q of rg.getClientRects()) take(q, el); }
      // A box (media, background, side border) counts by its rect, unless it spans the viewport (a page wrapper).
      if (b.width >= W - 1) continue;
      const box = /^(IMG|SVG|CANVAS|VIDEO|svg|PICTURE)$/.test(el.tagName) || (cs.backgroundColor !== "transparent" && !/rgba\\(.*,\\s*0\\)$/.test(cs.backgroundColor)) || cs.backgroundImage !== "none" || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
      if (box) take(b, el);
    }
    const page = bgOf(document.body) !== "none" ? bgOf(document.body) : bgOf(h);
    const ys = [0.2, 0.4, 0.6, 0.8].map((f) => Math.round(H * f));
    const at = (x) => ys.map((y) => { const el = document.elementFromPoint(x, y); return { x: Math.round(x), y, el: el ? label(el) : null, bg: el ? bgOf(el) : null, duet: !!(el && el.closest(".duet")) }; });
    const insetR = duet.insetR ?? env.r, insetL = duet.insetL ?? env.l;
    const paint = {
      page,
      railR: insetR > 2 ? at(W - insetR / 2) : [],
      railL: insetL > 2 ? at(insetL / 2) : [],
      gapR: insetR > 2 && right < W - insetR - 2 ? at((right + W - insetR) / 2) : [],
      gapL: insetL > 2 && left > insetL + 2 ? at((left + insetL) / 2) : [],
    };
    return { t: Date.now(), W, H, outer: { w: outerWidth, h: outerHeight }, screen: { w: screen.width, h: screen.height }, env, duet, col, content: { left: r1(left), right: r1(right), who }, paint };
  };
  window.__duetProbeMeasure = measure; // for checking the probe by hand in a desktop browser
  const sample = () => {
    const h = document.documentElement, v = visualViewport;
    if (Date.now() - gutterAt > 1000) { gutterAt = Date.now(); try { gutter = measure(); } catch (e) { gutter = { error: String(e) }; } }
    return {
      probe: true, gutter,
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
})
  // WebSocket upgrades pass through as raw bytes: a Next dev upstream (the site's lab) hydrates only once its HMR
  // socket (/_next/hmr) connects, so without this the lab stays blank behind the proxy.
  .on("upgrade", (req, sock, head) => {
    const u = new URL(upstream);
    const up = net.connect(Number(u.port || 80), u.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2)
        lines.push(`${req.rawHeaders[i]}: ${/^host$/i.test(req.rawHeaders[i]) ? u.host : req.rawHeaders[i + 1]}`);
      up.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) up.write(head);
      sock.pipe(up).pipe(sock);
    });
    up.on("error", () => sock.destroy());
    sock.on("error", () => up.destroy());
  })
  .listen(port, "127.0.0.1", () => console.log(`probe proxy on :${port} -> ${upstream}`));
