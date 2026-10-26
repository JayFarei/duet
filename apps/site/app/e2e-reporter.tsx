"use client";
import { useEffect } from "react";
import { isPreview, previewReason, readSignals } from "duet-ui";

// e2e only (tools/e2e): with ?e2e in the URL (or once seen in this tab), posts Duet's full state to the local
// beacon every 100ms. ?e2e=<origin> picks the beacon, default http://localhost:3141. Renders nothing.
const KEY = "duet-e2e";
// One id per page load, so the driver can tell two documents with the same URL apart (a dismissing preview and
// the Safari tab it opened, a stale tab).
const PAGE = Math.random().toString(36).slice(2, 10);

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

function label(el: Element) {
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
}

function sample() {
  const sig = readSignals();
  const navs = [...document.querySelectorAll("nav.duet")].map((n) => ({
    mode: n.getAttribute("data-mode"), side: n.getAttribute("data-side"), settling: n.getAttribute("data-settling"),
    keyboard: n.getAttribute("data-keyboard"), rect: rect(n), shown: shown(n),
    slots: [...n.querySelectorAll("[data-duet-slot]")].filter(shown).map((s) => ({ slot: s.getAttribute("data-duet-slot"), rect: rect(s) })),
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
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("nav.duet, script, style, svg *")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const text = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim()) || /^(IMG|SVG|BUTTON|INPUT|VIDEO|CANVAS|A)$/i.test(el.tagName);
    const over = Math.max(r.right - hi, lo - r.left);
    if (over > 1 && shown(el) && !scroller(el)) out.push({ el: label(el), rect: rect(el), over: Math.round(over), text });
    if (text && r.top < innerHeight && r.bottom > 0) {
      const i = slots.findIndex((s) => r.left < s.x + s.w - 2 && r.right > s.x + 2 && r.top < s.y + s.h - 2 && r.bottom > s.y + 2);
      if (i >= 0 && shown(el)) under.push({ el: label(el), rect: rect(el), slot: i });
    }
  }
  out.sort((a, b) => b.over - a.over);
  const main = document.querySelector("main");
  const h = document.documentElement;
  return {
    t: Date.now(), page: PAGE, path: location.pathname + location.search,
    sig, preview: isPreview(sig), reason: previewReason(sig) ?? null,
    html: { mode: h.getAttribute("data-duet-mode"), split: h.getAttribute("data-duet-split"), emulated: h.getAttribute("data-duet-emulated") },
    navs,
    scroll: { scrollWidth: h.scrollWidth, clientWidth: W, bodyScrollWidth: document.body.scrollWidth, x: scrollX, y: scrollY },
    vv: visualViewport ? { x: visualViewport.offsetLeft, y: visualViewport.offsetTop, w: visualViewport.width, h: visualViewport.height, scale: visualViewport.scale } : null,
    overflow: out.slice(0, 20), overflowCount: out.length, underControls: under.slice(0, 10),
    content: main ? { main: rect(main), children: [...main.children].slice(0, 16).filter(shown).map((c) => ({ el: label(c), rect: rect(c) })) } : null,
  };
}

export function E2EReporter() {
  useEffect(() => {
    let origin: string | null = null;
    try {
      const q = new URLSearchParams(location.search).get("e2e");
      if (q !== null) sessionStorage.setItem(KEY, q.startsWith("http") ? q : "http://localhost:3141");
      origin = sessionStorage.getItem(KEY);
    } catch { /* storage blocked: no reporting */ }
    if (!origin) return;
    const url = origin + "/beacon";
    const id = setInterval(() => {
      try { fetch(url, { method: "POST", body: JSON.stringify(sample()), headers: { "content-type": "text/plain" }, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
    }, 100);
    return () => clearInterval(id);
  }, []);
  return null;
}
