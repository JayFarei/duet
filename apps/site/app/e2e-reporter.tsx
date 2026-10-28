"use client";
import { useEffect } from "react";
import { isPreview, previewReason, readSignals } from "duet-ui";

// e2e only (tools/e2e): with ?e2e in the URL (or once seen in this tab), posts Duet's full state to the local
// beacon every 40ms (a flash of one frame pair is ~33ms; 100ms sampling missed 103ms ones). ?e2e=<loopback origin> picks the beacon, default http://localhost:3141. Renders nothing.
const KEY = "duet-e2e";
// The driver's run token (?s=), kept for the tab like the beacon: a page navigated to without it (a back button's
// location.href, a link) still reports as the same run.
const S_KEY = "duet-e2e-s";
const loopback = (q: string) => {
  try { const u = new URL(q); return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) ? u.origin : undefined; } catch { return undefined; }
};
// One id per page load, so the driver can tell two documents with the same URL apart (a dismissing preview and
// the Safari tab it opened, a stale tab).
// The early sampler (./e2e-early) picked it at first paint: the same page reports on through hydration.
const early = typeof window === "undefined" ? undefined : (window as Window & { __duetE2E?: { page: string; stop: number } }).__duetE2E;
const PAGE = early?.page ?? Math.random().toString(36).slice(2, 10);
// When the page last rendered a frame (requestAnimationFrame). WebKit can hold rendering while a fold animates yet keep
// running timers and layout: a sample then reads a layout nobody sees (e2e rerun, 2026-10-28: unfolding the turned
// preview laid out four sizes over ~220ms with no frame, the screen black, then the settled page).
let frameAt = 0;
// The last few touches the page received, with what they hit: a step whose tap did nothing shows whether WebKit
// delivered it, and to what (mod01-05, a column X tapped after a turn left the visual viewport short).
const taps: { t: number; type: string; x: number; y: number; target: string; vv: { y: number; h: number } | null }[] = [];

function rect(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
}

function shown(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01;
}

// The icons a slot draws (its svg), clipped to the slot, with the opacity they are drawn at: e2e.py crops each one
// from the screenshot and fails a step whose visible icon is not painted (splitturn-left-to90, round 3).
function icons(slot: Element) {
  const box = slot.getBoundingClientRect();
  return [...slot.querySelectorAll("svg")].flatMap((el) => {
    let o = 1;
    for (let e: Element | null = el; e && e !== slot.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return [];
      o *= Number(cs.opacity);
    }
    const r = el.getBoundingClientRect();
    const x = Math.max(r.left, box.left), y = Math.max(r.top, box.top), x2 = Math.min(r.right, box.right), y2 = Math.min(r.bottom, box.bottom);
    if (o < 0.3 || x2 - x < 6 || y2 - y < 6) return [];
    return [{ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round((x2 - x) * 10) / 10, h: Math.round((y2 - y) * 10) / 10 }];
  });
}

function label(el: Element) {
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
}

// What a slot's buttons say (aria-label), so a step can check a call to action turned into "Booked".
const labels = (el: Element) => [...el.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? (b.textContent ?? "").trim());
// Each visible button of a slot with where it is: the driver taps one by its label (a tab of the pill, the back button).
const buttons = (el: Element) => [...el.querySelectorAll("button")].filter(shown).map((b) => ({
  label: b.getAttribute("aria-label") ?? (b.textContent ?? "").trim(), rect: rect(b), pressed: b.getAttribute("aria-pressed") ?? b.getAttribute("aria-selected"),
  role: b.getAttribute("role"),
}));

// The page's own controls and dialogs, outside Duet, with where they are: the driver taps them by rect (README).
function targets() {
  const out: { el: string; name: string; id: string | null; rect: ReturnType<typeof rect> }[] = [];
  for (const el of document.querySelectorAll("[data-e2e], a[href], button, input, textarea, select")) {
    if (out.length >= 40) break;
    if (el.closest("nav.duet") || !shown(el)) continue;
    const name = (el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? (el.textContent ?? "").trim().replace(/\s+/g, " ")).slice(0, 60);
    out.push({ el: el.tagName.toLowerCase(), name, id: el.getAttribute("data-e2e"), rect: rect(el) });
  }
  return out;
}

function sample(s: string | null) {
  const sig = readSignals();
  const navs = [...document.querySelectorAll("nav.duet")].map((n) => ({
    mode: n.getAttribute("data-mode"), side: n.getAttribute("data-side"), settling: n.getAttribute("data-settling"),
    hidden: n.getAttribute("data-hidden"), confidence: n.getAttribute("data-confidence"),
    keyboard: n.getAttribute("data-keyboard"), rect: rect(n), shown: shown(n),
    slots: [...n.querySelectorAll("[data-duet-slot]")].filter(shown).map((s) => ({
      slot: s.getAttribute("data-duet-slot"), rect: rect(s), icons: icons(s), labels: labels(s), buttons: buttons(s), expanded: s.getAttribute("data-expanded"),
    })),
    // An open "…" or tab menu is drawn outside the slots: the driver taps its items (a back folded into "…") by label.
    menus: [...n.querySelectorAll("[role=menu]")].filter(shown).map((m) => ({ rect: rect(m), buttons: buttons(m) })),
  }));
  // Visible elements that stick out of the layout viewport (clipped content), Duet's own layer and content inside
  // a deliberate inner horizontal scroller narrower than the page (a code block) excluded. Full-bleed wrappers are reported too: the assertion
  // decides what counts, this only measures.
  // The visible band follows the horizontal scroll offset: a landscape preview reports scrollX = +-84 (the native
  // column's inset) with static content shifted by it and still fully visible (e2e.py applies the same band).
  const W = document.documentElement.clientWidth, lo = Math.min(0, -scrollX), hi = Math.max(W, W - scrollX), out: { el: string; rect: ReturnType<typeof rect>; over: number; text: boolean }[] = [];
  const slots = navs.flatMap((n) => n.slots.map((s) => s.rect));
  const under: { el: string; rect: ReturnType<typeof rect>; slot: number }[] = [];
  const scroller = (el: Element) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if ((ox === "auto" || ox === "scroll") && a.scrollWidth > a.clientWidth + 1) {
        // A page-wide scroller (Duet's own) is the page, not a deliberate inner scroller.
        const b = a.getBoundingClientRect();
        if (b.width < W - 1 && b.right <= hi + 1 && b.left >= lo - 1) return true;
      }
    }
    return false;
  };
  // The part of an element its clipping ancestors let through: a chip past the end of a sideways scroller is hidden,
  // not under a control (pg03-05: /scroll's Chip 10 at 816..904, its row clipped at 851, the rail at 878).
  const clipped = (el: Element, r: DOMRect) => {
    let { left, right, top, bottom } = r;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const b = a.getBoundingClientRect();
      left = Math.max(left, b.left); right = Math.min(right, b.right); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom);
    }
    return right - left >= 1 && bottom - top >= 1 ? { left, right, top, bottom } : null;
  };
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("nav.duet, script, style, svg *")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const text = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim()) || /^(IMG|SVG|BUTTON|INPUT|VIDEO|CANVAS|A)$/i.test(el.tagName);
    const over = Math.max(r.right - hi, lo - r.left);
    if (over > 1 && shown(el) && !scroller(el)) out.push({ el: label(el), rect: rect(el), over: Math.round(over), text });
    if (text && r.top < innerHeight && r.bottom > 0) {
      const v = clipped(el, r);
      const i = v ? slots.findIndex((s) => v.left < s.x + s.w - 2 && v.right > s.x + 2 && v.top < s.y + s.h - 2 && v.bottom > s.y + 2) : -1;
      if (i >= 0 && shown(el)) under.push({ el: label(el), rect: rect(el), slot: i });
    }
  }
  out.sort((a, b) => b.over - a.over);
  const main = document.querySelector("main");
  const h = document.documentElement;
  return {
    t: Date.now(), page: PAGE, path: location.pathname + location.search, s,
    // A backgrounded page (home screen, a split view menu) still lays out for the app switcher; nobody sees it.
    visible: document.visibilityState, frameAt, focus: document.hasFocus(),
    active: document.activeElement && document.activeElement !== document.body ? document.activeElement.tagName.toLowerCase() : null,
    sig, preview: isPreview(sig), reason: previewReason(sig) ?? null,
    html: { mode: h.getAttribute("data-duet-mode"), split: h.getAttribute("data-duet-split"), emulated: h.getAttribute("data-duet-emulated") },
    navs,
    scroll: { scrollWidth: h.scrollWidth, clientWidth: W, bodyScrollWidth: document.body.scrollWidth, x: scrollX, y: scrollY },
    vv: visualViewport ? { x: visualViewport.offsetLeft, y: visualViewport.offsetTop, w: visualViewport.width, h: visualViewport.height, scale: visualViewport.scale } : null,
    overflow: out.slice(0, 20), overflowCount: out.length, underControls: under.slice(0, 10),
    targets: targets(),
    taps: taps.slice(),
    dialogs: [...document.querySelectorAll("[role=dialog], dialog[open]")].filter(shown).map(rect),
    content: main ? { main: rect(main), children: [...main.children].slice(0, 16).filter(shown).map((c) => ({ el: label(c), rect: rect(c) })) } : null,
  };
}

const TRACE_KEY = "duet-trace";
function lean() {
  const n = document.querySelector("nav.duet");
  return {
    t: Date.now(), page: PAGE, path: location.pathname, sig: readSignals(), frameAt, active: document.activeElement?.tagName.toLowerCase() ?? null,
    vv: visualViewport ? { y: visualViewport.offsetTop, h: visualViewport.height, scale: visualViewport.scale } : null, y: scrollY,
    nav: n && { mode: n.getAttribute("data-mode"), settling: n.getAttribute("data-settling"), hidden: n.getAttribute("data-hidden"),
      confidence: n.getAttribute("data-confidence"), keyboard: n.getAttribute("data-keyboard"),
      slots: [...n.querySelectorAll("[data-duet-slot]")].filter(shown).map((s) => ({ slot: s.getAttribute("data-duet-slot"), rect: rect(s) })) },
  };
}

export function E2EReporter() {
  useEffect(() => {
    // The top page only: a same-origin iframe (/'s WebDuo demo of /skeleton) shares the tab's sessionStorage, so it
    // would report under the run's token and the driver could follow it instead of the page (nav01-04, "the page is
    // not reporting").
    if (window.top !== window) return;
    let origin: string | null = null, s: string | null = null;
    try {
      const q = new URLSearchParams(location.search).get("e2e");
      // Loopback beacons only: a link must not make a visitor's page post its state to another origin.
      if (q !== null) sessionStorage.setItem(KEY, loopback(q) ?? "http://localhost:3141");
      origin = sessionStorage.getItem(KEY);
      const sq = new URLSearchParams(location.search).get("s");
      if (sq) sessionStorage.setItem(S_KEY, sq);
      s = sessionStorage.getItem(S_KEY);
    } catch { /* storage blocked: no reporting */ }
    let raf = 0;
    const frame = () => { frameAt = Date.now(); raf = requestAnimationFrame(frame); };
    // ?trace: a real phone has no loopback beacon, so it records lean samples (signals, Duet's verdict, where the
    // controls are) every 40ms and posts them in batches to the dev server's trace sink (/api/lab-trace, $DUET_TRACE).
    let trace = false;
    try {
      if (new URLSearchParams(location.search).has("trace")) sessionStorage.setItem(TRACE_KEY, "1");
      trace = sessionStorage.getItem(TRACE_KEY) === "1";
    } catch { /* storage blocked: no trace */ }
    if (trace) {
      raf = requestAnimationFrame(frame);
      let batch: unknown[] = [];
      const take = setInterval(() => batch.push(lean()), 40);
      const send = setInterval(() => {
        if (!batch.length) return;
        const body = batch.map((b) => JSON.stringify(b)).join("\n");
        batch = [];
        fetch("/api/lab-trace", { method: "POST", body, headers: { "content-type": "text/plain" }, keepalive: true }).catch(() => {});
      }, 400);
      return () => { clearInterval(take); clearInterval(send); cancelAnimationFrame(raf); };
    }
    if (!origin) return;
    if (early) early.stop = 1;
    const url = origin + "/beacon";
    raf = requestAnimationFrame(frame);
    const touch = (e: Event) => {
      const p = "touches" in e ? (e as TouchEvent).changedTouches[0] : (e as PointerEvent);
      if (!p) return;
      taps.push({ t: Date.now(), type: e.type, x: Math.round(p.clientX), y: Math.round(p.clientY), target: e.target instanceof Element ? label(e.target) : String(e.target),
        vv: visualViewport ? { y: Math.round(visualViewport.offsetTop), h: Math.round(visualViewport.height) } : null });
      if (taps.length > 8) taps.shift();
    };
    for (const type of ["touchstart", "pointerdown", "click"]) addEventListener(type, touch, { capture: true, passive: true });
    const id = setInterval(() => {
      try { fetch(url, { method: "POST", body: JSON.stringify(sample(s)), headers: { "content-type": "text/plain" }, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
    }, 40);
    return () => {
      clearInterval(id); cancelAnimationFrame(raf);
      for (const type of ["touchstart", "pointerdown", "click"]) removeEventListener(type, touch, { capture: true });
    };
  }, []);
  return null;
}
