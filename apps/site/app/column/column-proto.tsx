"use client";
// The templated column (#169). One template on every layout: the burger always, then the developer's key buttons
// while they fit, and a "…" at the foot that grows into the full list with a liquid morph. On the Duo it draws into
// Safari's column for real (an absolute layer wider than the viewport, taps routed by coordinates, as duet-ui's
// useColumnLayer does); anywhere else it draws the Duo's screen to scale, so it can be tuned in a desktop browser.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { columnBand, useDuet, type Context } from "duet-ui";
import { HapticsProvider, useHaptics } from "@haptics/react";
import {
  Archive, Bookmark, Check, Clock, Ellipsis, FolderPlus, Heart, House, Menu, MessageCircle, Paperclip, Pin, Search,
  Settings, Share, ShoppingBag, SquarePen, Star,
} from "lucide-react";

/** Duo metrics (duet-ui geometry.ts DUO, MORPH): button, stacked item pitch, gap, strip centre from the edge. */
const C = 49, ITEM = 51.7, GAP = 11, EDGE = 48.2, ROW = 44, PAD = 6, HEAD = 26, MENU_W = 232;
/** A group of n buttons in one capsule. */
const groupH = (n: number) => C + (n - 1) * ITEM;

/** A damped spring as a CSS linear() easing (Safari 17.2+), with the time it takes to settle. */
function spring(stiffness: number, damping: number, n = 40) {
  const w0 = Math.sqrt(stiffness), z = damping / (2 * w0), wd = w0 * Math.sqrt(1 - z * z);
  const x = (t: number) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const T = -Math.log(0.002) / (z * w0);
  return { easing: `linear(${Array.from({ length: n + 1 }, (_, i) => +x((i / n) * T).toFixed(4)).join(",")})`, ms: Math.round(T * 1000) };
}
const SLIDE = spring(210, 25), SETTLE = spring(260, 20), GROUP = spring(240, 26);

type Item = { id: string; label: string; icon: ReactNode };
const ic = (I: typeof Share) => <I size={21} strokeWidth={2} />;
const CATALOG: Item[] = [
  { id: "share", label: "Share", icon: ic(Share) },
  { id: "search", label: "Find in page", icon: ic(Search) },
  { id: "pin", label: "Pin", icon: ic(Pin) },
  { id: "bookmark", label: "Bookmark", icon: ic(Bookmark) },
  { id: "project", label: "Add to project", icon: ic(FolderPlus) },
  { id: "files", label: "Uploaded files", icon: ic(Paperclip) },
  { id: "like", label: "Favorite", icon: ic(Heart) },
  { id: "archive", label: "Archive", icon: ic(Archive) },
];
const CHECKOUT: Item = { id: "checkout", label: "Checkout", icon: ic(ShoppingBag) };
const COMPOSE: Item = { id: "compose", label: "New chat", icon: ic(SquarePen) };
/** The burger's sections: the sidebar's, and the head of the "…" list where the burger has no room (the preview). */
const NAV: Item[] = [
  { id: "home", label: "Home", icon: ic(House) }, { id: "chats", label: "Chats", icon: ic(MessageCircle) },
  { id: "starred", label: "Starred", icon: ic(Star) }, { id: "scheduled", label: "Scheduled", icon: ic(Clock) },
  { id: "settings", label: "Settings", icon: ic(Settings) },
];

type Slot = { kind: "burger" } | { kind: "more" } | { kind: "primary" } | { kind: "item"; item: Item };
type Group = Slot[];

/** The roomiest arrangement that fits the band: every item shown, then fewer items with "…" closing the group.
 *  The checkout keeps its own group while any arrangement leaves room for it, else it joins the "…" list. Most
 *  items shown wins. Inline a lone burger breaks ties; in the column the burger shares the capsule, as a second
 *  capsule's gap would push the stack toward Safari's own buttons. `extra`: what a lone group may take beyond the
 *  band (the band keeps a gap to Safari's buttons on each side; one capsule may take all but 5pt of them). */
function allocate(h: number, extra: number, items: Item[], primary: boolean, split: boolean): { groups: Group[]; hidden: boolean } {
  const B: Slot = { kind: "burger" }, M: Slot = { kind: "more" }, P: Group[] = primary ? [[{ kind: "primary" }]] : [];
  const it = (k: number): Slot[] => items.slice(0, k).map((item) => ({ kind: "item", item }));
  const height = (gs: Group[]) => gs.reduce((s, g) => s + groupH(g.length), 0) + (gs.length - 1) * GAP;
  const tries: { groups: Group[]; shown: number; score: number }[] = [];
  for (const p of primary ? [P, []] : [[]]) {
    const bonus = p.length ? 1000 : 0, n = items.length;
    if (split) tries.push({ groups: [[B], ...(n ? [it(n)] : []), ...p], shown: n, score: bonus + n * 10 + 1 });
    tries.push({ groups: [[B, ...it(n)], ...p], shown: n, score: bonus + n * 10 });
    for (let k = n - 1; k >= 0; k--) {
      if (split) tries.push({ groups: [[B], [...it(k), M], ...p], shown: k, score: bonus + k * 10 + 1 });
      tries.push({ groups: [[B, ...it(k), M], ...p], shown: k, score: bonus + k * 10 });
    }
  }
  const fit = tries.filter((t) => height(t.groups) <= h + (t.groups.length === 1 ? extra : 0)).sort((a, b) => b.score - a.score)[0];
  const groups = fit?.groups ?? [[B, M]];
  return { groups, hidden: !groups.some((g) => g.some((s) => s.kind === "more")) ? false : true };
}

/** Where things go, in stage coordinates (the stage is the screen; the page is its left `pw` points). */
type Frame = {
  kind: "column" | "inline";
  /** The in-app preview's column: one button of room, so only "…". */
  preview?: boolean;
  /** ph: the page clear of Safari's chrome (controls and menus stay in it); full: the page box, which runs on under
   *  Safari's floating URL bar in the column (duet-ui's --duet-inset-bottom), so nothing below the page is blank. */
  sw: number; ph: number; full: number; pw: number; insetTop: number;
  cx: number; top: number; bottom: number;
  /** The page-side edge the menu buds past: the column's inner edge, or the strip's. */
  edge: number;
  safari?: { back: number; island: number };
};

const OUTER = { mode: "column", duo: true, browser: "safari", device: "duo", standalone: false, layout: "narrow", side: "right", width: 382, height: 580, stableHeight: 580, offsetTop: 0, screenWidth: 466, screenHeight: 678, insetTop: 0, insetBottom: 0 } as Context;
const INNER = { mode: "inline", duo: true, browser: "safari", device: "duo", standalone: false, layout: "wide", side: "right", width: 951, height: 669, stableHeight: 669, offsetTop: 0, screenWidth: 951, screenHeight: 669, insetTop: 0, insetBottom: 0 } as Context;

/** The in-app preview on the closed screen (iOS 27.1 sheet): 75pt of its chrome above the page, 84pt column. Drawn
 *  as the page alone, which is what the band is measured in. */
const PREVIEW = { ...OUTER, preview: true, height: 603, stableHeight: 603, screenHeight: 603, insetBottom: 34 } as Context;

/** `la`: Live Activities assumed. The worst case (one or two) pushes Safari's column 90.3pt down. */
function frameOf(c: Context, la: boolean): Frame {
  const band = columnBand(c);
  if (band) {
    const cx = c.screenWidth - EDGE, top = band.top - (la ? 0 : band.reach);
    return { kind: "column", preview: c.preview, sw: c.screenWidth, ph: c.height, full: Math.max(c.height, c.screenHeight - c.offsetTop), pw: c.width, insetTop: c.insetTop, cx, top, bottom: band.bottom, edge: c.width,
      ...(!c.preview && { safari: { back: la ? 264.3 : 174, island: la ? 146.3 : 62 } }) };
  }
  const cx = c.width - 8 - C / 2;
  return { kind: "inline", sw: c.width, ph: c.height, full: c.height, pw: c.width, insetTop: c.insetTop, cx, top: c.insetTop + 20, bottom: c.height - (c.insetBottom ?? 0) - 20, edge: cx - C / 2 - 4 };
}

type Rect = { x: number; y: number; w: number; h: number };
type Placed = { group: Group; rect: Rect; primary: boolean };

function place(f: Frame, groups: Group[]): Placed[] {
  const heights = groups.map((g) => groupH(g.length));
  const total = heights.reduce((s, h) => s + h, 0) + (groups.length - 1) * GAP;
  const x = f.cx - C / 2;
  // In the column the stack centres in the band (the band is the whole budget); inline the burger heads the strip and
  // the checkout sits at its foot, under the thumb.
  let y = f.kind === "column" ? f.top + (f.bottom - f.top - total) / 2 : f.top;
  return groups.map((group, i) => {
    const primary = group[0].kind === "primary";
    const top = primary && f.kind === "inline" ? f.bottom - C : y;
    y += heights[i] + GAP;
    return { group, rect: { x, y: top, w: C, h: heights[i] }, primary };
  });
}

function menuBox(f: Frame, from: Rect, n: number, heads = 1): Rect {
  const h = Math.min(2 * PAD + heads * HEAD + n * ROW, f.ph - 24), w = MENU_W, x = f.edge - 10 - w;
  const below = from.y + from.h / 2 > f.ph / 2;
  const y = below ? from.y + from.h - h : from.y;
  return { x, y: Math.min(Math.max(y, Math.max(f.insetTop, 12)), f.ph - 12 - h), w, h };
}

/** One spring drives the whole morph, so it is a single continuous expansion and retraction, interruptible either
 *  way with its velocity kept. iOS's path (60fps captures of the native menu): the capsule swells on the press, then
 *  grows tall before it grows wide, its column-side edge going almost straight to its place while the page-side
 *  edge reaches out; the list shows from the start, scaled with the glass and blurred, sharpening late. Closing
 *  runs the same curves back, so the width goes first and the height last, but the tint and the list leave at once
 *  (time-based, ~110ms) and what collapses into the button is clear glass. */
const MORPH_OPEN = { stiffness: 300, damping: 30 }, MORPH_CLOSE = { stiffness: 380, damping: 37 };
const CLEAR_MS = 110;
/** Dev: `?slow=N` runs the morph N times slower, to inspect it frame by frame. */
const SLOW = typeof location === "undefined" ? 1 : Math.max(1, Number(new URLSearchParams(location.search).get("slow")) || 1);
/** s plus k·s(1-s)²: 0 to 1 with slope 1 at 1 (so a spring's overshoot carries on smoothly), leading for k > 0
 *  (up to 3), lagging for k < 0 (down to -1). */
const lead = (s: number, k: number) => s + k * s * (1 - s) * (1 - s);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function Morph({ open, from, slots, box, onClosed, children }: { open: boolean; from: Rect; slots: Slot[]; box: Rect; onClosed: () => void; children: ReactNode }) {
  const blob = useRef<HTMLDivElement>(null), fill = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), face = useRef<HTMLDivElement>(null);
  const st = useRef({ s: 0, v: 0, raf: 0, last: 0, clear: 0 });
  const closed = useRef(onClosed);
  closed.current = onClosed;
  /** `clear`: how far the closing fade has run, 0 (none) to 1 (clear glass). */
  const draw = (s: number, clear: number) => {
    const el = blob.current, fl = fill.current, b = body.current, fc = face.current;
    if (!el || !fl || !b || !fc) return;
    // Toward the page is -x when the menu sits left of the capsule (the column), else +x.
    const left = box.x + box.w / 2 < from.x + from.w / 2;
    const tall = lead(lead(s, 3), 1.5), wide = lead(lead(s, -1), -0.6), outer = lead(lead(s, 3), 3);
    // The press swell: up to 1.2x, over before the shape leaves the capsule's size.
    const swell = 1 + 0.2 * Math.sin(Math.PI * clamp01(s / 0.3));
    const w = Math.max(from.w * swell, mix(from.w, box.w, wide)), h = Math.max(from.h * swell, mix(from.h, box.h, tall));
    const o = mix(left ? from.x + from.w : from.x, left ? box.x + box.w : box.x, outer) + (left ? 1 : -1) * (w - mix(from.w, box.w, wide)) / 2;
    const l = left ? o - w : o;
    const cy = mix(from.y + from.h / 2, box.y + box.h / 2, tall), top = cy - h / 2;
    const r = mix(Math.min(w, h) / 2, 28, clamp01((wide - 0.15) / 0.6));
    el.style.cssText = `left:${l}px;top:${top}px;width:${w}px;height:${h}px;border-radius:${r}px`;
    const keep = 1 - clear;
    fl.style.opacity = String(clamp01(s * 2.5) * keep);
    const f = clamp01(1 - s / 0.18);
    fc.style.cssText = `width:${from.w}px;height:${from.h}px;opacity:${f};filter:blur(${(1 - f) * 4}px)`;
    // The list rides the glass: one uniform scale from its width, blur clearing late.
    const m = clamp01((s - 0.04) / 0.2) * keep, sharp = clamp01((s - 0.45) / 0.45), sc = Math.min(1, w / box.w);
    // At rest: no filter or scale, so WebKit rasterises the list sharp, and only then does it scroll.
    const rest = s > 0.999 && s < 1.001 && !clear;
    b.toggleAttribute("data-rest", rest);
    b.style.cssText = `width:${box.w}px;height:${box.h}px;opacity:${m}` + (rest ? "" : `;filter:blur(${(1 - sharp) * 10}px);scale:${sc}`);
  };
  useLayoutEffect(() => {
    const k = st.current, target = open ? 1 : 0, sp = open ? MORPH_OPEN : MORPH_CLOSE;
    cancelAnimationFrame(k.raf);
    const t0 = performance.now();
    if (open) k.clear = 0;
    draw(k.s, k.clear);
    k.last = 0;
    const tick = (t: number) => {
      const dt = k.last ? Math.min(0.032, (t - k.last) / 1000) / SLOW : 1 / 60 / SLOW;
      k.last = t;
      // Semi-implicit Euler in 4 substeps: stable at 120Hz and 30Hz alike.
      for (let i = 0; i < 4; i++) {
        const a = -sp.stiffness * (k.s - target) - sp.damping * k.v;
        k.v += a * dt / 4;
        k.s += k.v * dt / 4;
      }
      if (!open) k.clear = Math.max(k.clear, clamp01((t - t0) / (CLEAR_MS * SLOW)));
      // Settle on both ends alike: the leads multiply s near 0 by up to ~16, so an early cut lands visibly off the capsule.
      if (!open && Math.abs(k.s) < 0.0015 && Math.abs(k.v) < 0.02) { k.s = 0; k.v = 0; draw(0, 1); closed.current(); return; }
      if (open && Math.abs(k.s - 1) < 0.0015 && Math.abs(k.v) < 0.02) { k.s = 1; k.v = 0; draw(1, 0); return; }
      draw(k.s, k.clear);
      k.raf = requestAnimationFrame(tick);
    };
    k.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(k.raf);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- geometry is fixed while the menu is shown
  return (
    <div ref={blob} className="cp-blob" style={{ left: from.x, top: from.y, width: from.w, height: from.h, borderRadius: C / 2 }}>
      <div ref={fill} className="cp-fill" style={{ opacity: 0 }} aria-hidden />
      <i className="cp-rim" aria-hidden />
      <div ref={face} className="cp-face" style={{ width: from.w, height: from.h }} aria-hidden>
        {slots.map((s, i) => <span key={slotKey(s)} style={{ top: i * ITEM }}>{btnIcon(s)}</span>)}
      </div>
      <div ref={body} className="cp-menu" style={{ width: box.w, height: box.h, opacity: 0 }}><div className="cp-list">{children}</div></div>
    </div>
  );
}

const btnLabel = (s: Slot) => s.kind === "burger" ? "Menu" : s.kind === "more" ? "More" : s.kind === "primary" ? "Checkout" : s.item.label;
const btnIcon = (s: Slot) => s.kind === "burger" ? ic(Menu) : s.kind === "more" ? ic(Ellipsis) : s.kind === "primary" ? ic(ShoppingBag) : s.item.icon;
const btnHaptic = (s: Slot) => s.kind === "burger" ? "impact-medium" : s.kind === "primary" ? "impact-medium" : "impact-light";
const slotKey = (s: Slot) => s.kind === "item" ? s.item.id : s.kind;

type Knobs = { screen: "outer" | "inner" | "preview"; n: number; la: boolean; checkout: boolean };
const DEFAULTS: Knobs = { screen: "outer", n: 4, la: true, checkout: false };

function Proto() {
  const ctx = useDuet();
  const { trigger } = useHaptics();
  const [k, setK] = useState<Knobs>(DEFAULTS);
  /** Dev: `?bg=stripes|hstripes|rainbow|white|black|<hex>` lays a test backdrop over the page, under the column's glass and
   *  Safari's own, to compare the two over the same pixels. */
  const [bg, setBg] = useState<string | null>(null);
  useEffect(() => setBg(new URLSearchParams(location.search).get("bg")), []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const sc = q.get("screen");
    setK({ screen: sc === "inner" || sc === "preview" ? sc : "outer", n: Math.min(8, Math.max(1, Number(q.get("n") ?? 4) || 4)), la: q.get("la") !== "0", checkout: q.get("checkout") === "1" });
  }, []);
  const set = (p: Partial<Knobs>) => setK((o) => {
    const v = { ...o, ...p };
    history.replaceState(null, "", `?screen=${v.screen}&n=${v.n}&la=${v.la ? 1 : 0}&checkout=${v.checkout ? 1 : 0}`);
    return v;
  });

  // On the Duo the template draws into the real screen; anywhere else, onto a drawn Duo screen.
  const real = ctx.duo && ctx.browser === "safari";
  const c = real ? ctx : k.screen === "inner" ? INNER : k.screen === "preview" ? PREVIEW : OUTER;
  const f = useMemo(() => frameOf(c, k.la), [c, k.la]);

  const [sidebar, setSidebar] = useState(false);
  const [menu, setMenu] = useState<"closed" | "open" | "closing">("closed");
  const [armed, setArmed] = useState<"idle" | "armed" | "done">("idle");
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const say = (text: string) => setToast({ text, id: Date.now() });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1600); return () => clearTimeout(t); }, [toast]);

  const items = CATALOG.slice(0, k.n);
  const column = f.kind === "column", extra = column ? 2 * GAP - 2 * 5 : 0; // 5pt clear of Safari's buttons (RAIL.gap)
  const B: Slot = { kind: "burger" }, M: Slot = { kind: "more" };
  const { groups } = f.preview ? { groups: [[M]] } : sidebar ? { groups: [[B, { kind: "item", item: COMPOSE } as Slot]] }
    : allocate(f.bottom - f.top, extra, items, k.checkout, !column);
  const placed = place(f, groups);
  const primaryShown = placed.some((p) => p.primary);
  const list = [...items, ...(k.checkout && !primaryShown ? [CHECKOUT] : [])];
  // No burger shown (the preview): "…" carries its sections first.
  const nav = placed.some((p) => p.group.some((s) => s.kind === "burger")) ? [] : NAV;
  // The capsule holding "…" is what morphs into the menu.
  const moreAt = placed.find((p) => p.group.some((s) => s.kind === "more"));

  const closeMenu = () => setMenu((m) => (m === "open" ? "closing" : m));
  const press = (s: Slot) => {
    if (s.kind === "burger") { closeMenu(); setArmed("idle"); setSidebar((v) => !v); }
    else if (s.kind === "more") setMenu((m) => (m === "open" ? "closing" : "open"));
    else if (s.kind === "primary") {
      closeMenu();
      if (armed === "idle") setArmed("armed");
      else if (armed === "armed") { setArmed("done"); trigger("success"); setTimeout(() => setArmed("idle"), 1400); }
    } else { closeMenu(); say(s.item.label); }
  };

  // Safari's column is not hit-tested: route a touch there by coordinates, as useColumnLayer does, and give it the
  // haptic the switch overlay can't. The press acts on pointerdown, but iOS only ticks with user activation, which
  // the touch end grants and pointerdown doesn't, so the haptic waits for pointerup/touchend (when WebKit sends one).
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (!real || f.kind !== "column") return;
    const html = document.documentElement.style, prev = html.touchAction;
    html.touchAction = "pan-y";
    const pin = () => { if (Math.round(scrollX) !== 0) scrollTo({ left: 0, top: scrollY, behavior: "instant" }); };
    let haptic: string | undefined;
    const down = (e: PointerEvent) => {
      haptic = undefined;
      if (e.clientX < innerWidth) return;
      for (const b of document.querySelectorAll<HTMLButtonElement>("[data-cp-col] button")) {
        const r = b.getBoundingClientRect();
        if (getComputedStyle(b).visibility === "hidden") continue;
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          haptic = b.dataset.haptic;
          b.click();
          return;
        }
      }
      document.querySelector(".cp-scrim")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    const up = () => { if (haptic) trigger(haptic as Parameters<typeof trigger>[0]); haptic = undefined; };
    pin();
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("touchend", up);
    addEventListener("scroll", pin, { passive: true });
    return () => {
      html.touchAction = prev;
      removeEventListener("pointerdown", down); removeEventListener("pointerup", up); removeEventListener("touchend", up);
      removeEventListener("scroll", pin);
    };
  }, [real, f.kind, trigger]);

  // ?probe=1: what a column touch delivers (events, user activation), for the haptics investigation.
  const [probe, setProbe] = useState<string[] | null>(null);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("probe")) return;
    setProbe([]);
    const log = (e: Event) => {
      const x = (e as PointerEvent).clientX ?? (e as TouchEvent).changedTouches?.[0]?.clientX;
      const t = e.target as Element;
      const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive;
      setProbe((l) => [`${e.type} x=${Math.round(x ?? -1)} t=${t?.nodeName}${t?.className ? "." + String(t.className).split(" ")[0] : ""} ua=${ua}`, ...(l ?? [])].slice(0, 14));
    };
    const types = ["touchstart", "touchend", "touchcancel", "pointerdown", "pointerup", "pointercancel", "click"];
    for (const t of types) addEventListener(t, log, { capture: true });
    return () => { for (const t of types) removeEventListener(t, log, { capture: true }); };
  }, []);

  // Emulated: fit the drawn screen to the window.
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (real) return;
    const fit = () => setZoom(Math.min(1, (innerWidth - 48) / f.sw, (innerHeight - 48) / c.screenHeight));
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [real, f.sw, c.screenHeight]);

  const slide = f.kind === "column" ? f.sw : Math.min(340, f.pw * 0.4);
  const vars = { "--cp-slide": SLIDE.easing, "--cp-slide-ms": `${SLIDE.ms}ms`, "--cp-group": GROUP.easing, "--cp-group-ms": `${GROUP.ms}ms` } as CSSProperties;

  const stage = (
    <div className="cp-stage" data-kind={f.kind} data-real={real ? "" : undefined} style={{ ...vars, width: f.sw, height: real ? f.full : c.screenHeight }}>
      {!real && f.kind === "column" && <SafariColumn f={f} />}
      <Sidebar width={f.kind === "column" ? f.pw : slide} height={f.full} inset={f.full - f.ph} open={sidebar} onPick={(t) => { setSidebar(false); say(t); }} />
      <div className="cp-card" data-open={sidebar ? "" : undefined} style={{ width: f.pw, height: f.full, translate: sidebar ? `${slide}px 0` : "0 0" }}>
        <Page k={k} set={set} real={real} f={f} armed={armed} />
      </div>
      {bg && <div className="cp-testbg" data-bg={bg} style={/^[0-9a-f]{6}$/i.test(bg) ? { background: `#${bg}` } : undefined} aria-hidden />}
      {!real && f.full > f.ph && <div className="cp-bar" style={{ top: f.ph, width: f.pw, height: f.full - f.ph }} aria-hidden><i className="cp-rim" /></div>}
      {(menu !== "closed" || armed === "armed") && <div className="cp-scrim" onPointerDown={() => { closeMenu(); if (armed === "armed") setArmed("idle"); }} />}
      <div data-cp-col="" hidden={real && !!ctx.hidden}>
        {placed.map((p, gi) => {
          const pill = p.primary && armed !== "idle", W = 214;
          const rect = pill ? { ...p.rect, x: p.rect.x + C - W, w: W } : p.rect;
          return (
            <div key={gi} className="cp-group" data-primary={p.primary ? "" : undefined} data-armed={pill ? armed : undefined}
              data-morphing={p === moreAt && menu !== "closed" ? "" : undefined} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              <i className="cp-rim" aria-hidden />
              {p.group.map((s, i) => (
                <button key={slotKey(s)} className="cp-btn" aria-label={btnLabel(s)}
                  data-haptic={s.kind === "primary" && armed === "armed" ? "success" : btnHaptic(s)}
                  aria-expanded={s.kind === "more" ? menu === "open" : s.kind === "burger" ? sidebar : undefined}
                  style={{ top: i * ITEM, width: rect.w }} onClick={() => press(s)}>
                  {s.kind === "primary" ? <Checkout state={armed} /> : btnIcon(s)}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {menu !== "closed" && moreAt && (
        <Morph open={menu === "open"} from={moreAt.rect} slots={moreAt.group} box={menuBox(f, moreAt.rect, list.length + nav.length, nav.length ? 2 : 1)} onClosed={() => setMenu("closed")}>
          {nav.length > 0 && <>
            <div className="cp-menu-head">Menu</div>
            {nav.map((it) => (
              <button key={it.id} className="cp-row" data-haptic="selection" onClick={() => { closeMenu(); say(it.label); }}>
                {it.icon}<span>{it.label}</span>
              </button>
            ))}
          </>}
          <div className="cp-menu-head">{column ? "This page" : "More"}</div>
          {list.map((it) => (
            <button key={it.id} className="cp-row" data-haptic="selection" onClick={() => { closeMenu(); say(it.label); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </Morph>
      )}
      {probe && <pre style={{ position: "absolute", left: 8, top: 200, zIndex: 9, margin: 0, padding: 6, font: "10px/1.3 ui-monospace", background: "rgb(0 0 0/.8)", color: "#0f0", pointerEvents: "none" }}>{probe.join("\n")}</pre>}
      {toast && <div key={toast.id} className="cp-toast" style={{ left: f.pw / 2, top: f.ph - 80 }}>{toast.text}</div>}
    </div>
  );

  if (real) return stage;
  return (
    <div className="cp-desk">
      <div className="cp-device" style={{ zoom }}>{stage}</div>
    </div>
  );
}

/** The checkout's face: a bag, then (armed) the island's confirm, then the result. */
function Checkout({ state }: { state: "idle" | "armed" | "done" }) {
  return (
    <span className="cp-checkout" data-state={state}>
      <span className="cp-checkout-icon">{state === "done" ? ic(Check) : ic(ShoppingBag)}</span>
      <span className="cp-checkout-label">{state === "done" ? "Paid" : "Pay $48.00"}</span>
    </span>
  );
}

/** Safari's own column buttons, drawn (outer screen, emulated): back, forward and bookmarks under the island, the
 *  new tab and tabs pill at the foot (Duo Lab simulator, worst case and bare, space map). */
function SafariColumn({ f }: { f: Frame }) {
  const s = f.safari, x = f.cx - C / 2;
  // The preview's own: X and reader above the gap (one Live Activity's push shown), back below it (page points).
  if (!s) return (
    <div className="cp-safari" style={{ left: f.pw, width: f.sw - f.pw }} aria-hidden>
      {[104, 158, 353].map((y) => <div key={y} className="cp-native" style={{ left: x - f.pw, top: y }} />)}
      <div className="cp-band" style={{ left: x - f.pw - 6, top: f.top, height: f.bottom - f.top }} />
    </div>
  );
  return (
    <div className="cp-safari" style={{ left: f.pw, width: f.sw - f.pw }} aria-hidden>
      <div className="cp-island" style={{ left: 399.7 - f.pw, top: 25.7, height: s.island - 25.7 }} />
      {[0, 54, 108].map((dy) => <div key={dy} className="cp-native" style={{ left: x - f.pw, top: s.back + dy }} />)}
      <div className="cp-native" style={{ left: x - f.pw, top: 542, height: 112.7 }} />
      <div className="cp-band" style={{ left: x - f.pw - 6, top: f.top, height: f.bottom - f.top }} />
    </div>
  );
}

function Sidebar({ width, height, inset, open, onPick }: { width: number; height: number; inset: number; open: boolean; onPick: (t: string) => void }) {
  const recents = ["Duo column template", "Liquid morph timings", "Checkout confirm island", "Space map, hinge corners", "Haptics on iOS 27", "Release notes 0.5.0"];
  return (
    <nav className="cp-sidebar" data-open={open ? "" : undefined} style={{ width, height, paddingBottom: 24 + inset }} aria-hidden={!open}>
      <div className="cp-side-title">Duet</div>
      {NAV.map((it) => <button key={it.id} className="cp-side-row" data-haptic="selection" tabIndex={open ? 0 : -1} onClick={() => onPick(it.label)}>{it.icon}<span>{it.label}</span></button>)}
      <div className="cp-side-head">Recents</div>
      {recents.map((t, i) => <button key={t} className="cp-side-row" data-current={i === 0 ? "" : undefined} data-haptic="selection" tabIndex={open ? 0 : -1} onClick={() => onPick(t)}><span>{t}</span></button>)}
    </nav>
  );
}

function Seg<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="cp-knob">
      <span>{label}</span>
      <div className="cp-seg">
        {options.map(([v, t]) => <button key={String(v)} data-on={v === value ? "" : undefined} data-haptic="selection" onClick={() => onChange(v)}>{t}</button>)}
      </div>
    </div>
  );
}

function Page({ k, set, real, f, armed }: { k: Knobs; set: (p: Partial<Knobs>) => void; real: boolean; f: Frame; armed: string }) {
  return (
    <div className="cp-scroll" style={{ paddingRight: f.kind === "inline" ? C + 24 : 0, paddingBottom: f.full - f.ph }}>
      <header className="cp-head">
        <div className="cp-eyebrow">Prototype · #169</div>
        <h1>Templated column</h1>
        <p>Burger always. Key buttons while they fit, then “…” grows the full list. Burger slides this page away.</p>
      </header>
      <section className="cp-card-box">
        {real ? <div className="cp-knob"><span>Screen</span><b>{f.preview ? "Preview column (real)" : f.kind === "column" ? "Safari column (real)" : "Inline (real)"}</b></div>
          : <Seg label="Screen" value={k.screen} options={[["outer", "Outer"], ["inner", "Inner"], ["preview", "Preview"]]} onChange={(v) => set({ screen: v })} />}
        <Seg label="Key buttons" value={k.n} options={[1, 2, 3, 4, 6, 8].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ n: v })} />
        <Seg label="Live Activities" value={k.la} options={[[false, "None"], [true, "Worst case"]]} onChange={(v) => set({ la: v })} />
        <Seg label="Checkout" value={k.checkout} options={[[false, "Off"], [true, "On"]]} onChange={(v) => set({ checkout: v })} />
      </section>
      <section className="cp-product">
        <div className="cp-product-img" />
        <div>
          <div className="cp-product-name">Field Jacket</div>
          <div className="cp-dim">Olive · M · $48.00</div>
          <div className="cp-dim">{armed === "armed" ? "Tap Pay to confirm" : armed === "done" ? "Order placed" : k.checkout ? "Checkout sits in the column" : "Turn Checkout on to try the confirm"}</div>
        </div>
      </section>
      {Array.from({ length: 6 }, (_, i) => (
        <p key={i} className="cp-text">
          The column holds what the page needs on every screen: a burger for the app’s sections, then the few actions
          the developer marked as key. Where Safari’s column leaves room for only two, the second becomes “…”, and the
          rest live in the list it grows into, over the page, beside the column.
        </p>
      ))}
    </div>
  );
}

export function ColumnProto() {
  return <HapticsProvider audioFallback><Proto /></HapticsProvider>;
}
