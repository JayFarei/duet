"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, Ellipsis, Search, X } from "./icons.tsx";
import { glassTheme, themeVars, type Appearance, type DuetIcons } from "./theme.ts";
import { DUO, columnBand, isSplit, pageInsets, islandBox, magnet, morphBox, plan, stable, type Box, type Context, type Damper, type Plan, type Side, type Signals, type Spec } from "./geometry.ts";
import { emulatedSignals, epoch, readSignals, settling, watchSignals } from "./signals.ts";
import { GlassProvider } from "./glassyui/glass-provider.tsx";
import { GlassSurface } from "./glassyui/glass-surface.tsx";
import "./duet.css";

export interface DuetItem {
  id: string; label: string; icon: ReactNode; onPress?: () => void;
  /** Count or short text in a badge on the icon's page-side corner, like a native tab item's badge. */
  badge?: number | string;
  /** "alert" (default): red, for things that want attention. "neutral": grey, for plain counts like a balance. */
  badgeTone?: "alert" | "neutral";
  /** This item's accent when selected (a tab) or as the primary button. Default: the strip's `tint`. */
  tint?: string;
  /** Deletes or discards: lives only in "…", last, in red, after a separator (blueprint). */
  destructive?: boolean;
}
/** A tab: an item whose id is one of the app's tab ids. */
export type DuetTab<T extends string = string> = DuetItem & { id: T };
export interface DuetProps<T extends string = string> {
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
  /** Tab pill at the bottom of the strip. `search` adds a `role: .search` tab as the last item. The ids are typed
   *  from `items`: declare them `as const` and `onSelect` gets the union, so `setTab` fits without a cast. Each tab
   *  keeps its own scroll position, and tapping the selected tab scrolls it to the top, like a native tab bar. */
  tabs?: { items: readonly DuetTab<T>[]; selected: NoInfer<T>; onSelect: (id: NoInfer<T>) => void; search?: DuetTab<T> };
  /** Searchable without tabs: a round search button at the bottom of the strip. */
  searchButton?: () => void;
  /** A sheet or card is open: the strip holds only a close button, where back goes, like an iOS sheet. Every
   *  other control steps aside until it is cleared. */
  close?: false | { label?: string; onPress: () => void };
  /** `.tabViewBottomAccessory`, e.g. a mini player. */
  accessory?: ReactNode;
  /** `.tabBarMinimizeBehavior(.onScrollDown)`. */
  minimizeOnScroll?: boolean;
  /** Light or dark, like overrideUserInterfaceStyle. Default "auto": follow the system. Menus follow it too; in
   *  Safari's column the buttons keep following the system, so they match Safari's own. */
  appearance?: Appearance;
  /** @deprecated Use `appearance`. */
  dark?: boolean;
  /** Accent for the selected tab, the active menu item and the primary button, like iOS's tintColor. Default:
   *  the system blue. Same as `--duet-tint` in CSS. */
  tint?: string;
  /** Size, stroke weight and colour of your icons. Same as the `--duet-icon*` vars in CSS. */
  icons?: DuetIcons;
  /** How "…" and the minimized tab open their menu. "island" (default): the button stretches sideways into a
   *  pill of icons, like the Dynamic Island. "morph": the button grows into a labelled list, like a context menu. */
  menuStyle?: "island" | "morph";
  /** Page content. When given, it scrolls in an inner scroller and the document itself never moves, so
   *  the chrome (and in Safari the column layer) stays still during momentum scroll and rubber-banding. */
  children?: ReactNode;
  /** Without children, in Safari's column: Duet places the page beside the controls (default `true`). When the
   *  document spans a column on the left (a split pane, or the closed Duo turned left) the page is moved into the
   *  visible viewport with margins on `<html>`, and the insets are 0, so the page needs no padding of its own.
   *  `false` lets the page run under the column instead: it keeps clear by `--duet-inset-left/right`, through
   *  column() and bleed(). */
  reserve?: boolean;
}

// --- context ------------------------------------------------------------------------------------

/** The safe-area inset on one side as CSS: the real env() value, or the emulated one. */
const envInset = (side: Side) => { const e = emulatedSignals(); return e ? `${side === "right" ? e.insetRight : e.insetLeft}px` : `env(safe-area-inset-${side})`; };
// Inline: the side is the user's, remembered per site, and apart for split view (Safari's column is on the pane's
// outer edge, which the page cannot see, so the controls follow it once moved there).
const sideKey = (split: boolean) => split ? "duet-side-split" : "duet-side";
const preferred = new Map<string, Side | null>();
const listeners = new Set<() => void>();
/** undefined until the user moves the controls: then detect() picks the side for the context. */
function preferredSide(split: boolean): Side | undefined {
  const key = sideKey(split);
  if (!preferred.has(key)) { try { const v = localStorage.getItem(key); preferred.set(key, v === "left" || v === "right" ? v : null); } catch { preferred.set(key, null); } }
  return preferred.get(key) ?? undefined;
}
function setPreferredSide(side: Side) {
  const key = sideKey(!!snap?.split);
  preferred.set(key, side);
  try { localStorage.setItem(key, side); } catch {}
  listeners.forEach((f) => f());
}

/** Moves the inline controls to `side` in one frame: data-drag="switch" holds every transition off until the
 *  new layout has painted (CSS), so no control glides across the page on its own. */
function switchSide(el: HTMLElement, side: Side) {
  el.dataset.drag = "switch";
  setPreferredSide(side);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (el.dataset.drag === "switch") delete el.dataset.drag; }));
}

let snap: Context | null = null, snapKey = "";
const damper: Damper = { flips: [] };
let pinTimer: ReturnType<typeof setTimeout> | undefined, landTimer: ReturnType<typeof setTimeout> | undefined;
// The damper keeps history, so it is fed once per signal change (refresh, from the watcher), never from React's
// getSnapshot (read), which React may call several times per render.
function refresh() {
  const s = readSignals(), c = stable(damper, s, preferredSide(isSplit(s)), performance.now(), settling(), epoch());
  // A pin lifts on its own time, with no resize to re-read on.
  if (damper.pinned && !pinTimer) pinTimer = setTimeout(() => { pinTimer = undefined; listeners.forEach((f) => f()); }, damper.until! - performance.now() + 20);
  // So is a landing after a fold or turn (LAND_HOLD), which no resize may follow.
  if (damper.landUntil !== undefined && !landTimer) landTimer = setTimeout(() => { landTimer = undefined; listeners.forEach((f) => f()); }, damper.landUntil - performance.now() + 10);
  const k = JSON.stringify(c);
  if (k !== snapKey) [snapKey, snap] = [k, c];
}
function read(): Context {
  if (!snap) refresh();
  return snap!;
}
function subscribe(cb: () => void) {
  const f = () => { refresh(); cb(); };
  listeners.add(f);
  const unwatch = watchSignals(f);
  return () => { listeners.delete(f); unwatch(); };
}
const ssr: Context = { mode: "column", duo: true, browser: "safari", device: "duo", standalone: false, layout: "narrow", side: "right", width: 382, height: 580, stableHeight: 580, offsetTop: 0, screenWidth: 466, screenHeight: 678, insetTop: 0, insetBottom: 0 };

export function useDuet(): Context {
  return useSyncExternalStore(subscribe, read, () => ssr);
}

/** Tells the server whether this browser is an iPhone Duo, so it can render the Duo layout from the first byte.
 *  The server can't tell on its own, so it renders what the `duet-duo` cookie says (`"1"` on a Duo) and passes that
 *  as `rendered`. When the browser disagrees, this sets the cookie and calls `onChange`, by default a reload, so a
 *  new device switches layout once and never again. Renders nothing; works outside `<Duet>`. */
export function DuoCookie({ rendered, onChange = () => location.reload() }: { rendered: boolean; onChange?: (duo: boolean) => void }) {
  const { duo } = useDuet();
  // Before hydration useDuet() answers for the server (a Duo); only the browser's own answer counts.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    if (!hydrated || duo === rendered) return;
    document.cookie = duo ? "duet-duo=1; path=/; max-age=31536000; samesite=lax" : "duet-duo=; path=/; max-age=0";
    onChange(duo);
  }, [hydrated, duo, rendered]); // eslint-disable-line react-hooks/exhaustive-deps -- onChange may be a fresh arrow each render
  return null;
}
const noop = () => () => {};

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
 *  the document itself from scrolling, so the layer never moves. Without children the document scrolls, and the
 *  layer rides it on a CSS scroll timeline (duet.css, duet-follow): Safari runs that with the scroll itself, so
 *  it holds through momentum and smooth programmatic scrolls, where a transform set from scroll events lags and
 *  drifts (#55; simulator, 2026-10-26: up to 300pt during scrollIntoView, under 2pt on the timeline).
 *  The keyframe ends at the timeline's scroll range (--duet-scroll-max); a fixed 100000px range drifted ~12pt in
 *  momentum. Browsers without scroll timelines get the transform. Touches there reach the page
 *  but are not hit-tested to our elements, and Safari keeps the touch end (no pointerup, no click), so we route
 *  them by coordinates on pointerdown. Nothing in the column scrolls, so a touch there is always a tap.
 *  Split pane: the column is on the pane's outer edge, which the page cannot see, so the document spans a column
 *  on each side, scrolled 84 across, and the controls are drawn in both (refs[0] left, refs[1] right). Each pane
 *  shows only its own column, and a tap there names the side (`tapSide`). A left-hand column (closed landscape,
 *  turned left) works the same way, with the document spanning that column alone. */
let tapSide: Side = "right";
/** Without shrink-to-fit=no Safari zooms a split pane out to fit the layer's overflow, which reads as another
 *  window size and flips the mode. It applies even when set late, but must land before the first column paint.
 *  Safari reads the last viewport meta, and frameworks add their own after load (Next.js renders a second one on
 *  the client, device trace 2026-10-25), so every one is patched. */
function viewport(key: string, value: string) {
  const metas = document.querySelectorAll<HTMLMetaElement>("meta[name=viewport]");
  if (!metas.length) { const meta = document.createElement("meta"); meta.name = "viewport"; meta.content = "width=device-width,initial-scale=1"; document.head.appendChild(meta); return viewport(key, value); }
  for (const meta of metas) if (!meta.content.includes(key)) meta.content += `,${key}=${value}`;
}
if (typeof document !== "undefined") viewport("shrink-to-fit", "no");
// Leaving the column, the sideways scroll the layer pinned stays behind: from a split left pane turned into the tall
// window (inline), the document kept scrollX -84 with nothing to scroll, and Safari then painted the pill's glass but
// not its unselected tab icons (e2e round 4, splitturn-left-to90). So when the mode leaves the column (not while the
// column is only hidden mid-turn), the scroll goes back to 0, again as Safari restores the old offset on the resize.
function useColumnLayer(on: boolean, split: boolean, left: boolean, column: number, inColumn: boolean) {
  const refs = [useRef<HTMLElement>(null), useRef<HTMLElement>(null)] as const;
  const was = useRef(inColumn);
  useEffect(() => {
    const left = was.current && !inColumn;
    was.current = inColumn;
    if (!left || emulatedSignals()) return;
    const reset = () => { if (Math.round(scrollX) !== 0) scrollTo({ left: 0, top: scrollY, behavior: "instant" }); };
    const t = [0, 300, 1000].map((ms) => setTimeout(reset, ms));
    return () => t.forEach(clearTimeout);
  }, [inColumn]);
  useEffect(() => {
    const els = refs.map((r) => r.current).filter((el): el is HTMLElement => !!el);
    if (!on || !els.length) return;
    const html = document.documentElement.style, prev = html.touchAction;
    html.touchAction = "pan-y"; // the layer widens the document; keep the page from panning sideways
    const root = document.documentElement;
    for (const el of els) el.dataset.follow = "";
    // A page reset such as `* { animation: none !important }` (common under reduced motion) drops the timeline.
    const timeline = typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()") && getComputedStyle(els[0]).animationName === "duet-follow";
    if (!timeline) for (const el of els) delete el.dataset.follow;
    // The keyframe ends at the timeline's own scroll range, which in Safari is scrollHeight - innerHeight: when the
    // URL bar collapses innerHeight grows 18px but clientHeight does not, and scrollHeight - clientHeight drifted
    // 6pt 1000pt down (simulator, 2026-10-26). Content can outgrow the body (absolute, overflowing), so every
    // scroll re-measures as well as resizes.
    let max = "";
    const range = () => {
      const m = `${Math.max(0, root.scrollHeight - innerHeight)}px`;
      if (m !== max) { max = m; for (const el of els) el.style.setProperty("--duet-scroll-max", m); }
    };
    const sizes = timeline ? new ResizeObserver(range) : undefined;
    if (sizes) { range(); sizes.observe(root); sizes.observe(document.body); }
    // The layer's positions are document coordinates, from an absolute box at the document's left edge. A page whose
    // <body> (or <html>) is positioned makes that its containing block, which body margins, or the margins that move
    // the page beside a left column (pageInsets), move off the document's edge: measured, and undone with
    // `translate` (the scroll timeline animates `transform`, which composes with it).
    const align = () => {
      refs.forEach((ref, i) => {
        const el = ref.current;
        if (!el) return;
        el.style.translate = "";
        const off = Math.round(el.getBoundingClientRect().left + scrollX - (split && i ? column : 0));
        if (off) el.style.translate = `${-off}px 0`;
      });
    };
    const follow = (e?: Event) => {
      if (e?.type !== "scroll") align();
      // The layer widens the document, and a swipe that runs off the end of a sideways scroller chains to it
      // (touch-action stops at the scroller), leaving page and controls panned off their rails: hold it.
      // An emulating host already frames both columns; pinning there loops in iOS Safari, whose frame overflows a few px.
      const x = split || left ? column : 0;
      // Instant: under a page's `scroll-behavior: smooth` a plain scrollTo animates, and each scroll event restarted
      // it, so the controls crept into the column over seconds (#66, back from /probe in a split left pane).
      if (!emulatedSignals() && Math.round(scrollX) !== x) scrollTo({ left: x, top: scrollY, behavior: "instant" });
      if (timeline) range();
      else for (const el of els) el.style.transform = scrollY ? `translateY(${scrollY}px)` : "";
    };
    const tap = (e: PointerEvent) => {
      if (e.clientX >= 0 && e.clientX < innerWidth) return; // inside the viewport, normal hit-testing applies
      const el = split ? refs[e.clientX < 0 ? 0 : 1].current : refs[0].current;
      if (split) tapSide = e.clientX < 0 ? "left" : "right";
      // Skip a button that became an open menu: the menu covers it, and its own slot sits on top.
      for (const b of el?.querySelectorAll<HTMLButtonElement>(":not([data-unrolled]) > button") ?? []) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { b.click(); return; }
      }
    };
    follow();
    // Safari restores or resets the sideways scroll on load, resize and a back/forward cache restore.
    const t = [0, 300, 1000].map((ms) => setTimeout(follow, ms));
    addEventListener("scroll", follow, { passive: true });
    addEventListener("resize", follow);
    addEventListener("pageshow", follow);
    addEventListener("pointerdown", tap);
    return () => {
      html.touchAction = prev; sizes?.disconnect();
      for (const el of els) { el.style.transform = ""; el.style.translate = ""; el.style.removeProperty("--duet-scroll-max"); delete el.dataset.follow; }
      t.forEach(clearTimeout);
      removeEventListener("scroll", follow); removeEventListener("resize", follow); removeEventListener("pageshow", follow);
      removeEventListener("pointerdown", tap);
    };
  }, [on, split, left, column]); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable
  return refs;
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
      if (flip) switchSide(el, to);
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

// useLayoutEffect warns during SSR on React 18.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Duet<T extends string = string>(props: DuetProps<T>) {
  const p = props as unknown as DuetProps; // tab ids are only typed at the boundary
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
  // The first render is the server's guess (ssr) and the window geometry settles over the next second (subscribe):
  // until then the controls jump to where they belong instead of gliding in from the guess.
  const [settled, setSettled] = useState(false);
  // A back/forward cache restore keeps the old state but not the old window (a split pane, a turn), so it settles
  // afresh: the controls land where they belong instead of gliding there.
  useEffect(() => {
    let t = setTimeout(() => setSettled(true), 1100);
    const restored = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      clearTimeout(t); setSettled(false); t = setTimeout(() => setSettled(true), 1100);
    };
    addEventListener("pageshow", restored);
    return () => { clearTimeout(t); removeEventListener("pageshow", restored); };
  }, []);
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
  const spec: Spec = p.close
    ? { back: true, leading: 0, actions: 0, tabs: 0, searchButton: false, accessory: false, minimized, menuExtra: 0 }
    : {
        back: !!p.back, leading: leading.length, actions: actions.length, tabs: tabItems.length,
        searchButton: !p.tabs && !!p.searchButton, accessory: !!p.accessory, minimized,
        menuExtra: (ctx.mode === "inline" ? 1 : 0) + destructive.length, primary: !!p.primary,
      };
  // Split pane in column mode: the controls are drawn in both of Safari's possible columns (useColumnLayer).
  const split = ctx.mode === "column" && !!ctx.split, column = ctx.screenWidth - ctx.width;
  const sides: Side[] = split ? ["left", "right"] : [ctx.side];
  const planFor = (side: Side) => plan(side === ctx.side ? ctx : { ...ctx, side }, spec);
  // The copy whose column opened the menu draws it; the other copy's column is in the other pane.
  const [menuSide, setMenuSide] = useState<Side>(ctx.side);
  const inner = p.children !== undefined; // the inner scroller, which runs on under Safari's column

  const reserve = p.reserve !== false;
  useEffect(() => {
    // The page spans the window and the controls float over it; these insets are how far text and buttons keep
    // clear on each edge (layout.ts). In Safari's column the scroller runs on under the column (an emulated
    // column's frame already spans it), so the inset there is the column's width; a tab has no safe areas, so the
    // other edge is 0. Without children the document is the page, and Duet places it beside the column itself
    // (pageInsets): nothing for the page to do.
    const r = document.documentElement.style;
    // Controls hidden for good in this window (the turned preview) take no room; hidden while moving keeps the
    // last insets, so the page does not reflow twice in one turn.
    const { left, right, shift } = pageInsets({
      mode: ctx.mode, side: ctx.side, split, screenWidth: ctx.screenWidth, width: ctx.width, hiddenPreview: ctx.hidden === "preview",
      inner, emulated: !!emulatedSignals(), reserve, env: envInset,
    });
    // The document is scrolled one column across (useColumnLayer): margins on <html> move the page into the visible
    // viewport. <html>'s own margins, so the page's body margins, widths and max-widths are untouched, centred
    // content centres in the visible pane, and position: fixed (already viewport relative) is unaffected.
    r.marginLeft = shift ? `${shift}px` : "";
    r.marginRight = shift ? `${-shift}px` : "";
    document.documentElement.toggleAttribute("data-duet-reserve", !!shift);
    // --duet-edge-*: the window's insets, kept for panes, which set --duet-inset-* to their own.
    for (const [k, v] of [["right", right], ["left", left]]) { r.setProperty(`--duet-inset-${k}`, v); r.setProperty(`--duet-edge-${k}`, v); }
    // iOS blurs the top of a Home Screen web app (scroll-edge effect) without reporting a safe-area
    // inset, closed and unfolded; pages pad their top content by this much to stay sharp.
    r.setProperty("--duet-inset-top", ctx.mode === "strip" && ctx.standalone ? `${DUO.edgeBlur}px` : "0px");
    // Safari's URL pill floats below the layout viewport (the column holds nothing above the page), so the scroller
    // runs on under it like a document that scrolls, and the last content scrolls clear of it.
    r.setProperty("--duet-inset-bottom", ctx.mode === "column" ? `${Math.max(0, ctx.screenHeight - ctx.height)}px` : "0px");
    // Safari's column buttons paint over the page: a popover that reaches into the column keeps its top at or below
    // this (columnBand). Split view takes the lower of the two panes' limits, since nothing tells which pane it is.
    const bands = sides.map((side) => columnBand({ ...ctx, side }));
    r.setProperty("--duet-safe-top-column", `${Math.max(0, ...bands.map((b) => b?.top ?? 0))}px`);
    // The page's height without Safari's URL bar bouncing it mid-scroll (Context.stableHeight), like 100svh.
    r.setProperty("--duet-vh", `${ctx.stableHeight}px`);
    document.documentElement.dataset.duetMode = ctx.mode;
    document.documentElement.toggleAttribute("data-duet-emulated", !!emulatedSignals());
    document.documentElement.toggleAttribute("data-duet-split", split);
  }, [ctx.mode, ctx.side, ctx.hidden === "preview", ctx.screenWidth, ctx.screenHeight, ctx.width, ctx.height, ctx.stableHeight, split, inner, reserve]);
  useEffect(() => () => {
    const h = document.documentElement;
    h.style.marginLeft = ""; h.style.marginRight = ""; h.removeAttribute("data-duet-reserve");
  }, []);
  // Mid-turn the layer is clipped out of the document (duet.css) and lets go of the sideways scroll; the landing
  // takes it up again, scrolled one column across for a left column.
  const [nav, nav2] = useColumnLayer(ctx.mode === "column" && ctx.hidden !== "moving", split, ctx.side === "left", column, ctx.mode === "column");
  useEffect(() => {
    // Any touch outside the chrome closes an open menu, like a native context menu.
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (![nav, nav2].some((n) => n.current?.contains(e.target as Node)) && e.clientX >= 0 && e.clientX < innerWidth) setMenu(null);
    };
    addEventListener("pointerdown", close);
    return () => removeEventListener("pointerdown", close);
  }, [menu, nav, nav2]); // eslint-disable-line react-hooks/exhaustive-deps -- setMenu only reads menu
  useSideDrag(ctx.mode === "inline" ? ctx.side : null, nav, () => { setMenu(null); setScrub(null); });

  // The safe areas only reach the page with viewport-fit=cover. Set on mount, not on import, so a page that only
  // imports DuoCookie keeps its own viewport on other phones.
  useLayout(() => {
    const patch = () => { viewport("viewport-fit", "cover"); viewport("shrink-to-fit", "no"); };
    patch();
    // Keep them patched when the framework adds or rewrites a viewport meta later.
    const watch = new MutationObserver(patch);
    watch.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    return () => watch.disconnect();
  }, []);
  const selected = p.tabs?.selected;
  // Each tab keeps its own scroll position in the inner scroller; the selected tab again scrolls to the top.
  const scrolls = useRef(new Map<string, number>());
  const select = (id: string) => {
    const el = scroller.current;
    if (id === selected) el?.scrollTo({ top: 0, behavior: "smooth" });
    else { if (el && selected !== undefined) scrolls.current.set(selected, el.scrollTop); p.tabs!.onSelect(id); }
  };
  useLayout(() => { if (scroller.current && selected !== undefined) scroller.current.scrollTop = scrolls.current.get(selected) ?? 0; }, [selected]);
  const theme = themeVars(p) as CSSProperties;
  const badge = (a: DuetItem) => a.badge !== undefined && a.badge !== "" && <span className="duet-badge" data-tone={a.badgeTone === "neutral" ? "neutral" : undefined}>{a.badge}</span>;
  const tint = (a: DuetItem) => a.tint ? { "--duet-tint": a.tint } as CSSProperties : undefined;
  const item = (a: DuetItem) => <button key={a.id} className="duet-item" aria-label={a.label} onClick={a.onPress}>{a.icon}{badge(a)}</button>;
  const toggle = (m: "more" | "tabs") => () => { if (split) setMenuSide(tapSide); setMenu(menu === m ? null : m); };
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
    select(id);
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
      if (scrub !== null) { const t = tabItems[scrub]; setScrub(null); settle(); if (t) select(t.id); }
      else if (tapped) { const t = tabItems[tabAt(e.currentTarget, e.clientY)]; if (t) glideTo(t.id); }
    },
    onPointerCancel: () => { endPress(); setScrub(null); },
  };

  // Held, the rail grows for real (wider towards the page, taller upwards), not just scaled, so the labels
  // have room and clear its round ends, as Apple News and Music do.
  const swell = (b: CSSProperties & { top: number; left: number; width: number; height: number }, on: boolean, side: Side) => !on ? b
    : { ...b, top: b.top - SWELL.y, height: b.height + SWELL.y, width: b.width + SWELL.x, left: side === "right" ? b.left - SWELL.x : b.left };

  const lensAt = scrub ?? Math.max(0, tabItems.findIndex((t) => t.id === selected));

  // Menus only unroll from separate round buttons: "…" and the minimized tab.
  const anchors = (pl: Plan) => ({ more: pl.more, tabs: pl.tabs?.min ? pl.tabs : undefined });
  // A menu whose button went away mid-roll (a tab change scrolls to the top and un-minimizes the tab bar)
  // never fires its animationend; drop it, or its button stays hidden as "unrolled".
  const gone = anchors(planFor(split ? menuSide : ctx.side));
  const closingGone = (closing === "tabs" && !gone.tabs) || (closing === "more" && !gone.more);
  useEffect(() => { if (closingGone) setClosing(null); }, [closingGone]);

  // Island: icons only; the "…" island ends in a close slot where the "…" was, so the button reads as unrolled.
  // Morph: icon and label rows; a touch outside closes it, so it needs no close row.
  const morph = p.menuStyle === "morph";
  const menuEl = (kind: "more" | "tabs", anchor: Box | undefined | false, items: DuetItem[], radio: boolean, menuAt: (b: Box, n: number) => CSSProperties, morphAt: (b: Box, n: number) => CSSProperties) => {
    if ((menu !== kind && closing !== kind) || !anchor) return null;
    const close = kind === "more" && !morph, rolling = menu !== kind;
    return (
      <GlassSurface preset="control" className="duet-glass duet-menu" role="menu" data-style={morph ? "morph" : undefined}
        style={morph ? morphAt(anchor, items.length) : menuAt(anchor, items.length + (close ? 1 : 0))}
        data-closing={rolling || undefined} onAnimationEnd={(e) => { if (rolling && (e.animationName === "duet-roll" || e.animationName === "duet-unmorph")) setClosing(null); }}>
        {items.map((a, i) => (
          <button key={a.id} role={radio ? "menuitemradio" : "menuitem"} aria-checked={radio ? a.id === selected : undefined} aria-label={a.label}
            className="duet-menu-item" data-on={(radio && a.id === selected) || undefined} data-destructive={a.destructive || undefined}
            data-sep={(a.destructive && i > 0 && !items[i - 1].destructive) || undefined} data-tint={a.tint ? "" : undefined} style={{ ...tint(a), ...(rolling ? undefined : { animationDelay: `${morph ? 0.06 + 0.025 * i : 0.05 + 0.035 * (items.length - i)}s` }) }}
            onClick={() => { setMenu(null); if (radio) select(a.id); else a.onPress?.(); }}>{a.icon}{morph && <span className="duet-menu-label">{a.label}</span>}{badge(a)}</button>
        ))}
        {close && <button className="duet-menu-item" aria-label="Close" onClick={() => setMenu(null)}><X size={20} /></button>}
      </GlassSurface>
    );
  };

  const bar = (side: Side, i: number) => {
    const pl = planFor(side), left = side === "left", anchor = anchors(pl);
    const at = (b: Box) => ({ top: b.top, left: pl.left, width: DUO.control, height: b.height });
    // A menu is the button that opens it unrolling sideways, like the Dynamic Island: a pill of icon slots
    // as tall as the button, outer edge on the button's, widening towards the page centre only.
    const menuAt = (b: Box, n: number) => {
      const { x0, ...box } = islandBox(pl, b, n, side);
      return { ...box, "--x0": `${x0}px` } as CSSProperties;
    };
    // Morph: the button grows into a labelled list, clear of Safari's column buttons (morphBox).
    const morphAt = (b: Box, n: number) => {
      const { x0, y0, scroll, ...box } = morphBox(side === ctx.side ? ctx : { ...ctx, side }, pl, b, n);
      return { ...box, "--x0": `${x0}px`, "--y0": `${y0}px`, ...(scroll && { overflowY: "auto", overscrollBehavior: "contain" }) } as CSSProperties;
    };
    const shownLeading = leading.slice(0, leading.length - pl.menu.leading);
    const shownActions = actions.slice(0, actions.length - pl.menu.actions);
    const more: DuetItem[] = [
      ...(pl.menu.primary && p.primary ? [p.primary] : []),
      ...(pl.menu.back && p.back ? [{ id: "duet-back", label: p.back.label ?? "Back", icon: <ChevronLeft size={20} />, onPress: p.back.onPress }] : []),
      ...leading.slice(shownLeading.length), ...actions.slice(shownActions.length),
      ...(ctx.mode === "inline" ? [{ id: "duet-side", label: `Move controls ${left ? "right" : "left"}`, icon: <ArrowLeftRight size={20} />, onPress: () => {
        // The menu goes at once, without rolling back into "…": its button is about to move, and would stay hidden
        // as "unrolled" until a roll that no longer lines up with it.
        setMenuNow(null); setClosing(null); setScrub(null);
        if (nav.current) switchSide(nav.current, left ? "right" : "left");
      } }] : []),
      ...destructive,
    ];
    return (
      <nav key={side} ref={i ? nav2 : nav} className="duet" data-mode={ctx.mode} data-side={side} data-settling={!settled || ctx.confidence !== "sure" || undefined} data-hidden={ctx.hidden} data-confidence={ctx.confidence} data-keyboard={ctx.keyboard || undefined} style={{ ...theme, ...(split && i ? { left: column } : undefined) }}>
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
          <GlassSurface preset="control" className="duet-glass duet-pill" data-duet-slot="tabs" role="tablist" style={{ ...swell(at(pl.tabs), scrub !== null && !pl.tabs.min, side), "--li": lensAt } as CSSProperties} data-min={pl.tabs.min || undefined}
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
        {(!split || side === menuSide) && menuEl("more", anchor.more, more, false, menuAt, morphAt)}
        {p.tabs && (!split || side === menuSide) && menuEl("tabs", anchor.tabs, tabItems, true, menuAt, morphAt)}
        {/* The tab island unrolls across the accessory's row; the accessory steps aside while it is open. */}
        {p.accessory && pl.accessory && !i && (
          <GlassSurface preset="control" className="duet-glass duet-accessory" data-duet-slot="accessory" style={pl.accessory}
            data-covered={menu === "tabs" || undefined}>{p.accessory}</GlassSurface>
        )}
      </nav>
    );
  };

  return (
    <GlassProvider defaultTheme={glassTheme(p.appearance, p.dark)}>
      {p.children !== undefined && <div ref={scroller} className="duet-scroller">{p.children}</div>}
      {sides.map(bar)}
      {/* On the viewport edge that faces Safari's column, so a page's full-screen overlay cannot hide it (duet.css). */}
      {ctx.mode === "column" && !emulatedSignals() && sides.map((side) => <span key={side} className="duet-guard" data-side={side} aria-hidden />)}
    </GlassProvider>
  );
}
