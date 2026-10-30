"use client";

import { Fragment, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ArrowLeftRight, Ellipsis, Menu, X } from "./icons.tsx";
import { glassTheme, themeVars, type Appearance, type DuetIcons } from "./theme.ts";
import { DUO, columnBand, controlsShown, isSplit, pageInsets, magnet, stable, type Context, type Damper, type Side, type Signals } from "./geometry.ts";
import { CLEAR_MS, GROUP, MORPH_CLOSE, MORPH_OPEN, SLIDE, TEMPLATE, frame, lead, menuBox, confirmBox, primaryTap, template, type Rect, type Slot } from "./template.ts";
import { emulatedSignals, epoch, readSignals, settling, watchSignals } from "./signals.ts";
import { unboot } from "./boot.ts";
import { GlassProvider } from "./glassyui/glass-provider.tsx";
import "./duet.css";

export interface DuetItem {
  id: string; label: string; icon: ReactNode; onPress?: () => void;
  /** Count or short text in a badge on the icon's page-side corner. */
  badge?: number | string;
  /** "alert" (default): red, for things that want attention. "neutral": grey, for plain counts like a balance. */
  badgeTone?: "alert" | "neutral";
  /** This item's accent as the primary. Default: the strip's `tint`. */
  tint?: string;
  /** Deletes or discards: lives only in "…", last, in red (blueprint). */
  destructive?: boolean;
  /** Lives in "…" even where the column has room for it, after the actions that folded for room. */
  folded?: boolean;
}
/** The page's call to action (Pay $48.00), a tinted button in the controls showing its icon. A tap grows it into a box
 *  beside the column, its label over a `confirm` button (default: the label) that calls onPress and collapses the box
 *  back into the button. `confirm: false`: one tap, no box. */
export type DuetPrimary = DuetItem & { confirm?: string | false };
/** A place in the app, listed in the sidebar the burger opens. */
export interface DuetMenuItem<T extends string = string> {
  id: T; label: string; icon?: ReactNode;
  badge?: number | string; badgeTone?: "alert" | "neutral";
}
export interface DuetProps<T extends string = string> {
  /** The app's places: the burger, first in the column, opens them in a sidebar and slides the page aside. The ids are
   *  typed from `items`: declare them `as const` and `onSelect` gets the union. Each place keeps its own scroll
   *  position in the inner scroller. In the in-app preview (one button of room), or with `burger: false`, they lead "…"
   *  under "Menu" instead. */
  menu?: { items: readonly DuetMenuItem<T>[]; selected?: NoInfer<T>; onSelect: (id: NoInfer<T>) => void; burger?: boolean };
  /** The page's actions: shown after the burger while they fit, the rest in "…". Destructive and folded items are
   *  always in "…". */
  actions?: DuetItem[];
  /** The page's call to action: its own tinted capsule while the column has room, else in "…". */
  primary?: DuetPrimary;
  /** A sheet or card is open: the column holds only a close button, like an iOS sheet. Every other control steps
   *  aside until it is cleared. */
  close?: false | { label?: string; onPress: () => void };
  /** Light or dark, like overrideUserInterfaceStyle. Default "auto": follow the system. Menus follow it too; in
   *  Safari's column the capsules keep following the system, so they match Safari's own. */
  appearance?: Appearance;
  /** @deprecated Use `appearance`. */
  dark?: boolean;
  /** Accent for the primary and the selected place, like iOS's tintColor. Default: the system blue. Same as
   *  `--duet-tint` in CSS. */
  tint?: string;
  /** Size, stroke weight and colour of your icons. Same as the `--duet-icon*` vars in CSS. */
  icons?: DuetIcons;
  /** Page content. When given, it scrolls in an inner scroller and the document itself never moves, so
   *  the chrome (and in Safari the column layer) stays still during momentum scroll and rubber-banding. It is also
   *  the card the burger slides aside. */
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
let pinTimer: ReturnType<typeof setTimeout> | undefined, landTimer: ReturnType<typeof setTimeout> | undefined, kbTimer: ReturnType<typeof setTimeout> | undefined, pendingTimer: ReturnType<typeof setTimeout> | undefined;
// The damper keeps history, so it is fed once per signal change (refresh, from the watcher), never from React's
// getSnapshot (read), which React may call several times per render.
function refresh() {
  const s = readSignals(), c = stable(damper, s, preferredSide(isSplit(s)), performance.now(), settling(), epoch());
  // A pin lifts on its own time, with no resize to re-read on.
  if (damper.pinned && !pinTimer) pinTimer = setTimeout(() => { pinTimer = undefined; listeners.forEach((f) => f()); }, damper.until! - performance.now() + 20);
  // So is a landing after a fold or turn (LAND_HOLD), which no resize may follow.
  if (damper.landUntil !== undefined && !landTimer) landTimer = setTimeout(() => { landTimer = undefined; listeners.forEach((f) => f()); }, damper.landUntil - performance.now() + 10);
  // And a keyboard held up after focus left it (KEYBOARD_DOWN), if the visual viewport never grows back.
  if (damper.kbUntil !== undefined && damper.kbUntil > performance.now() && !kbTimer) kbTimer = setTimeout(() => { kbTimer = undefined; listeners.forEach((f) => f()); }, damper.kbUntil - performance.now() + 10);
  // And controls hidden while a preview's inset is pending (#143), if it never lands.
  if (damper.pendingUntil !== undefined && !pendingTimer) pendingTimer = setTimeout(() => { pendingTimer = undefined; listeners.forEach((f) => f()); }, damper.pendingUntil - performance.now() + 10);
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
  const ctx = useSyncExternalStore(subscribe, read, () => ssr);
  // The pre-paint boot guessed the column; once mounted a page that is not in it takes the guess back (a page whose
  // <Duet> is in the column takes it over instead, below).
  useEffect(() => { if (ctx.mode !== "column") unboot(); }, [ctx.mode]);
  return ctx;
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

/** Safari tab: fixed content is clipped to the page viewport (so is sticky), but in-document content paints
 *  into Safari's column. So the chrome is an absolute layer at the document top, and the inner scroller keeps
 *  the document itself from scrolling, so the layer never moves. Without children the document scrolls, and the
 *  layer rides it on a CSS scroll timeline (duet.css, duet-follow): Safari runs that with the scroll itself, so
 *  it holds through momentum and smooth programmatic scrolls, where a transform set from scroll events lags and
 *  drifts (#55; simulator, 2026-10-26: up to 300pt during scrollIntoView, under 2pt on the timeline).
 *  The keyframe ends at the timeline's scroll range (--duet-scroll-max). A constant px range (animation-range
 *  0px 1000000px) computes exactly but Safari's compositor paints it up to 18pt off in momentum (2026-10-27).
 *  Browsers without scroll timelines get the transform. Touches there reach the page
 *  but are not hit-tested to our elements, and Safari keeps the touch end (no pointerup, no click), so we route
 *  them by coordinates on pointerdown. Nothing in the column scrolls, so a touch there is always a tap.
 *  Split pane: the column is on the pane's outer edge, which the page cannot see, so the document spans a column
 *  on each side, scrolled 84 across, and the controls are drawn in both (refs[0] left, refs[1] right). Each pane
 *  shows only its own column, and a tap there names the side (`tapSide`). A left-hand column (closed landscape,
 *  turned left) works the same way, with the document spanning that column alone. */
let tapSide: Side = "right";
/** A column touch that hits no button: closes what is open, like a touch on the page. */
let columnMiss: (() => void) | null = null;
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
// useLayoutEffect warns during SSR on React 18.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  // Before paint: the layer is hidden mid-turn (off), and the render that shows it again also turns the follow back
  // on. As a passive effect that ran a frame after the paint, so the controls showed once at their document
  // position, about scrollY above where they belong (e2e scr01, a turn or fold on a scrolled page, #131); see the
  // bridge below for the animation's own frame.
  useLayout(() => {
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
    // 6pt 1000pt down (simulator, 2026-10-26). The innerHeight half is left to CSS as 100dvh, which follows it
    // frame by frame: at the page end Safari's toolbar grows back seconds after the last scroll, with no scroll or
    // window resize until it settles, and a measured range held the controls 17pt up meanwhile (2026-10-27).
    // Content can outgrow the body (absolute, overflowing), so every scroll re-measures as well as resizes.
    let max = "";
    const range = () => {
      const m = `max(0px, ${root.scrollHeight}px - 100dvh)`;
      if (m !== max) { max = m; for (const el of els) el.style.setProperty("--duet-scroll-max", m); }
    };
    const sizes = timeline ? new ResizeObserver(range) : undefined;
    if (sizes) { range(); sizes.observe(root); sizes.observe(document.body); }
    // A new animation waits for the next frame's animation update, so the frame that shows the layer drew it
    // unfollowed even with the follow on before paint. A transform holds it in place for that frame; the running
    // animation overrides it, and it is dropped once the animation has run (#131).
    let bridge = 0;
    if (timeline && scrollY) {
      for (const el of els) el.style.transform = `translateY(${scrollY}px)`;
      bridge = requestAnimationFrame(() => { bridge = requestAnimationFrame(() => { for (const el of els) el.style.transform = ""; }); });
    }
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
      // Skip a capsule that is morphing into its menu (the menu covers it) or leaving.
      for (const b of el?.querySelectorAll<HTMLButtonElement>(".duet-group:not([data-morphing], [data-leaving]) > button") ?? []) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { b.click(); return; }
      }
      columnMiss?.();
    };
    follow();
    // Safari restores or resets the sideways scroll on load, resize and a back/forward cache restore.
    const t = [0, 300, 1000].map((ms) => setTimeout(follow, ms));
    addEventListener("scroll", follow, { passive: true });
    addEventListener("resize", follow);
    addEventListener("pageshow", follow);
    addEventListener("pointerdown", tap);
    return () => {
      html.touchAction = prev; sizes?.disconnect(); cancelAnimationFrame(bridge);
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

/** How long a slot that went away stays mounted while it pops out (duet.css, duet-leave). */
const LEAVE_MS = 450;
/** Page changes as one motion, like AnimatePresence: slots are positional (a falsy entry is an empty slot), so a slot
 *  that arrives after mount pops in (data-enter) and one that goes stays in its place while it pops out
 *  (data-leaving). Moves are the slots' own top/height transitions; React never reorders a node mid-transition. */
function Presence({ children }: { children: ReactNode[] }) {
  const last = useRef<ReactNode[]>([]), mounted = useRef(false), entered = useRef(new Set<number>());
  const [leaving, setLeaving] = useState<ReadonlyMap<number, ReactElement>>(new Map());
  let next: Map<number, ReactElement> | undefined;
  children.forEach((el, i) => {
    const was = last.current[i];
    if (!el && isValidElement(was) && !leaving.has(i)) (next ??= new Map(leaving)).set(i, cloneElement(was as ReactElement<Record<string, unknown>>, { "data-leaving": "", "aria-hidden": true }));
    if (el && leaving.has(i)) (next ??= new Map(leaving)).delete(i);
    if (el && !was && mounted.current) entered.current.add(i); else if (!el) entered.current.delete(i);
  });
  if (next) setLeaving(next);
  useLayout(() => { last.current = children; mounted.current = true; });
  useEffect(() => {
    if (!leaving.size) return;
    const t = setTimeout(() => setLeaving(new Map()), LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  return children.map((el, i) => (
    <Fragment key={i}>{isValidElement(el) && entered.current.has(i) ? cloneElement(el as ReactElement<Record<string, unknown>>, { "data-enter": "" }) : el || leaving.get(i)}</Fragment>
  ));
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** "…" grows into its list: one spring drives the shape, the press swell, the tint and the list, open and close,
 *  interruptible either way with its velocity kept. The capsule hides (data-morphing) and this blob takes its place,
 *  starting as the capsule (its glass, its icons on .duet-face) and ending as the menu. Driven from rAF on refs, so
 *  React renders it once per open. */
function Morph({ open, from, slots, box, onClosed, children, role = "menu", label }: { open: boolean; from: Rect; slots: ReactNode[]; box: Rect; onClosed: () => void; children: ReactNode; role?: string; label?: string }) {
  const blob = useRef<HTMLDivElement>(null), fill = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), face = useRef<HTMLDivElement>(null);
  const st = useRef({ s: 0, v: 0, raf: 0, last: 0, clear: 0 });
  const closed = useRef(onClosed);
  closed.current = onClosed;
  /** `clear`: how far the closing fade has run, 0 (none) to 1 (clear glass). */
  const draw = (s: number, clear: number) => {
    const el = blob.current, fl = fill.current, b = body.current, fc = face.current;
    if (!el || !fl || !b || !fc) return;
    // Toward the page is -x when the menu sits left of the capsule (a right column), else +x.
    const left = box.x + box.w / 2 < from.x + from.w / 2;
    const tall = lead(lead(s, 3), 1.5), wide = lead(lead(s, -1), -0.6), outer = lead(lead(s, 3), 3);
    // The press swell: up to 1.2x, over before the shape leaves the capsule's size.
    const swell = 1 + 0.2 * Math.sin(Math.PI * clamp01(s / 0.3));
    const w = Math.max(from.w * swell, mix(from.w, box.w, wide)), h = Math.max(from.h * swell, mix(from.h, box.h, tall));
    const o = mix(left ? from.x + from.w : from.x, left ? box.x + box.w : box.x, outer) + (left ? 1 : -1) * (w - mix(from.w, box.w, wide)) / 2;
    const cy = mix(from.y + from.h / 2, box.y + box.h / 2, tall);
    const r = mix(Math.min(w, h) / 2, 28, clamp01((wide - 0.15) / 0.6));
    el.style.cssText = `left:${left ? o - w : o}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;border-radius:${r}px`;
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
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      k.s = target; k.v = 0; draw(target, open ? 0 : 1);
      if (!open) closed.current();
      return;
    }
    const t0 = performance.now();
    if (open) k.clear = 0;
    draw(k.s, k.clear);
    k.last = 0;
    const tick = (t: number) => {
      const dt = k.last ? Math.min(0.032, (t - k.last) / 1000) : 1 / 60;
      k.last = t;
      // Semi-implicit Euler in 4 substeps: stable at 120Hz and 30Hz alike.
      for (let i = 0; i < 4; i++) {
        k.v += (-sp.stiffness * (k.s - target) - sp.damping * k.v) * dt / 4;
        k.s += k.v * dt / 4;
      }
      if (!open) k.clear = Math.max(k.clear, clamp01((t - t0) / CLEAR_MS));
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
    <div ref={blob} className="duet-blob" role={role} aria-label={label} style={{ left: from.x, top: from.y, width: from.w, height: from.h, borderRadius: TEMPLATE.control / 2 }}>
      <div ref={fill} className="duet-fill" style={{ opacity: 0 }} aria-hidden />
      <i className="duet-rim" aria-hidden />
      <div ref={face} className="duet-face" style={{ width: from.w, height: from.h }} aria-hidden>
        {slots.map((icon, i) => <span key={i} style={{ top: i * TEMPLATE.item }}>{icon}</span>)}
      </div>
      <div ref={body} className="duet-menu" style={{ width: box.w, height: box.h, opacity: 0 }}><div className="duet-list">{children}</div></div>
    </div>
  );
}

type Phase = "open" | "closing" | "closed";

export function Duet<T extends string = string>(props: DuetProps<T>) {
  const p = props as unknown as DuetProps; // menu ids are only typed at the boundary
  const ctx = useDuet();
  const scroller = useRef<HTMLDivElement>(null);
  // The sidebar stays "closing" while the page slides back, so the card keeps its background and radius.
  const [sidebar, setSidebar] = useState<Phase>("closed");
  const [more, setMore] = useState<Phase>("closed");
  const [armed, setArmed] = useState(false);
  // The primary's confirmation box, its whole capsule growing like "…" grows into its list.
  const [ask, setAsk] = useState<Phase>("closed");
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
  useEffect(() => {
    if (sidebar !== "closing") return;
    const t = setTimeout(() => setSidebar("closed"), SLIDE.ms);
    return () => clearTimeout(t);
  }, [sidebar]);
  const closeMore = () => setMore((m) => (m === "open" ? "closing" : m));
  const closeSidebar = () => setSidebar((s) => (s === "open" ? "closing" : s));
  const closeAsk = () => setAsk((a) => (a === "open" ? "closing" : a));
  const dismiss = () => { closeMore(); setArmed(false); closeAsk(); };

  const actions = (p.actions ?? []).filter((a) => !a.destructive && !a.folded), destructive = (p.actions ?? []).filter((a) => a.destructive);
  const folded = (p.actions ?? []).filter((a) => a.folded && !a.destructive);
  const menuItems = p.menu?.items ?? [];
  // Split pane in column mode: the controls are drawn in both of Safari's possible columns (useColumnLayer).
  const split = ctx.mode === "column" && !!ctx.split, column = ctx.screenWidth - ctx.width;
  const sides: Side[] = split ? ["left", "right"] : [ctx.side];
  // The copy whose column opened "…" draws its menu; the other copy's column is in the other pane.
  const [menuSide, setMenuSide] = useState<Side>(ctx.side);
  const inner = p.children !== undefined; // the inner scroller, which runs on under Safari's column

  // The template for one side: its groups, where they go, and what "…" lists.
  const layout = (side: Side) => {
    const f = frame(side === ctx.side ? ctx : { ...ctx, side });
    const inline = f.kind === "inline";
    const burger = !!p.menu && p.menu.burger !== false;
    const always = folded.length + destructive.length + (inline ? 1 : 0) + (p.menu && !burger ? 1 : 0);
    const a = template(f, { close: !!p.close, menu: burger, actions: actions.length, primary: !!p.primary, rest: always > 0, sidebar: sidebar !== "closed" }), placed = a.placed;
    // No burger (the preview): the app's places lead "…" under "Menu".
    const places = p.menu && !placed.some((g) => g.group.some((s) => s.kind === "menu")) ? menuItems : [];
    const askAt = placed.find((g) => g.group.some((s) => s.kind === "primary")), moreAt = placed.find((g) => g.group.some((s) => s.kind === "more"));
    // Sharing a capsule with "…", the primary is in the capsule that turns into the list, so the list leads with it.
    const list: DuetItem[] = [
      ...(askAt && askAt === moreAt ? [p.primary!] : []), ...actions.slice(a.shown), ...(p.primary && !a.primary ? [p.primary] : []), ...folded,
      ...(inline ? [{ id: "duet-side", label: `Move controls ${side === "left" ? "right" : "left"}`, icon: <ArrowLeftRight size={20} />, onPress: () => {
        setMore("closed");
        if (nav.current) switchSide(nav.current, side === "left" ? "right" : "left");
      } }] : []),
      ...destructive,
    ];
    return { f, placed, places, list, moreAt, askAt };
  };

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
    r.setProperty("--duet-inset-bottom", ctx.mode === "column" ? `${Math.max(0, ctx.screenHeight - ctx.height - ctx.offsetTop)}px` : "0px");
    // Safari's column buttons paint over the page: a popover that reaches into the column keeps its top at or below
    // this (columnBand). Split view takes the lower of the two panes' limits, since nothing tells which pane it is.
    const bands = sides.map((side) => columnBand({ ...ctx, side }));
    r.setProperty("--duet-safe-top-column", `${Math.max(0, ...bands.map((b) => b?.top ?? 0))}px`);
    // The page's height without Safari's URL bar bouncing it mid-scroll (Context.stableHeight), like 100svh.
    r.setProperty("--duet-vh", `${ctx.stableHeight}px`);
    // How far Safari's column runs beside the page, for a band the page bleeds into it (also set before paint: boot.ts).
    r.setProperty("--duet-column", ctx.mode === "column" ? `${ctx.screenWidth - ctx.width}px` : "0px");
    document.documentElement.removeAttribute("data-duet-boot");
    document.documentElement.dataset.duetMode = ctx.mode;
    document.documentElement.toggleAttribute("data-duet-emulated", !!emulatedSignals());
    document.documentElement.toggleAttribute("data-duet-split", split);
  }, [ctx.mode, ctx.side, ctx.hidden === "preview", ctx.screenWidth, ctx.screenHeight, ctx.width, ctx.height, ctx.stableHeight, ctx.offsetTop, split, inner, reserve]);
  useEffect(() => () => {
    const h = document.documentElement;
    h.style.marginLeft = ""; h.style.marginRight = ""; h.removeAttribute("data-duet-reserve");
  }, []);
  // data-duet-close: Duet's close button is on screen, in any mode, so a sheet hides its own X and shows one (#135).
  // Only when the template placed it: a band with no room for it leaves the sheet its own X (#142).
  const closeShown = !!p.close && controlsShown(ctx) && layout(ctx.side).placed.length > 0;
  // The pre-paint boot hid the server-rendered controls in a (pending) preview; a client reading (stable() always sets
  // confidence, the server snapshot never does) hides them itself while it must (#143).
  useLayout(() => { if (ctx.confidence) document.documentElement.removeAttribute("data-duet-pending"); }, [!!ctx.confidence]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-duet-close", closeShown);
    return () => document.documentElement.removeAttribute("data-duet-close");
  }, [closeShown]);
  // A sheet takes over the column: nothing else stays open under it.
  useEffect(() => { if (p.close) { setMore("closed"); setArmed(false); setAsk("closed"); closeSidebar(); } }, [!!p.close]);
  // The box goes with its capsule: a primary that runs away or loses its capsule (a new page, no room) takes it along.
  const askable = !!layout(ctx.side).askAt;
  useEffect(() => { if (!askable) setAsk("closed"); }, [askable]);
  // Mid-turn the layer is clipped out of the document (duet.css) and lets go of the sideways scroll; the landing
  // takes it up again, scrolled one column across for a left column.
  const [nav, nav2] = useColumnLayer(ctx.mode === "column" && ctx.hidden !== "moving", split, ctx.side === "left", column, ctx.mode === "column");
  const open = more !== "closed" || armed || ask !== "closed";
  useEffect(() => {
    // Any touch outside the chrome closes "…" and disarms the primary, like a native context menu.
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (![nav, nav2].some((n) => n.current?.contains(e.target as Node)) && e.clientX >= 0 && e.clientX < innerWidth) dismiss();
    };
    columnMiss = dismiss;
    addEventListener("pointerdown", close);
    return () => { removeEventListener("pointerdown", close); if (columnMiss === dismiss) columnMiss = null; };
  }, [open, nav, nav2]); // eslint-disable-line react-hooks/exhaustive-deps -- dismiss only sets state
  useSideDrag(ctx.mode === "inline" ? ctx.side : null, nav, () => { setMore("closed"); setArmed(false); setAsk("closed"); });

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
  const selected = p.menu?.selected;
  // Each place keeps its own scroll position in the inner scroller.
  const scrolls = useRef(new Map<string, number>());
  const select = (id: string) => {
    const el = scroller.current;
    closeSidebar(); dismiss();
    if (id === selected) return;
    if (el && selected !== undefined) scrolls.current.set(selected, el.scrollTop);
    p.menu!.onSelect(id);
  };
  useLayout(() => { if (scroller.current && selected !== undefined) scroller.current.scrollTop = scrolls.current.get(selected) ?? 0; }, [selected]);

  const theme = { ...themeVars(p), "--duet-slide": SLIDE.easing, "--duet-slide-ms": `${SLIDE.ms}ms`, "--duet-group": GROUP.easing, "--duet-group-ms": `${GROUP.ms}ms` } as CSSProperties;
  const badge = (a: { badge?: number | string; badgeTone?: string }) => a.badge !== undefined && a.badge !== "" && <span className="duet-badge" data-tone={a.badgeTone === "neutral" ? "neutral" : undefined}>{a.badge}</span>;
  const label = (s: Slot) => s.kind === "menu" ? "Menu" : s.kind === "more" ? "More" : s.kind === "close" ? (p.close && p.close.label) || "Close"
    : s.kind === "primary" ? p.primary!.label : actions[s.index].label;
  const icon = (s: Slot) => s.kind === "menu" ? <Menu size={22} /> : s.kind === "more" ? <Ellipsis size={22} /> : s.kind === "close" ? <X size={22} strokeWidth={2.2} />
    : s.kind === "primary" ? <span className="duet-cta-icon" style={p.primary!.tint ? { "--duet-tint": p.primary!.tint } as CSSProperties : undefined}>{p.primary!.icon}</span> : actions[s.index].icon;
  const press = (s: Slot) => {
    if (s.kind === "menu") { dismiss(); setSidebar((v) => (v === "open" ? "closing" : "open")); }
    else if (s.kind === "more") { if (split) setMenuSide(tapSide); setArmed(false); closeAsk(); setMore((m) => (m === "open" ? "closing" : "open")); }
    else if (s.kind === "close") p.close && p.close.onPress();
    else if (s.kind === "primary") {
      closeMore();
      if (p.primary!.confirm === false) p.primary!.onPress?.();
      else { if (split) setMenuSide(tapSide); setAsk((a) => (a === "open" ? "closing" : "open")); }
    } else { dismiss(); actions[s.index].onPress?.(); }
  };

  const bar = (side: Side, i: number) => {
    const { f, placed, places, list, moreAt, askAt } = layout(side);
    // Folded into "…", the primary arms in place (its row turns to `confirm`, the menu stays open) and runs on the
    // second tap, like its own capsule.
    const pick = (a: DuetItem) => () => {
      if (a === p.primary && primaryTap(armed, p.primary.confirm) === "arm") return setArmed(true);
      dismiss(); a.onPress?.();
    };
    const drawsMenu = more !== "closed" && moreAt && (!split || side === menuSide);
    const drawsAsk = ask !== "closed" && askAt && (!split || side === menuSide);
    const tint = p.primary?.tint ? { "--duet-tint": p.primary.tint } as CSSProperties : undefined;
    return (
      <nav key={side} ref={i ? nav2 : nav} className="duet" data-mode={ctx.mode} data-side={side} data-settling={!settled || ctx.confidence !== "sure" || undefined} data-hidden={ctx.hidden} data-confidence={ctx.confidence} data-keyboard={ctx.keyboard || undefined} style={{ ...theme, ...(split && i ? { left: column } : undefined) }}>
        <Presence>{placed.map((g, gi) => {
          const rect = g.rect;
          return (
            <div key={gi} className="duet-group" data-duet-slot={g.group.length === 1 ? g.group[0].kind : g.group[0].kind === "menu" ? "menu" : "actions"}
              data-primary={g.primary || undefined} data-morphing={(g === moreAt && drawsMenu) || (g === askAt && drawsAsk) || undefined}
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...(g === askAt ? tint : undefined) }}>
              {!g.primary && <i className="duet-rim" aria-hidden />}
              {g.group.map((s, j) => (
                <button key={s.kind === "action" ? actions[s.index].id : s.kind} className="duet-btn" aria-label={label(s)} data-destructive={undefined}
                  aria-expanded={s.kind === "more" ? more === "open" : s.kind === "menu" ? sidebar === "open" : s.kind === "primary" && p.primary!.confirm !== false ? ask === "open" : undefined}
                  style={{ top: j * TEMPLATE.item, width: rect.w }} onClick={() => press(s)}>
                  {icon(s)}
                  {s.kind === "action" && badge(actions[s.index])}
                </button>
              ))}
            </div>
          );
        })}</Presence>
        {drawsMenu && moreAt && (
          <Morph open={more === "open"} from={moreAt.rect} slots={moreAt.group.map(icon)} box={menuBox(f, moreAt.rect, places.length + list.length, places.length ? 2 : 1)} onClosed={() => setMore("closed")}>
            {places.length > 0 && <>
              <div className="duet-menu-head">Menu</div>
              {places.map((m) => (
                <button key={m.id} className="duet-row" role="menuitemradio" aria-checked={m.id === selected} onClick={() => select(m.id)}>{m.icon}<span>{m.label}</span>{badge(m)}</button>
              ))}
            </>}
            <div className="duet-menu-head">{f.kind === "column" ? "This page" : "More"}</div>
            {list.map((a) => {
              const arm = a === p.primary && armed;
              return (
                <button key={a.id} className="duet-row" role="menuitem" data-destructive={a.destructive || undefined} data-armed={arm || undefined} data-cta={a === p.primary || undefined}
                  style={a === p.primary ? tint : undefined} onClick={pick(a)}>
                  {a.icon}<span>{(arm && p.primary!.confirm) || a.label}</span>{badge(a)}
                </button>
              );
            })}
          </Morph>
        )}
        {drawsAsk && askAt && (
          <Morph open={ask === "open"} from={askAt.rect} slots={askAt.group.map(icon)} box={confirmBox(f, askAt.rect)} onClosed={() => setAsk("closed")} role="dialog" label={p.primary!.label}>
            <div className="duet-confirm-head" style={tint}>{p.primary!.icon}<span>{p.primary!.label}</span></div>
            <button className="duet-row duet-confirm" style={tint} onClick={() => { setAsk("closing"); p.primary!.onPress?.(); }}>
              <span>{p.primary!.confirm || p.primary!.label}</span>
            </button>
          </Morph>
        )}
      </nav>
    );
  };

  // The burger slides the page aside by the screen's width in the column (the page leaves with its column), and by
  // up to 40% of it inline, where the page stays in view as a card to tap back to.
  const slide = ctx.mode === "column" ? ctx.screenWidth : Math.min(340, ctx.width * 0.4);
  const slid = sidebar !== "closed";
  return (
    <GlassProvider defaultTheme={glassTheme(p.appearance, p.dark)}>
      {p.menu && p.menu.burger !== false && (
        <nav className="duet duet-sidebar" data-open={sidebar === "open" || undefined} data-overlay={!inner || undefined} aria-label="Menu"
          style={{ ...theme, width: ctx.mode === "column" ? ctx.width : slide }} inert={sidebar !== "open" || undefined}>
          <div className="duet-side-head">Menu</div>
          {menuItems.map((m) => (
            <button key={m.id} className="duet-side-row" aria-current={m.id === selected ? "page" : undefined} tabIndex={sidebar === "open" ? 0 : -1} onClick={() => select(m.id)}>
              {m.icon}<span>{m.label}</span>{badge(m)}
            </button>
          ))}
        </nav>
      )}
      {p.children !== undefined && (
        <div ref={scroller} className="duet-scroller" data-slid={slid || undefined} onPointerDownCapture={slid ? closeSidebar : undefined}
          style={{ ...theme, translate: sidebar === "open" ? `${slide}px 0` : undefined }}>{p.children}</div>
      )}
      {sides.map(bar)}
      {/* On both viewport edges, so a page's full-screen overlay cannot hide Safari's column (duet.css). Mounted on a Duo in
          Safari whatever the mode: a guard that drops while a turn or fold is in transit leaves the column filled with the
          overlay once it is back (#119). */}
      {ctx.duo && ctx.browser === "safari" && !emulatedSignals() && (["left", "right"] as const).map((side) => <span key={side} className="duet-guard" data-side={side} aria-hidden />)}
    </GlassProvider>
  );
}
