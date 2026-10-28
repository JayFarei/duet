// Reads the browser signals detect() works from, and says when they may have changed. No React, so a page can set
// its own attributes before React mounts with the same reading and triggers as the chrome.
import type { Signals } from "./geometry.ts";
import { measure } from "./measure.ts";

const watchers = new Set<() => void>();

// A desktop page that draws a Duo around this page in an iframe (the site's web Duo) sends the signals the
// real device would give: `postMessage({ type: "duet:signals", signals }, origin)`. Same origin only. The page
// says `duet:ready` once it listens, so the host answers then instead of guessing when the page has loaded.
let emulated: Signals | null = null;
if (typeof window !== "undefined" && window.top !== window) {
  addEventListener("message", (e: MessageEvent) => {
    if (e.source !== parent || e.origin !== location.origin || e.data?.type !== "duet:signals") return;
    emulated = e.data.signals as Signals;
    watchers.forEach((f) => f());
  });
  parent.postMessage({ type: "duet:ready" }, location.origin);
}
/** The signals a host page sends into this iframe, if any (see above). */
export const emulatedSignals = () => emulated;

let probe: HTMLDivElement | null = null;
/** The current signals, read from the window (or the emulating host page). Browser only. */
export function readSignals(): Signals {
  if (emulated) return emulated;
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
  }
  return measure(probe);
}

/** Geometry after an event is not final: a fold moves outerWidth up to ~2s after the viewport, and nothing fires when
 *  it lands. So every event starts a settle: poll every `poll` ms until outer, inner and visual sizes hold for `quiet`
 *  ms, re-reading on each change and once at the end. A page far narrower or wider than its window (more than `lag`
 *  apart: Safari's column is 84) is a fold caught halfway, so it does not count as holding until `cap`. After `cap` ms
 *  settling() turns false even if sizes still move, but polling goes on until they hold, so a real feedback loop
 *  cannot keep restarting the settle. */
export const SETTLE = { poll: 100, quiet: 500, cap: 2000, lag: 100 } as const;
const subs = new Set<() => void>();
let settle: { start: number; since: number; last: string; capped: boolean; timer: ReturnType<typeof setInterval> } | undefined;
// Insets count too: the bottom inset lands only after viewport-fit=cover is set, and the preview rule reads it.
const insets = () => { if (!probe) return ""; const p = getComputedStyle(probe); return `${p.paddingBottom} ${p.paddingLeft} ${p.paddingRight}`; };
const sizes = () => `${outerWidth}x${outerHeight} ${innerWidth}x${innerHeight} ${visualViewport?.height ?? innerHeight} ${insets()}`;
const notify = () => subs.forEach((f) => f());
function kick() {
  if (settle) { settle.since = Date.now(); return; }
  const now = Date.now();
  settle = { start: now, since: now, last: sizes(), capped: false, timer: setInterval(tick, SETTLE.poll) };
}
function tick() {
  const s = settle!, now = Date.now(), k = sizes(), capped = now - s.start >= SETTLE.cap;
  const changed = k !== s.last, lagging = Math.abs(outerWidth - innerWidth) > SETTLE.lag;
  if (changed) [s.last, s.since] = [k, now];
  if (now - s.since >= SETTLE.quiet && (!lagging || capped)) { clearInterval(s.timer); settle = undefined; return notify(); }
  // Re-read on a change, and once as settling() turns false.
  if (changed || (capped && !s.capped)) notify();
  s.capped = capped;
}
/** True while the window is still settling after a geometry event, for at most SETTLE.cap: mode flips then are the
 *  transition, not a feedback loop, so stable() must not count them. */
let pages = 0;
/** Bumped on pageshow and whenever the page becomes visible: the page may now be in another container (the in-app
 *  preview's "Open in Safari" hands it to a tab without reloading), so stable() decides the preview afresh. */
export const epoch = () => pages;

export const settling = () => !!settle && Date.now() - settle.start < SETTLE.cap;

/** Calls `cb` whenever the signals may have changed, so it can call readSignals() and detect() again: on resize,
 *  rotation (a turn from one landscape to the other keeps the window size, so screen.orientation too), the keyboard
 *  (visualViewport), and on pageshow and visibilitychange, as when an in-app preview's "Open in Safari" hands the
 *  page to a Safari tab without reloading it. Each event, and the call itself (a fresh tab settles with no event),
 *  starts a settle (SETTLE): `cb` runs at once, on every size change while it polls, and once when sizes hold.
 *  Returns the unsubscribe. Browser only. */
export function watchSignals(cb: () => void): () => void {
  const on = () => { kick(); cb(); };
  const shown = () => { pages++; on(); };
  const visible = () => { if (document.visibilityState === "visible") shown(); };
  const win = ["resize", "orientationchange"] as const;
  win.forEach((e) => addEventListener(e, on));
  addEventListener("pageshow", shown);
  document.addEventListener("visibilitychange", visible);
  screen.orientation?.addEventListener("change", on);
  visualViewport?.addEventListener("resize", on);
  // Focus decides whether a short visual viewport is the keyboard (keyboardUp), and can change with no resize.
  document.addEventListener("focusin", cb);
  document.addEventListener("focusout", cb);
  subs.add(cb);
  watchers.add(cb);
  kick();
  const t = setTimeout(cb, 0);
  return () => {
    subs.delete(cb);
    watchers.delete(cb);
    clearTimeout(t);
    if (!subs.size && settle) { clearInterval(settle.timer); settle = undefined; }
    win.forEach((e) => removeEventListener(e, on));
    removeEventListener("pageshow", shown);
    document.removeEventListener("visibilitychange", visible);
    screen.orientation?.removeEventListener("change", on);
    visualViewport?.removeEventListener("resize", on);
    document.removeEventListener("focusin", cb);
    document.removeEventListener("focusout", cb);
  };
}
