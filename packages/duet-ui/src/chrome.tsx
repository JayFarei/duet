"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, Ellipsis, Search, X } from "./icons.tsx";
import { DUO, INLINE_WIDTH, ISLAND, MORPH, magnet, plan, stable, type Box, type Context, type Damper, type Side, type Signals } from "./geometry.ts";
import { GlassProvider } from "./glassyui/glass-provider.tsx";
import { GlassSurface } from "./glassyui/glass-surface.tsx";
import "./duet.css";

export interface DuetItem {
  id: string; label: string; icon: ReactNode; onPress?: () => void;
  /** Count or short text in a red badge on the icon's page-side corner, like a native tab item's badge. */
  badge?: number | string;
  /** Colour of the icon and selection when this tab is selected. Default: the system blue. */
  tint?: string;
  /** Deletes or discards: lives only in "…", last, in red, after a separator (blueprint). */
  destructive?: boolean;
}
export interface DuetProps {
  /** Back button, top of the strip. */
  back?: false | { label?: string; onPress: () => void };
  /** SwiftUI `.topBarLeading`: its own group under back. */
  leading?: DuetItem[];
  /** SwiftUI `.primaryAction`: collapses into "…" when it would hit the tab pill. Destructive items always
   *  go in "…". */
  actions?: DuetItem[];
  /** The screen's main action (New chat, Compose), a tinted round button: by the thumb above the tabs where one
   *  pane shows, at the top under back where two do. */
  primary?: DuetItem;
  /** Tab pill at the bottom of the strip. `search` adds a `role: .search` tab as the last item. */
  tabs?: { items: DuetItem[]; selected: string; onSelect: (id: string) => void; search?: DuetItem };
  /** Searchable without tabs: a round search button at the bottom of the strip. */
  searchButton?: () => void;
  /** A sheet or card is open: the strip holds only a close button, where back goes, like an iOS sheet. Every
   *  other control steps aside until it is cleared. */
  close?: false | { label?: string; onPress: () => void };
  /** `.tabViewBottomAccessory`, e.g. a mini player. */
  accessory?: ReactNode;
  /** `.tabBarMinimizeBehavior(.onScrollDown)`. */
  minimizeOnScroll?: boolean;
  /** Force a theme. Default: follow the system light/dark setting. */
  dark?: boolean;
  /** How "…" and the minimized tab open their menu. "island" (default): the button stretches sideways into a
   *  pill of icons, like the Dynamic Island. "morph": the button grows into a labelled list, like a context menu. */
  menuStyle?: "island" | "morph";
  /** Page content. When given, it scrolls in an inner scroller and the document itself never moves, so
   *  the chrome (and in Safari the column layer) stays still during momentum scroll and rubber-banding. */
  children?: ReactNode;
}

// --- context ------------------------------------------------------------------------------------

// A desktop page that draws a Duo around this page in an iframe (the site's web Duo) sends the signals the
// real device would give: `postMessage({ type: "duet:signals", signals }, origin)`. Same origin only. The page
// says `duet:ready` once it listens, so the host answers then instead of guessing when the page has loaded.
let emulated: Signals | null = null;
if (typeof window !== "undefined" && window.top !== window) {
  addEventListener("message", (e: MessageEvent) => {
    if (e.source !== parent || e.origin !== location.origin || e.data?.type !== "duet:signals") return;
    emulated = e.data.signals as Signals;
    listeners.forEach((f) => f());
  });
  parent.postMessage({ type: "duet:ready" }, location.origin);
}
/** The safe-area inset on one side as CSS: the real env() value, or the emulated one. */
const envInset = (side: Side) => emulated ? `${side === "right" ? emulated.insetRight : emulated.insetLeft}px` : `env(safe-area-inset-${side})`;

let probe: HTMLDivElement | null = null;
function signals(): Signals {
  if (emulated) return emulated;
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
  }
  const pad = getComputedStyle(probe);
  return {
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    outerWidth: outerWidth,
    outerHeight: outerHeight,
    visualHeight: visualViewport?.height ?? innerHeight,
    insetTop: parseFloat(pad.paddingTop) || 0,
    insetBottom: parseFloat(pad.paddingBottom) || 0,
    screenWidth: innerWidth > innerHeight ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height),
    screenHeight: innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height),
    insetRight: parseFloat(pad.paddingRight) || 0,
    insetLeft: parseFloat(pad.paddingLeft) || 0,
    framed: window.top !== window,
    pixelRatio: devicePixelRatio,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches,
  };
}
// Inline (split view, landscape): the side is the user's, remembered per site.
const SIDE_KEY = "duet-side";
let preferred: Side | null | undefined;
const listeners = new Set<() => void>();
/** null until the user moves the controls: then detect() picks the side for the context. */
function preferredSide(): Side | undefined {
  if (preferred === undefined) { try { const v = localStorage.getItem(SIDE_KEY); preferred = v === "left" || v === "right" ? v : null; } catch { preferred = null; } }
  return preferred ?? undefined;
}
function setPreferredSide(side: Side) {
  preferred = side;
  try { localStorage.setItem(SIDE_KEY, side); } catch {}
  listeners.forEach((f) => f());
}

let snap: Context | null = null, snapKey = "";
const damper: Damper = { flips: [] };
function read(): Context {
  const c = stable(damper, signals(), preferredSide(), performance.now());
  const k = JSON.stringify(c);
  if (k !== snapKey) [snapKey, snap] = [k, c];
  return snap!;
}
function subscribe(cb: () => void) {
  // Safe-area insets and outerWidth settle up to ~400ms after resize and rotation.
  const on = () => { cb(); setTimeout(cb, 300); setTimeout(cb, 600); };
  addEventListener("resize", on);
  addEventListener("orientationchange", on);
  visualViewport?.addEventListener("resize", on);
  // A fresh Safari tab can hydrate before its window geometry settles, with no resize afterwards.
  const t = [0, 300, 1000].map((ms) => setTimeout(cb, ms));
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    t.forEach(clearTimeout);
    removeEventListener("resize", on); removeEventListener("orientationchange", on);
    visualViewport?.removeEventListener("resize", on);
  };
}
const ssr: Context = { mode: "column", duo: true, layout: "narrow", side: "right", width: 382, height: 580, offsetTop: 0, screenWidth: 466, screenHeight: 678, insetTop: 0, insetBottom: 0 };

export function useDuet(): Context {
  return useSyncExternalStore(subscribe, read, () => ssr);
}

function useMinimized(on: boolean, scroller: React.RefObject<HTMLDivElement | null>) {
  const [min, setMin] = useState(false);
  useEffect(() => {
    if (!on) return;
    // Captured, so a scroll inside the page (a pane of <DuetPanes>) counts as well as the scroller's own; each
    // scrolling element keeps its own last position.
    const target = scroller.current ?? window, last = new WeakMap<object, number>();
    const f = (e: Event) => {
      const el = e.target instanceof Element ? e.target : null, y = el ? el.scrollTop : scrollY, key = el ?? window;
      const d = y - (last.get(key) ?? 0);
      if (Math.abs(d) > 8) { setMin(d > 0 && y > 40); last.set(key, y); }
    };
    target.addEventListener("scroll", f, { passive: true, capture: true });
    return () => target.removeEventListener("scroll", f, { capture: true });
  }, [on, scroller]);
  return on && min;
}

/** Safari tab: fixed content is clipped to the page viewport (so is sticky), but in-document content paints
 *  into Safari's column. So the chrome is an absolute layer at the document top, and the inner scroller keeps
 *  the document itself from scrolling, so the layer never moves. A scroll-driven transform lags momentum
 *  scrolling and drifts (issue #1); `follow` only covers pages without the scroller. Touches there reach the page
 *  but are not hit-tested to our elements, and Safari keeps the touch end (no pointerup, no click), so we route
 *  them by coordinates on pointerdown. Nothing in the column scrolls, so a touch there is always a tap. */
function useColumnLayer(on: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const html = document.documentElement.style, prev = html.touchAction;
    html.touchAction = "pan-y"; // the layer widens the document; keep the page from panning sideways
    const follow = () => { el.style.transform = scrollY ? `translateY(${scrollY}px)` : ""; };
    const tap = (e: PointerEvent) => {
      if (e.clientX < innerWidth) return; // inside the viewport, normal hit-testing applies
      // Skip a button that became an open menu: the menu covers it, and its own slot sits on top.
      for (const b of el.querySelectorAll<HTMLButtonElement>(":not([data-unrolled]) > button")) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { b.click(); return; }
      }
    };
    follow();
    addEventListener("scroll", follow, { passive: true });
    addEventListener("pointerdown", tap);
    return () => {
      html.touchAction = prev; el.style.transform = "";
      removeEventListener("scroll", follow); removeEventListener("pointerdown", tap);
    };
  }, [on]);
  return ref;
}

/** Inline: drag any control across the middle of the page to move the strip to that side. The controls
 *  follow the finger (--duet-drag); a drag never becomes a tap. */
function useSideDrag(side: Side | null, nav: React.RefObject<HTMLElement | null>, onStart: () => void) {
  useEffect(() => {
    const el = nav.current;
    if (!side || !el) return;
    let x0: number | null = null, y0 = 0, dragging = false, free = false;
    const down = (e: PointerEvent) => { if ((e.target as Element).closest(".duet-glass:not(.duet-menu)")) { x0 = e.clientX; y0 = e.clientY; dragging = false; } };
    const move = (e: PointerEvent) => {
      if (x0 === null) return;
      // Only a deliberate sideways swipe picks the strip up: a scrub along the rail, or a wobbly tap, never does.
      const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
      if (!dragging && dy > 12 && dy > dx) { x0 = null; return; }
      if (!dragging && dx > 24 && dx > 2 * dy) { dragging = true; onStart(); }
      if (!dragging) return;
      const m = magnet(side, e.clientX - x0);
      if (m.free !== free) { free = m.free; el.dataset.drag = free ? "free" : "held"; }
      el.style.setProperty("--duet-drag", `${m.offset}px`);
    };
    const up = (e: PointerEvent) => {
      if (x0 === null) return;
      x0 = null;
      const to: Side = e.clientX < innerWidth / 2 ? "left" : "right";
      const flip = dragging && free && to !== side;
      if (flip) el.dataset.drag = "switch"; else delete el.dataset.drag;
      el.style.removeProperty("--duet-drag");
      if (flip) { setPreferredSide(to); requestAnimationFrame(() => delete el.dataset.drag); }
      free = false;
    };
    const click = (e: MouseEvent) => { if (dragging) { e.stopPropagation(); e.preventDefault(); dragging = false; } };
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down); removeEventListener("pointermove", move);
      removeEventListener("pointerup", up); removeEventListener("pointercancel", up); el.removeEventListener("click", click, true);
    };
  }, [side, nav]); // eslint-disable-line react-hooks/exhaustive-deps -- onStart only resets menu and scrub state
}

// --- rendering ----------------------------------------------------------------------------------

export function Duet(p: DuetProps) {
  const ctx = useDuet();
  const scroller = useRef<HTMLDivElement>(null);
  const minimized = useMinimized(!!p.minimizeOnScroll, scroller);
  const [menu, setMenuNow] = useState<"more" | "tabs" | null>(null);
  // The menu that is rolling back into its button; it stays mounted until its animation ends.
  const [closing, setClosing] = useState<"more" | "tabs" | null>(null);
  // Index of the tab under the finger while scrubbing the full pill, like Apple News' tab bar.
  const [scrub, setScrub] = useState<number | null>(null);
  // A touch on the full pill is a tap until it is held or dragged; only then does the pill swell into a scrub.
  const press = useRef<{ y0: number; y: number; timer: number } | null>(null);
  // A tap glides the lens to the new tab as a clear magnifier, without swelling the pill, like Apple News.
  const [glide, setGlide] = useState(false);
  const glideTimer = useRef(0);
  useEffect(() => () => { clearTimeout(glideTimer.current); if (press.current) clearTimeout(press.current.timer); }, []);
  const setMenu = (n: "more" | "tabs" | null) => {
    if (menu && menu !== n) setClosing(matchMedia("(prefers-reduced-motion: reduce)").matches ? null : menu);
    if (n && closing === n) setClosing(null);
    setMenuNow(n);
  };
  const actions = (p.actions ?? []).filter((a) => !a.destructive), destructive = (p.actions ?? []).filter((a) => a.destructive);
  const leading = p.leading ?? [];
  const tabItems = p.tabs ? [...p.tabs.items, ...(p.tabs.search ? [p.tabs.search] : [])] : [];
  const pl = plan(ctx, p.close
    ? { back: true, leading: 0, actions: 0, tabs: 0, searchButton: false, accessory: false, minimized, menuExtra: 0 }
    : {
        back: !!p.back, leading: leading.length, actions: actions.length, tabs: tabItems.length,
        searchButton: !p.tabs && !!p.searchButton, accessory: !!p.accessory, minimized,
        menuExtra: (ctx.mode === "inline" ? 1 : 0) + destructive.length, primary: !!p.primary,
      });
  const left = ctx.side === "left";

  useEffect(() => {
    // The page spans the window and the controls float over it; these insets are how far text and buttons keep
    // clear on each edge (layout.ts). In Safari's column the scroller runs on under the column (an emulated
    // column's frame already spans it), so either way the inset there is the column's width.
    const r = document.documentElement.style;
    const inset = ctx.mode === "strip" ? envInset(ctx.side) : ctx.mode === "inline" ? `${INLINE_WIDTH}px` : `${ctx.screenWidth - ctx.width}px`;
    const right = ctx.side === "right" ? inset : envInset("right"), left = ctx.side === "left" ? inset : envInset("left");
    // --duet-edge-*: the window's insets, kept for panes, which set --duet-inset-* to their own.
    for (const [k, v] of [["right", right], ["left", left]]) { r.setProperty(`--duet-inset-${k}`, v); r.setProperty(`--duet-edge-${k}`, v); }
    // iOS blurs the top of a Home Screen web app (scroll-edge effect) without reporting a safe-area
    // inset, closed and unfolded; pages pad their top content by this much to stay sharp.
    r.setProperty("--duet-inset-top", ctx.mode === "strip" ? `${DUO.edgeBlur}px` : "0px");
    document.documentElement.dataset.duetMode = ctx.mode;
    document.documentElement.toggleAttribute("data-duet-emulated", !!emulated);
  }, [ctx.mode, ctx.side, ctx.screenWidth, ctx.width]);
  const nav = useColumnLayer(ctx.mode === "column");
  useEffect(() => {
    // Any touch outside the chrome closes an open menu, like a native context menu.
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!nav.current?.contains(e.target as Node) && e.clientX < innerWidth) setMenu(null); };
    addEventListener("pointerdown", close);
    return () => removeEventListener("pointerdown", close);
  }, [menu, nav]); // eslint-disable-line react-hooks/exhaustive-deps -- setMenu only reads menu
  useSideDrag(ctx.mode === "inline" ? ctx.side : null, nav, () => { setMenu(null); setScrub(null); });

  const at = (b: Box) => ({ top: b.top, left: pl.left, width: DUO.control, height: b.height });
  // A menu is the button that opens it unrolling sideways, like the Dynamic Island: a pill of icon slots
  // as tall as the button, outer edge on the button's, widening towards the page centre only.
  const menuAt = (b: Box, n: number) => {
    const w = 2 * ISLAND.pad + n * ISLAND.item;
    return { top: b.top + b.height / 2 - DUO.control / 2, left: left ? pl.left : pl.left + DUO.control - w, width: w, height: DUO.control, "--x0": `${pl.left}px` } as CSSProperties;
  };
  // Morph: the button grows into a labelled list, outer edge on the button's, top on its top; opening upwards
  // instead when the list would run off the bottom of the screen.
  const morph = p.menuStyle === "morph";
  const morphAt = (b: Box, n: number) => {
    const w = MORPH.width, h = 2 * MORPH.pad + n * MORPH.row, y0 = b.top + b.height / 2 - DUO.control / 2;
    const top = y0 + h > ctx.height - MORPH.pad ? Math.max(MORPH.pad, y0 + DUO.control - h) : y0;
    return { top, left: left ? pl.left : pl.left + DUO.control - w, width: w, height: h, "--x0": `${pl.left}px`, "--y0": `${y0}px` } as CSSProperties;
  };
  const shownLeading = leading.slice(0, leading.length - pl.menu.leading);
  const shownActions = actions.slice(0, actions.length - pl.menu.actions);
  const more: DuetItem[] = [
    ...(pl.menu.back && p.back ? [{ id: "duet-back", label: p.back.label ?? "Back", icon: <ChevronLeft size={20} />, onPress: p.back.onPress }] : []),
    ...leading.slice(shownLeading.length), ...actions.slice(shownActions.length),
    ...(ctx.mode === "inline" ? [{ id: "duet-side", label: `Move controls ${left ? "right" : "left"}`, icon: <ArrowLeftRight size={20} />, onPress: () => setPreferredSide(left ? "right" : "left") }] : []),
    ...destructive,
  ];
  const selected = p.tabs?.selected;
  const badge = (a: DuetItem) => a.badge !== undefined && a.badge !== "" && <span className="duet-badge">{a.badge}</span>;
  const tint = (a: DuetItem) => a.tint ? { "--duet-tint": a.tint } as CSSProperties : undefined;
  const item = (a: DuetItem) => <button key={a.id} className="duet-item" aria-label={a.label} onClick={a.onPress}>{a.icon}{badge(a)}</button>;
  const toggle = (m: "more" | "tabs") => () => setMenu(menu === m ? null : m);
  const backButton = p.back && <button className="duet-item" aria-label={p.back.label ?? "Back"} onClick={p.back.onPress}><ChevronLeft size={24} strokeWidth={2.2} /></button>;
  const moreButton = <button className="duet-item" aria-label="More" aria-expanded={menu === "more"} onClick={toggle("more")}><Ellipsis size={22} /></button>;
  const searchButton = <button className="duet-item" aria-label="Search" onClick={p.searchButton}><Search size={22} /></button>;
  // Minimized, the selected tab opens the full list, like tapping a minimized native tab bar. In the full
  // pill a touch selects on release (scrub below); clicks still select for keyboards and routed column taps.
  const tabButton = (t: DuetItem, min: boolean, i: number) => (
    <button key={t.id} role="tab" aria-selected={t.id === selected} aria-label={t.label} className="duet-tab"
      data-on={(scrub === null ? t.id === selected : scrub === i) || undefined}
      data-tint={t.tint ? "" : undefined} style={{ ...tint(t), "--j": i } as CSSProperties}
      onClick={(e) => { if (min) toggle("tabs")(); else if (scrub === null && e.detail === 0) glideTo(t.id); }}>{t.icon}{min && badge(t)}</button>
  );
  // The lens keeps its glass while it travels or settles, then melts back into the selection.
  const settle = () => {
    setGlide(true);
    clearTimeout(glideTimer.current);
    glideTimer.current = window.setTimeout(() => setGlide(false), 420);
  };
  const glideTo = (id: string) => {
    if (id !== selected) settle();
    p.tabs!.onSelect(id);
  };
  // Scrub: holding or dragging on the full pill swells it and shows labels; a lens follows the finger over the
  // tabs and the tab under it lights up; lifting selects it. A quick tap just glides the lens to the tab.
  // Pointer capture keeps the drag even off the pill.
  const HOLD_MS = 250, SLOP = 8, SWELL = { x: 16, y: 12 };
  const endPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  const tabAt = (pill: HTMLElement, y: number) => {
    const tabs = [...pill.querySelectorAll<HTMLElement>(":scope > .duet-tab")];
    let best = 0;
    tabs.forEach((b, i) => { const r = b.getBoundingClientRect(); if (y >= r.top) best = i; });
    return best;
  };
  const scrubbing = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button) return;
      const pill = e.currentTarget;
      pill.setPointerCapture(e.pointerId);
      endPress();
      const timer = window.setTimeout(() => { if (press.current) setScrub(tabAt(pill, press.current.y)); }, HOLD_MS);
      press.current = { y0: e.clientY, y: e.clientY, timer };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (press.current) press.current.y = e.clientY;
      if (scrub !== null) setScrub(tabAt(e.currentTarget, e.clientY));
      else if (press.current && Math.abs(e.clientY - press.current.y0) > SLOP) { clearTimeout(press.current.timer); setScrub(tabAt(e.currentTarget, e.clientY)); }
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const tapped = press.current && scrub === null;
      endPress();
      if (scrub !== null) { const t = tabItems[scrub]; setScrub(null); settle(); if (t) p.tabs!.onSelect(t.id); }
      else if (tapped) { const t = tabItems[tabAt(e.currentTarget, e.clientY)]; if (t) glideTo(t.id); }
    },
    onPointerCancel: () => { endPress(); setScrub(null); },
  };

  // Held, the rail grows for real (wider towards the page, taller upwards), not just scaled, so the labels
  // have room and clear its round ends, as Apple News and Music do.
  const swell = (b: ReturnType<typeof at>, on: boolean) => !on ? b
    : { ...b, top: b.top - SWELL.y, height: b.height + SWELL.y, width: b.width + SWELL.x, left: ctx.side === "right" ? b.left - SWELL.x : b.left };

  const lensAt = scrub ?? Math.max(0, tabItems.findIndex((t) => t.id === selected));

  // Menus only unroll from separate round buttons: "…" and the minimized tab.
  const moreAnchor = pl.more;
  const tabsAnchor = pl.tabs?.min ? pl.tabs : undefined;
  // A menu whose button went away mid-roll (a tab change scrolls to the top and un-minimizes the tab bar)
  // never fires its animationend; drop it, or its button stays hidden as "unrolled".
  const closingGone = (closing === "tabs" && !tabsAnchor) || (closing === "more" && !moreAnchor);
  useEffect(() => { if (closingGone) setClosing(null); }, [closingGone]);

  // Island: icons only; the "…" island ends in a close slot where the "…" was, so the button reads as unrolled.
  // Morph: icon and label rows; a touch outside closes it, so it needs no close row.
  const menuEl = (kind: "more" | "tabs", anchor: Box | undefined | false, items: DuetItem[], radio: boolean) => {
    if ((menu !== kind && closing !== kind) || !anchor) return null;
    const close = kind === "more" && !morph, rolling = menu !== kind;
    return (
      <GlassSurface preset="control" className="duet-glass duet-menu" role="menu" data-style={morph ? "morph" : undefined}
        style={morph ? morphAt(anchor, items.length) : menuAt(anchor, items.length + (close ? 1 : 0))}
        data-closing={rolling || undefined} onAnimationEnd={(e) => { if (rolling && (e.animationName === "duet-roll" || e.animationName === "duet-unmorph")) setClosing(null); }}>
        {items.map((a, i) => (
          <button key={a.id} role={radio ? "menuitemradio" : "menuitem"} aria-checked={radio ? a.id === selected : undefined} aria-label={a.label}
            className="duet-menu-item" data-on={(radio && a.id === selected) || undefined} data-destructive={a.destructive || undefined}
            data-sep={(a.destructive && i > 0 && !items[i - 1].destructive) || undefined} data-tint={a.tint ? "" : undefined} style={{ ...tint(a), ...(rolling ? undefined : { animationDelay: `${morph ? 0.12 + 0.04 * i : 0.14 + 0.06 * (items.length - i)}s` }) }}
            onClick={() => { setMenu(null); if (radio) p.tabs!.onSelect(a.id); else a.onPress?.(); }}>{a.icon}{morph && <span className="duet-menu-label">{a.label}</span>}{badge(a)}</button>
        ))}
        {close && <button className="duet-menu-item" aria-label="Close" onClick={() => setMenu(null)}><X size={20} /></button>}
      </GlassSurface>
    );
  };

  return (
    <GlassProvider defaultTheme={p.dark === undefined ? undefined : p.dark ? "dark" : "light"}>
      {p.children !== undefined && <div ref={scroller} className="duet-scroller">{p.children}</div>}
      <nav ref={nav} className="duet" data-mode={ctx.mode} data-side={ctx.side}>
        {p.close && pl.back && (
          <GlassSurface preset="control" className="duet-glass duet-round duet-close" data-duet-slot="close" style={at(pl.back)}>
            <button className="duet-item" aria-label={p.close.label ?? "Close"} onClick={p.close.onPress}><X size={22} strokeWidth={2.2} /></button>
          </GlassSurface>
        )}
        {!p.close && p.back && pl.back && <GlassSurface preset="control" className="duet-glass duet-round" data-duet-slot="back" style={at(pl.back)}>{backButton}</GlassSurface>}
        {!p.close && p.primary && pl.primary && (
          <GlassSurface preset="control" className="duet-glass duet-round duet-primary" data-duet-slot="primary" style={{ ...at(pl.primary), ...tint(p.primary) }}>{item(p.primary)}</GlassSurface>
        )}
        {pl.leading && <GlassSurface preset="control" className="duet-glass duet-group" data-duet-slot="leading" style={at(pl.leading)}>{shownLeading.map(item)}</GlassSurface>}
        {pl.actions && <GlassSurface preset="control" className="duet-glass duet-group" data-duet-slot="actions" style={at(pl.actions)}>{shownActions.map(item)}</GlassSurface>}
        {!p.close && pl.more && more.length > 0 && <GlassSurface preset="control" className="duet-glass duet-round" data-duet-slot="more" style={at(pl.more)} data-unrolled={menu === "more" || closing === "more" || undefined}>{moreButton}</GlassSurface>}
        {p.tabs && pl.tabs && (
          <GlassSurface preset="control" className="duet-glass duet-pill" data-duet-slot="tabs" role="tablist" style={{ ...swell(at(pl.tabs), scrub !== null && !pl.tabs.min), "--li": lensAt } as CSSProperties} data-min={pl.tabs.min || undefined}
            data-scrub={scrub !== null || undefined} data-glide={(glide && scrub === null) || undefined} data-unrolled={menu === "tabs" || closing === "tabs" || undefined} {...(pl.tabs.min ? {} : scrubbing)}>
            {!pl.tabs.min && (
              // The lens magnifies a copy of the tab column, slid so it lines up with the real one; the real tabs
              // are masked out under the lens (CSS), so only the enlarged copy shows through it.
              <span className="duet-lens" aria-hidden><span className="duet-lens-view"><span className="duet-lens-col">
                {tabItems.map((t, i) => <span key={t.id} className="duet-tab" data-on={i === lensAt || undefined} style={tint(t)}>{t.icon}</span>)}
              </span></span></span>
            )}
            {/* Full-pill badges ride above the lens, so it neither clips nor hides them. */}
            {!pl.tabs.min && <span className="duet-pill-badges" aria-hidden>{tabItems.map((t) => <span key={t.id}>{badge(t)}</span>)}</span>}
            {pl.tabs.min ? tabItems.filter((t) => t.id === selected).map((t) => tabButton(t, true, 0)) : tabItems.map((t, i) => tabButton(t, false, i))}
          </GlassSurface>
        )}
        {pl.searchButton && <GlassSurface preset="control" className="duet-glass duet-round" data-duet-slot="search" style={at(pl.searchButton)}>{searchButton}</GlassSurface>}
        {menuEl("more", moreAnchor, more, false)}
        {p.tabs && menuEl("tabs", tabsAnchor, tabItems, true)}
        {/* The tab island unrolls across the accessory's row; the accessory steps aside while it is open. */}
        {p.accessory && pl.accessory && (
          <GlassSurface preset="control" className="duet-glass duet-accessory" data-duet-slot="accessory" style={pl.accessory}
            data-covered={menu === "tabs" || undefined}>{p.accessory}</GlassSurface>
        )}
      </nav>
    </GlassProvider>
  );
}
