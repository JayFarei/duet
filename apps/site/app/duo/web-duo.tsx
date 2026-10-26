"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Activity, ArrowLeftRight, Highlighter, Pause, Play, Pointer, RotateCw, Snail } from "lucide-react";
import { DUO, SAFARI, detect, type Mode, type Side, type Signals } from "duet-ui/geometry";

// A web iPhone Duo for desktop browsers: the site runs in an iframe shaped like the device's screen, and the
// iframe gets the signals the real device would give (duet-ui's `duet:signals` emulation), so Duet lays out
// exactly as it would on the phone. Every size is measured on the Duo simulator (docs/research-notes.md), on the
// device, or from its device artwork (tools/media/frame.py).

type Posture = "closed" | "open";
/** home: added to the Home Screen. safari: a full-screen tab. split: Safari in a split-view pane. window: a Safari
 *  window beside the Home Screen. */
type App = "home" | "safari" | "split" | "window";
interface State { posture: Posture; rotated: boolean; app: App; pane: Side }

// Natural orientation: closed is portrait (outer display), open is landscape (inner display). `rotated` turns
// the device a quarter turn clockwise, so the outer camera ends up bottom right.
const SCREEN = { closed: { w: 466, h: 678 }, open: { w: 951, h: 669 } };
// A graphite finish around a black front: the site stays colourless.
const FINISH = { band: "#3a3a3c", rim: "#6e6e73", front: "#0b0c10", button: "linear-gradient(#6e6e73, #2c2c2e)" };
const BODY_SHADE = `inset 0 0 0 1.5px ${FINISH.rim}, inset 0 0 0 3.5px ${FINISH.band}`;
// Corners fitted to Apple's iPhone Duo simulator artwork (body and screen masks): a superellipse of radius `r` and
// CSS corner-shape `k` (1 is a circle), and the closest circle where corner-shape is unsupported.
interface Corner { r: number; k: number; round: number }
const C = {
  free: { r: 103.5, k: 1.6, round: 75 }, hinge: { r: 40, k: 2.25, round: 30 }, // the body: free edge, hinge spine
  screen: { r: 74.5, k: 1.4, round: 60.5 }, inner: { r: 67.5, k: 1.4, round: 55 }, // outer and inner display
  spine: { r: 9, k: 1, round: 9 }, none: { r: 0, k: 1, round: 0 },
} satisfies Record<string, Corner>;
// Closed: hinge spine on the left (26pt), free edge on the right (13pt). Open: 13pt sides, both free edges.
// Corners run top left, top right, bottom right, bottom left.
const BODY = {
  closed: { w: 505, h: 706, x: 26, y: 14, r: [C.hinge, C.free, C.free, C.hinge], screenR: [C.spine, C.screen, C.screen, C.spine] },
  open: { w: 977, h: 697, x: 13, y: 14, r: [C.free, C.free, C.free, C.free], screenR: [C.inner, C.inner, C.inner, C.inner] },
};
/** Corners as the device draws them, for an element marked `data-wd-shape`: site.css swaps in the superellipse
 *  radii where corner-shape works, and other browsers keep the closest circle. */
const corners = (c: Corner[]) => ({
  borderRadius: c.map((x) => `${x.round}px`).join(" "), "--wd-r": c.map((x) => `${x.r}px`).join(" "), cornerShape: c.map((x) => `superellipse(${x.k})`).join(" "),
}) as CSSProperties;
// Volume on top and power on the right, relative to the free edge (body right).
const BUTTONS = [{ right: 271, top: -4, w: 66, h: 6 }, { right: 191, top: -4, w: 66, h: 6 }, { right: -3, top: 196, w: 5, h: 113 }];
// Outer display camera, screen coordinates in natural portrait (seen in recordings at the top of the strip).
const CAMERA = { x: 418, y: 48, d: 38 };
const STRIP = 84; // iOS's strip and Safari's column
const OPEN_BAR = 126; // Safari's chrome above the page, unfolded
// Safari windows as the device reports them: outer is the window with its column, page is innerWidth x innerHeight.
// Safari's `screen.*` keeps the closed screen in every state.
const TAB = { w: 466, h: 678, page: { w: 382, h: 580 } }; // closed portrait: the window is the screen
const PANE = { w: 469, page: { w: 385, h: 571 } }; // a split-view pane, either side, 669 tall
const WINDOW = { w: 451, h: 666, page: { w: 369, h: 591 } }; // a window beside the Home Screen (device: 450-453 x 661-670)

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
const TURN = 650; // rotation, ms
const FOLD = 900;
const MOVE = 520; // the page frame moving between apps

interface Box { x: number; y: number; w: number; h: number }
interface Size { w: number; h: number }
/** clip: the box the page shows through (a Safari window), in screen coordinates; frame: the iframe, in clip
 *  coordinates. */
interface Scene { clip: Box; clipR?: number; frame: Box; signals: Signals; under?: ReactNode; chrome: ReactNode; mode: Mode; note: string }

// The slots a developer fills with <Duet> props, each in its own temporary colour for the call-out.
const SLOTS: [slot: string, color: string, label: string][] = [
  ["tabs", "#ff375f", "tabs"], ["actions", "#0a84ff", "actions"], ["leading", "#64d2ff", "leading"], ["back", "#30d158", "back"], ["close", "#ff453a", "close"],
  ["search", "#bf5af2", "searchButton"], ["more", "#ffd60a", "overflow"], ["accessory", "#ff9f0a", "accessory"],
];
const CALLOUT = "html[data-wd-slots] [data-duet-slot] { outline: 2.5px solid var(--wd-c); outline-offset: 2px; box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--wd-c) 30%, transparent) !important; }\n"
  + SLOTS.map(([slot, c]) => `[data-duet-slot="${slot}"] { --wd-c: ${c}; }`).join("\n");

/** What the device tells the page. `screen`: what `screen.*` reports, the window unless given. */
const sig = (inner: Size, outer: Size, { screen = outer, ...o }: Partial<Signals> & { screen?: Size } = {}): Signals => ({
  innerWidth: inner.w, innerHeight: inner.h, outerWidth: outer.w, outerHeight: outer.h, visualHeight: inner.h,
  insetTop: 0, insetBottom: 0, insetRight: 0, insetLeft: 0, screenWidth: screen.w, screenHeight: screen.h,
  standalone: false, framed: false, pixelRatio: 3, ...o,
});
/** Safari's `screen.*`: the closed screen, turned the way the page is (as chrome.tsx orients it). */
const safariScreen = (page: Size): Size => page.w > page.h ? { w: SCREEN.closed.h, h: SCREEN.closed.w } : SCREEN.closed;

/** A Safari window: the page at the top on its inner side, Safari's column on the `col` edge, the address bar
 *  below the page. In column mode Duet paints into the column, so the frame spans it (in a split pane both
 *  possible columns, and the pane shows only its own); otherwise the frame is just the page. */
function safariWindow(o: { win: Box; page: Size; col: Side; back: number; clock?: number; host: string; mode: Mode; split?: boolean; rounded?: boolean }) {
  const { win, page, col, mode } = o, colW = win.w - page.w, pageX = col === "left" ? colW : 0, column = mode === "column", bar = win.h - page.h;
  const frame: Box = !column ? { x: pageX, y: 0, ...page }
    : o.split ? { x: col === "right" ? -colW : 0, y: 0, w: page.w + 2 * colW, h: win.h }
    : { x: 0, y: 0, w: win.w, h: win.h };
  return {
    clip: win, clipR: o.rounded ? 30 : undefined, frame,
    under: o.rounded ? <div style={{ ...windowBg, left: win.x, top: win.y, width: win.w, height: win.h }} /> : undefined,
    chrome: (
      <div style={{ position: "absolute", left: win.x, top: win.y, width: win.w, height: win.h, borderRadius: o.rounded ? 30 : undefined, overflow: "hidden", pointerEvents: "none" }}>
        {/* In column mode the page runs on under the pill (Duet extends it by outer minus inner height). */}
        {!column && <div style={{ position: "absolute", left: pageX, top: page.h, width: page.w, height: bar, background: "var(--card)" }} />}
        <UrlBar left={pageX + 18} top={page.h + Math.min(22, (bar - 46) / 2)} width={page.w - 36} host={o.host} />
        <SafariColumn x={col === "left" ? 0 : page.w} h={win.h} col={col} back={o.back} clock={o.clock} over={column} />
      </div>
    ),
  };
}

/** Where the page sits on the screen, the signals it gets and the system chrome around it. W x H is the screen as
 *  the user sees it (upright). `modeOf`: the mode the page shows for a set of signals. `live`: Live Activities are
 *  running, which grows the Dynamic Island down the closed strip and pushes Safari's rows down, telling the page
 *  nothing. */
function scene(s: State, W: number, H: number, host: string, live: boolean, modeOf: (s: Signals) => Mode): Scene {
  const full = { w: W, h: H }, screen = { x: 0, y: 0, w: W, h: H };
  const push = live && s.posture === "closed" ? DUO.island : 0;
  if (s.app === "home") {
    const strip = W < H ? s.posture === "closed" : s.posture === "open"; // natural orientation only
    const signals = sig(full, full, { insetRight: strip ? STRIP : 0, standalone: true });
    return strip
      ? { clip: screen, frame: screen, signals, mode: modeOf(signals), chrome: <Status x={W - DUO.centerFromEdge} top={(s.posture === "closed" ? 84 : 26) + push} />,
          note: "Added to the Home Screen, the app owns the display and iOS gives it the strip. Duet draws its controls there, like a native app." }
      : { clip: screen, frame: screen, signals, mode: modeOf(signals), chrome: null,
          note: "Turned sideways there is no strip, so Duet keeps an 84pt one inside the page. Drag it to the other edge; it remembers." };
  }
  if (s.app === "split") {
    const win = { x: s.pane === "right" ? W - PANE.w : 0, y: 0, w: PANE.w, h: H }, otherX = s.pane === "right" ? 0 : W - PANE.w;
    const signals = sig(PANE.page, win, { screen: safariScreen(PANE.page) }), mode = modeOf(signals);
    const w = safariWindow({ win, page: PANE.page, col: s.pane, back: SAFARI.splitTop[s.pane], clock: s.pane === "right" ? 40 : undefined, host, mode, split: true, rounded: true });
    return {
      ...w, signals, mode,
      chrome: <>
        <div key={s.pane} style={{ ...windowBg, left: otherX, width: PANE.w, height: H, animation: `wd-slide ${MOVE}ms ${ease} both`, "--from": s.pane === "right" ? "-100%" : "100%" } as CSSProperties}><OtherApp /></div>
        {w.chrome}
      </>,
      note: "Split view: each pane has Safari's column on its outer edge, and Duet paints its controls there, in whichever pane Safari is. Swap the panes; Duet follows.",
    };
  }
  if (s.app === "window") {
    const win = { x: W - WINDOW.w - 9, y: Math.round((H - WINDOW.h) / 2), w: WINDOW.w, h: WINDOW.h };
    const signals = sig(WINDOW.page, WINDOW, { screen: safariScreen(WINDOW.page) }), mode = modeOf(signals);
    const w = safariWindow({ win, page: WINDOW.page, col: "right", back: SAFARI.splitTop.left, host, mode, rounded: true });
    return {
      ...w, signals, mode,
      chrome: <><HomeScreen w={win.x} h={H} />{w.chrome}</>,
      note: mode === "column"
        ? "A Safari window beside the Home Screen keeps Safari's column, so Duet paints its controls there, as in a closed tab."
        : "In this Safari window Duet keeps its controls inside the page.",
    };
  }
  if (s.posture === "closed") {
    const portrait = W < H, page = portrait ? TAB.page : { w: W - STRIP, h: H - 98 };
    const signals = sig(page, full, { screen: safariScreen(page) }), mode = modeOf(signals);
    const w = safariWindow({ win: screen, page, col: "right", back: portrait ? DUO.top + push : 62, clock: portrait ? 84 + push : 24, host, mode });
    return {
      ...w, signals, mode,
      note: portrait
        ? "In a closed Safari tab, Safari leaves its column empty between its own buttons. Duet paints its controls there, so the page keeps its full width."
        : "Landscape Safari moves its buttons around the column, so Duet keeps its own strip inside the page.",
    };
  }
  const page = { w: W, h: H - OPEN_BAR }, signals = sig(page, full, { screen: safariScreen(page) });
  return {
    clip: screen, frame: { x: 0, y: OPEN_BAR, ...page }, signals, mode: modeOf(signals),
    chrome: <OpenSafari w={W} host={host} />,
    note: "Unfolded, Safari runs full width with its toolbar on top. Duet reserves an 84pt strip inside the page.",
  };
}

const TOUR: State[] = [
  { posture: "closed", rotated: false, app: "home", pane: "right" },
  { posture: "open", rotated: false, app: "home", pane: "right" },
  { posture: "open", rotated: true, app: "home", pane: "right" },
  { posture: "closed", rotated: true, app: "home", pane: "right" },
  { posture: "closed", rotated: false, app: "home", pane: "right" },
  { posture: "closed", rotated: false, app: "safari", pane: "right" },
  { posture: "open", rotated: false, app: "safari", pane: "right" },
  { posture: "open", rotated: false, app: "split", pane: "right" },
  { posture: "open", rotated: false, app: "split", pane: "left" },
  { posture: "open", rotated: false, app: "window", pane: "right" },
];
/** Apps that exist in one posture only, upright: anywhere else they fall back to a Safari tab. */
const ONLY: Partial<Record<App, Posture>> = { split: "open", window: "open" };
const fit = (s: State): State => {
  const only = ONLY[s.app];
  return !only ? s : s.posture === only && !s.rotated ? s : { ...s, app: "safari" };
};

const LIVE_NOTE = " Live Activities grow the Dynamic Island down the strip without telling the page, so Duet's controls always sit below its tallest size.";
/** Every caption the stage can show, rendered invisibly under the real one so the text below never moves.
 *  Built on first use: `scene` needs the styles defined further down. */
let notes: string[] | undefined;
const allNotes = () => notes ??= [...new Set((["closed", "open"] as const).flatMap((posture) => [false, true].flatMap((rotated) =>
  (["home", "safari", "split", "window"] as const).flatMap((app) => (["left", "right"] as const).flatMap((pane) =>
    (["strip", "column", "inline"] as const).flatMap((m) => [false, true].map((live) => {
      const n = SCREEN[posture], [W, H] = rotated ? [n.h, n.w] : [n.w, n.h];
      const sc = scene(fit({ posture, rotated, app, pane }), W, H, "", live, () => m);
      return `${m}|${sc.note}${live && posture === "closed" ? LIVE_NOTE : ""}`;
    })))))))];

/** embed: a stage inside a page, sized to its container, touring on its own while on screen. Its controls stay
 *  hidden behind "Try it yourself", which stops the tour. Otherwise a full-window playground. */
export function WebDuo({ src: first, sources, title = "Duet", intro = "This is the site on a web iPhone Duo. Fold it, turn it, split it. On a phone, the site opens directly.", embed = false }: { src: string; sources?: [string, string][]; title?: string; intro?: string; embed?: boolean }) {
  const [src, setSrc] = useState(first);
  const [s, setS] = useState<State>(TOUR[0]);
  // The page inside turns upright only once the device has finished turning, like iOS.
  const [upright, setUpright] = useState(false);
  // A fold or turn is in flight: the page is faded out and its frame jumps instead of animating.
  const [instant, setInstant] = useState(false);
  const [folding, setFolding] = useState(false);
  const [tour, setTour] = useState(false);
  const [manual, setManual] = useState(false);
  const [slots, setSlots] = useState(false);
  const [live, setLive] = useState(false);
  const [view, setView] = useState({ w: 1280, h: 800 });
  const [onScreen, setOnScreen] = useState(true);
  // Until the stage has measured its container it stays hidden, and then appears at its size without growing into it.
  const [measured, setMeasured] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  // Slow motion (a quarter speed) and the fold scrubber's position (0 closed, 1 open) while it is held.
  const [slow, setSlow] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  // The mode the page reports (its <html data-duet-mode>) for the signals last sent, so the frame follows what
  // Duet actually did, its flip damper included.
  const [seen, setSeen] = useState<{ signals: string; mode: Mode } | null>(null);
  const sent = useRef("");
  const k = useRef(1), held = useRef<Animation[]>([]);
  k.current = slow ? 4 : 1;
  const turn = measured ? TURN * k.current : 0;
  const frame = useRef<HTMLIFrameElement>(null);
  const page = useRef<HTMLDivElement>(null), hinge = useRef<HTMLDivElement>(null), flap = useRef<HTMLDivElement>(null), shadow = useRef<HTMLDivElement>(null);
  const cur = useRef(s), busy = useRef(false);
  cur.current = s;
  const host = useSyncExternalStore(() => () => {}, () => location.host, () => "");

  // Folding: the right half stays put and the left half swings round the hinge towards the viewer, like a book
  // closing, so the inner screens meet face to face and the outer display ends up in front. The
  // device recentres, so it unfolds from the middle. Web Animations, so timing never depends on React or timers.
  const swing = (open: boolean, easing = "cubic-bezier(0.45, 0, 0.2, 1)") => { // eased both ends, so the swing reads
    const o = { duration: FOLD * k.current, easing, fill: "both" as const };
    const [a, b] = open ? [0, 1] : [1, 0];
    const shift = (t: number) => `translateX(${-(1 - t) * BODY.open.w / 4}px)`;
    // The drop shadow follows the device's footprint: the right half, plus the flap's reach left of the hinge.
    const half = BODY.open.w / 2, reach = (t: number) => `${half * (1 - Math.max(0, Math.cos(Math.PI * (1 - t))))}px`;
    const steps = Array.from({ length: 25 }, (_, i) => a + (b - a) * i / 24);
    return [
      hinge.current?.animate([{ transform: shift(a) }, { transform: shift(b) }], o),
      flap.current?.animate([{ transform: `rotateY(${180 * (1 - a)}deg)` }, { transform: `rotateY(${180 * (1 - b)}deg)` }], o),
      shadow.current?.animate(steps.map((t) => ({ left: reach(t) })), o),
    ].filter((x): x is Animation => !!x);
  };
  const finished = (as: Animation[]) => Promise.all(as.map((a) => a.finished)).catch(() => {});
  const go = async (next: Partial<State>, fromTour = false) => {
    if (!fromTour) setTour(false);
    if (busy.current) return;
    const p = cur.current, n = { ...p, ...next };
    const only = ONLY[n.app];
    if (next.app && only) [n.posture, n.rotated] = [only, false]; // picking the app moves the device there
    Object.assign(n, fit(n));
    if (n.posture === p.posture && n.rotated === p.rotated) return setS(n);
    // The page fades out while the device moves and back in once it has settled, laid out for the new screen.
    busy.current = true;
    flushSync(() => setInstant(true));
    const fade = page.current?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.12 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], { duration: (FOLD + 450) * k.current, easing: "ease" }).finished;
    if (n.posture !== p.posture) {
      const open = n.posture === "open";
      flushSync(() => { setFolding(true); if (open) setS(n); });
      await finished(swing(open));
      flushSync(() => { if (!open) setS(n); setFolding(false); });
      hinge.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    } else setS(n);
    busy.current = false;
    await fade?.catch(() => {});
    setInstant(false);
  };

  // The fold scrubber: holding it opens the device (the open layout under a flap at the closed angle) and parks
  // the swing at the thumb; letting go finishes the swing towards the nearer end, from where it was.
  const hold = (t: number) => {
    if (!held.current.length) {
      if (busy.current) return;
      setTour(false);
      busy.current = true;
      page.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * k.current, fill: "forwards" });
      flushSync(() => { setInstant(true); setFolding(true); setS((p) => fit({ ...p, posture: "open" })); });
      held.current = swing(true, "linear");
      held.current.forEach((a) => a.pause());
    }
    held.current.forEach((a) => { a.currentTime = t * FOLD * k.current; });
    setScrub(t);
  };
  const release = async () => {
    const as = held.current;
    if (!as.length) return;
    const open = (scrub ?? 0) >= 0.5;
    as.forEach((a) => { a.playbackRate = open ? 1 : -1; a.play(); });
    await finished(as);
    held.current = [];
    flushSync(() => { if (!open) setS((p) => fit({ ...p, posture: "closed" })); setFolding(false); setScrub(null); });
    as.forEach((a) => a.cancel());
    busy.current = false;
    await page.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 * k.current, easing: "ease" }).finished.catch(() => {});
    page.current?.getAnimations().forEach((a) => a.cancel());
    setInstant(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setUpright(s.rotated), s.rotated === upright ? 0 : turn);
    return () => clearTimeout(t);
  }, [s.rotated, upright, turn]);

  // The embedded stage tours by itself unless the reader asked for less motion, and only while it is on screen.
  useEffect(() => {
    if (!embed || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTour(true);
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.25 });
    if (stage.current) io.observe(stage.current);
    return () => io.disconnect();
  }, [embed]);

  useEffect(() => {
    if (!tour || !onScreen) return;
    let i = TOUR.findIndex((t) => JSON.stringify(t) === JSON.stringify(s));
    const t = setInterval(() => { i = (i + 1) % TOUR.length; go(TOUR[i], true); }, 3600);
    return () => clearInterval(t);
  }, [tour, onScreen]); // eslint-disable-line react-hooks/exhaustive-deps -- the tour starts from the current state

  useEffect(() => {
    // Embedded: the container's width, and a stage height every posture fits in.
    const fit = () => {
      if (!embed) return setView({ w: innerWidth, h: innerHeight });
      const w = stage.current?.clientWidth ?? innerWidth;
      setView({ w, h: Math.max(260, Math.min(w * 0.85, 600, innerHeight * 0.62)) });
    };
    fit();
    const raf = requestAnimationFrame(() => setMeasured(true));
    const ro = new ResizeObserver(fit);
    if (stage.current) ro.observe(stage.current);
    addEventListener("resize", fit);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("resize", fit); };
  }, []);

  const n = SCREEN[s.posture], b = BODY[s.posture];
  const [W, H] = upright ? [n.h, n.w] : [n.w, n.h];
  const modeOf = (x: Signals) => { const j = JSON.stringify(x); return seen?.signals === j ? seen.mode : detect(x).mode; };
  const sc = scene({ ...s, rotated: upright }, W, H, host, live, modeOf);

  // Tell the page what the device would tell it: now, and whenever it (re)loads and says it is listening.
  const signals = JSON.stringify(sc.signals);
  useEffect(() => {
    const post = () => { sent.current = signals; frame.current?.contentWindow?.postMessage({ type: "duet:signals", signals: JSON.parse(signals) }, location.origin); };
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.origin === location.origin && e.data?.type === "duet:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [signals]);

  // Watch the mode the page lays out in.
  useEffect(() => {
    const el = frame.current;
    let mo: MutationObserver | undefined;
    const attach = () => {
      const root = el?.contentDocument?.documentElement;
      if (!root) return;
      const read = () => { const m = root.dataset.duetMode as Mode | undefined; if (m) setSeen({ signals: sent.current, mode: m }); };
      mo?.disconnect();
      mo = new MutationObserver(read);
      mo.observe(root, { attributes: true, attributeFilter: ["data-duet-mode"] });
      read();
    };
    attach();
    el?.addEventListener("load", attach);
    return () => { mo?.disconnect(); el?.removeEventListener("load", attach); };
  }, []);

  // The call-out: colours each slot Duet placed in the page, and outlines iOS's own chrome around it.
  useEffect(() => {
    const el = frame.current;
    const apply = () => {
      const d = el?.contentDocument;
      if (!d?.head) return;
      if (!d.getElementById("wd-callout")) d.head.append(Object.assign(d.createElement("style"), { id: "wd-callout", textContent: CALLOUT }));
      d.documentElement.toggleAttribute("data-wd-slots", slots);
    };
    apply();
    el?.addEventListener("load", apply);
    return () => el?.removeEventListener("load", apply);
  }, [slots]);

  // Fit the turned device and the controls in the window.
  const [bw, bh] = s.rotated ? [b.h, b.w] : [b.w, b.h];
  const scaleFor = (w: number, h: number) => embed ? Math.min(view.w / w, view.h / h, 1) : Math.min((view.w - 64) / w, (view.h - 320) / h, 1);
  const scale = scaleFor(bw, bh);
  // What the stage shows (Safari or a Home Screen web app) sits beside the device when the widest posture leaves room.
  const widest = Math.max(...[BODY.closed, BODY.open].flatMap((x) => [x.w * scaleFor(x.w, x.h), x.h * scaleFor(x.h, x.w)]));
  const beside = (view.w - widest) / 2 >= 230;
  const motion = (props: string[]) => instant || !measured ? "none" : props.map((x) => `${x} ${MOVE}ms ${ease}`).join(", ");

  return (
    <div ref={stage} style={embed ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" } : { minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "28px 0", background: "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg), #888 12%))" }}>
      {!embed && <header style={{ textAlign: "center" }}>
        <div style={{ font: "800 30px/1 -apple-system, system-ui", letterSpacing: -0.6 }}>{title}</div>
        <div style={{ color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", marginTop: 6 }}>
          {intro}
        </div>
      </header>}

      <div style={{ position: "relative", alignSelf: "stretch", display: "flex", justifyContent: "center", alignItems: "center", visibility: measured ? undefined : "hidden", ...(embed && { height: view.h }) }}>
      {beside && <Showing app={s.app} style={{ position: "absolute", right: `calc(50% + ${bw * scale / 2 + 40}px)`, width: 170, top: "50%", translate: "0 -50%", transition: `right ${turn}ms ${ease}` }} />}
      <div style={{ width: bw * scale, height: bh * scale, position: "relative", transition: `width ${turn}ms ${ease}, height ${turn}ms ${ease}` }}>
        <div style={{
          position: "absolute", left: "50%", top: "50%", width: b.w, height: b.h,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${s.rotated ? 90 : 0}deg)`,
          transition: `transform ${turn}ms ${ease}`,
        }}>
        <div ref={hinge} style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        {/* The drop shadow sits outside the fold's clip, so the clip never cuts it, and is cast down the page however the device is turned. */}
        <div ref={shadow} data-wd-shape style={{ ...corners(b.r), position: "absolute", inset: 0, boxShadow: `${s.rotated ? "40px 0" : "0 40px"} 80px rgb(0 0 0 / 0.28)`, transition: `border-radius ${turn}ms ${ease}, box-shadow ${turn}ms ${ease}` }} />
        <div style={{ position: "absolute", inset: 0, clipPath: folding ? "inset(-40px -40px -40px 50%)" : undefined }}>
          {BUTTONS.map((x, i) => <div key={i} style={{ position: "absolute", right: x.right, top: x.top, width: x.w, height: x.h, borderRadius: 3, background: FINISH.button }} />)}
          <div data-wd-shape style={{
            ...corners(b.r), position: "absolute", inset: 0, background: FINISH.front,
            boxShadow: BODY_SHADE, transition: `border-radius ${turn}ms ${ease}`,
          }} />
          <div data-wd-shape data-wd-screen style={{ ...corners(b.screenR), position: "absolute", left: b.x, top: b.y, width: n.w, height: n.h, overflow: "hidden", background: "var(--bg)", isolation: "isolate" }}>
            {/* The page, upright for the user: counter-turned when the device is turned. */}
            <div style={{
              position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
              transform: upright ? `translateY(${n.h}px) rotate(-90deg)` : undefined,
            }} ref={page}>
              {sc.under}
              {/* The window the page shows through, and the page in it. */}
              <div style={{
                position: "absolute", left: sc.clip.x, top: sc.clip.y, width: sc.clip.w, height: sc.clip.h, overflow: "hidden",
                borderRadius: sc.clipR, transition: motion(["left", "top", "width", "height", "border-radius"]),
              }}>
                <iframe ref={frame} src={src} title="Duet on the iPhone Duo" tabIndex={embed ? -1 : undefined} style={{
                  position: "absolute", left: sc.frame.x, top: sc.frame.y, width: sc.frame.w, height: sc.frame.h,
                  border: 0, display: "block", background: "var(--bg)", pointerEvents: embed ? "none" : undefined, transition: motion(["left", "top", "width", "height"]),
                }} />
              </div>
              {/* System chrome fades in with each new app or screen. */}
              <div key={`${s.app}-${s.posture}-${upright}`} data-wd-callout={slots || undefined} style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: `wd-in ${MOVE}ms ${ease} both` }}>{sc.chrome}</div>
            </div>
            {s.posture === "closed" && <Island live={live} />}
            {s.posture === "open" && <Crease />}
          </div>
        </div>
          {folding && <Flap ref={flap} />}
        </div>
        </div>
      </div>
      </div>

      {/* Embedded, the button and the controls it reveals share one grid cell, so swapping them moves nothing below. */}
      <div style={{ display: "grid", justifyItems: "center", alignItems: "center", order: embed ? 1 : undefined }}>
      {embed && (
        <button onClick={() => { setManual(true); setTour(false); }} data-wd-try aria-hidden={manual || undefined} tabIndex={manual ? -1 : undefined}
          style={{ ...control, gridArea: "1/1", visibility: manual ? "hidden" : undefined, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 20px 0 16px", background: "var(--accent)", color: "var(--bg)", fontWeight: 600 }}>
          <Pointer size={18} strokeWidth={2.2} />Try it yourself
        </button>
      )}
      <div aria-hidden={(embed && !manual) || undefined} style={{ gridArea: "1/1", visibility: embed && !manual ? "hidden" : undefined, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", padding: "0 16px", maxWidth: 1100 }}>
        {embed ? <>
        <Segmented value={s.posture} onChange={(posture) => go({ posture })} options={[["closed", "Closed"], ["open", "Open"]]} />
        <Segmented value={s.app} onChange={(app) => go({ app })} options={[["home", "Home"], ["safari", "Safari"], ["split", "Split"], ["window", "Window"]]} />
        <Button onClick={() => go({ rotated: !s.rotated })} label="Rotate"><RotateCw size={17} /></Button>
        <Button onClick={() => setTour((t) => !t)} label={tour ? "Pause" : "Play"} on={tour}>{tour ? <Pause size={17} /> : <Play size={17} />}</Button>
        </> : <>
        {sources && <Segmented value={src} onChange={setSrc} options={sources} />}
        <Segmented value={s.posture} onChange={(posture) => go({ posture })} options={[["closed", "Closed"], ["open", "Open"]]} />
        <Button onClick={() => go({ rotated: !s.rotated })} label="Rotate"><RotateCw size={17} /></Button>
        <Segmented value={s.app} onChange={(app) => go({ app })}
          options={[["home", "Home Screen"], ["safari", "Safari"], ["split", "Split View"], ["window", "Window"]]} />
        {s.app === "split" && <Button onClick={() => go({ pane: s.pane === "right" ? "left" : "right" })} label="Swap"><ArrowLeftRight size={17} /></Button>}
        {s.posture === "closed" && <Button onClick={() => setLive((v) => !v)} label="Live Activity" on={live}><Activity size={17} /></Button>}
        <label title="Drag to fold and unfold by hand" style={{ ...control, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }}>
          Fold
          <input type="range" aria-label="Fold" min={0} max={1} step={0.001} value={scrub ?? (s.posture === "open" ? 1 : 0)}
            onChange={(e) => hold(+e.currentTarget.value)} onPointerUp={release} onKeyUp={release} onBlur={release} style={{ width: 120, accentColor: "var(--accent)" }} />
        </label>
        <Button onClick={() => setSlow((v) => !v)} label="¼ speed" on={slow}><Snail size={17} /></Button>
        <Button onClick={() => setSlots((v) => !v)} label="Slots" on={slots}><Highlighter size={17} /></Button>
        <Button onClick={() => setTour((t) => !t)} label={tour ? "Pause" : "Tour"} on={tour}>{tour ? <Pause size={17} /> : <Play size={17} />}</Button>
        </>}
      </div>
      </div>
      {!beside && <Showing app={s.app} row />}
      <p data-wd-mode={sc.mode} style={{ margin: 0, maxWidth: 560, display: "grid", textAlign: "center", color: "var(--dim)", font: "400 15px/1.45 -apple-system, system-ui", padding: "0 16px" }}>
        <Note mode={sc.mode} text={sc.note + (live && s.posture === "closed" ? LIVE_NOTE : "")} />
        {allNotes().map((n) => { const [m, t] = n.split("|"); return <Note key={n} mode={m} text={t} hidden />; })}
      </p>
      {slots && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", maxWidth: 640, padding: "0 16px", font: "500 13px -apple-system, system-ui", color: "var(--dim)" }}>
          {SLOTS.map(([slot, c, label]) => <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: c }} /><code>{label}</code></span>)}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, outline: "1.5px dashed currentColor" }} />iOS, not yours</span>
          <span style={{ flexBasis: "100%", textAlign: "center" }}>Your controls, by <code>&lt;Duet&gt;</code> prop. Fold or turn the device to see where each one goes.</span>
        </div>
      )}
    </div>
  );
}

/** Where the page is running: in Safari (a tab, a split-view pane, a window) or added to the Home Screen as a web app. */
const SHOWING: Record<App, [string, string]> = {
  home: ["Home Screen", "Web app (PWA)"],
  safari: ["Safari", "Full-screen tab"],
  split: ["Safari", "Split View"],
  window: ["Safari", "Window"],
};
function Showing({ app, row, style }: { app: App; row?: boolean; style?: CSSProperties }) {
  const [title, sub] = SHOWING[app], size = row ? 36 : 60;
  return (
    <div data-wd-showing style={{ display: "flex", flexDirection: row ? "row" : "column", alignItems: "center", gap: row ? 10 : 10, textAlign: row ? "left" : "center", ...style }}>
      {app === "home"
        ? <img src="/apple-touch-icon.png" alt="" width={size} height={size} style={{ borderRadius: size * 0.225, boxShadow: "0 0 0 0.5px var(--line)" }} />
        : <SafariIcon size={size} />}
      <div style={{ font: `400 ${row ? 14 : 15}px/1.3 -apple-system, system-ui`, color: "var(--dim)" }}>
        <b style={{ display: "block", color: "var(--ink)", fontWeight: 600 }}>{title}</b>{sub}
      </div>
    </div>
  );
}

/** Safari's icon: a compass on a white tile. */
function SafariIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="wd-safari" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#19d7ff" /><stop offset="1" stopColor="#1e64f0" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.4" fill="#fff" />
      <rect width="64" height="64" rx="14.4" fill="none" stroke="rgb(0 0 0 / 0.12)" />
      <circle cx="32" cy="32" r="26" fill="url(#wd-safari)" />
      {Array.from({ length: 36 }, (_, i) => <line key={i} x1="32" y1="8.5" x2="32" y2={i % 3 ? 10.5 : 12} stroke="#fff" strokeOpacity={0.85} strokeWidth={i % 3 ? 0.6 : 1} transform={`rotate(${i * 10} 32 32)`} />)}
      <g transform="rotate(45 32 32)">
        <polygon points="28.6,32 35.4,32 32,12" fill="#ff3b30" />
        <polygon points="28.6,32 35.4,32 32,52" fill="#fff" />
      </g>
    </svg>
  );
}

/** The left half of the open body, for the fold: its inner face is the inner display's left half, its outer face
 *  the outer display (hinge on the left once it lies over the right half, as on the closed device). */
function Note({ mode, text, hidden }: { mode: string; text: string; hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} style={{ gridArea: "1/1", visibility: hidden ? "hidden" : undefined }}>
      <b style={{ color: "var(--ink)", textTransform: "capitalize" }}>{mode} mode.</b> {text}
    </span>
  );
}

function Flap({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  const half = BODY.open.w / 2, face: CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden", background: FINISH.front, boxShadow: BODY_SHADE };
  // A soft sheen across each face, so the swinging half reads against a dark page.
  const sheen = <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", cornerShape: "inherit", background: "linear-gradient(90deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02) 70%)", pointerEvents: "none" } as CSSProperties} />;
  return (
    <div ref={ref} style={{ position: "absolute", left: 0, top: 0, width: half, height: BODY.open.h, transformOrigin: "100% 50%", transformStyle: "preserve-3d", transform: "rotateY(180deg)" }}>
      <div data-wd-shape style={{ ...face, ...corners([C.free, C.none, C.none, C.free]) }}>
        <div data-wd-shape style={{ position: "absolute", left: BODY.open.x, top: BODY.open.y, right: 0, bottom: BODY.open.y, ...corners([C.inner, C.none, C.none, C.inner]), background: "var(--bg)" }} />
        {sheen}
      </div>
      <div data-wd-shape style={{ ...face, transform: "rotateY(180deg)", ...corners(BODY.closed.r) }}>
        <div data-wd-shape style={{ position: "absolute", left: BODY.closed.x, top: BODY.open.y, right: 13, bottom: BODY.open.y, ...corners(BODY.closed.screenR), background: "var(--bg)" }} />
        {sheen}
      </div>
    </div>
  );
}

// --- system chrome --------------------------------------------------------------------------------

const glass: CSSProperties = { background: "var(--wd-glass)", boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.12), 0 4px 14px rgb(0 0 0 / 0.08)", backdropFilter: "blur(12px)" };
const windowBg: CSSProperties = { position: "absolute", top: 0, borderRadius: 30, overflow: "hidden", background: "var(--card)", transition: `left 0.7s ${ease}` };
const circle: CSSProperties = { ...glass, width: 49, height: 49, borderRadius: 99, display: "grid", placeItems: "center" };

/** The outer display's camera, in the Dynamic Island. Live Activities (two of them, the worst case measured on the
 *  device) grow it down the strip by DUO.island. In device coordinates, so it stays with the hardware when turned. */
function Island({ live }: { live: boolean }) {
  const w = live ? 58 : CAMERA.d, top = live ? CAMERA.y - 29 : CAMERA.y - CAMERA.d / 2;
  return (
    <div data-wd-system data-wd-island style={{
      position: "absolute", left: CAMERA.x - w / 2, top, width: w, height: live ? 58 + DUO.island : CAMERA.d, borderRadius: 99, background: "#000", zIndex: 2,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingBottom: live ? 12 : 0, boxSizing: "border-box", overflow: "hidden",
      transition: `all ${MOVE}ms ${ease}`,
    }}>
      {live && <>
        <i style={{ width: 30, height: 30, borderRadius: 99, background: "#30d158", display: "grid", placeItems: "center", color: "#fff" }}><Glyph d="M13.83 10.17a8 8 0 0 0 0 3.66M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" size={16} /></i>
        <i style={{ width: 30, height: 30, borderRadius: 99, background: "#0a84ff", display: "grid", placeItems: "center", color: "#fff" }}><Glyph d="m3 11 19-9-9 19-2-8-8-2z" size={15} /></i>
      </>}
    </div>
  );
}

/** iOS's clock and status as the Duo draws them in the strip and in Safari's column (Duo simulator, 3x captures):
 *  the clock over the battery ring. They never slide: when the Island pushes them down they just sit lower. */
function Status({ x, top }: { x: number; top: number }) {
  return (
    <div data-wd-system style={{ position: "absolute", left: x - 40, top, width: 80, display: "grid", justifyItems: "center", gap: 3, color: "var(--ink)", pointerEvents: "none" }}>
      <Clock /><Battery />
    </div>
  );
}

function Clock() {
  return <div style={{ font: "700 15px/16px -apple-system, system-ui", fontVariantNumeric: "tabular-nums" }}>09:41</div>;
}

/** The battery ring, charging (green, bolt in its top gap), wifi inside, the four signal dots just under its bottom gap.
 *  44pt wide, the ring's centre 25pt from the top. */
function Battery() {
  const R = 19.2, at = (deg: number, r = R) => { const a = (deg * Math.PI) / 180; return [22 + r * Math.sin(a), 22 - r * Math.cos(a)].map((v) => +v.toFixed(2)); };
  const arc = (from: number, to: number, r = R) => `M${at(from, r).join(" ")}A${r} ${r} 0 0 1 ${at(to, r).join(" ")}`;
  const wifi = (r: number) => { const [x0, y0] = [22 - r * Math.SQRT1_2, 29.5 - r * Math.SQRT1_2].map((v) => +v.toFixed(2)); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${44 - x0} ${y0}`; };
  return (
    <svg width={44} height={50} viewBox="0 -3 44 50" style={{ display: "block", overflow: "visible" }}>
      <path d={`${arc(20, 129)}${arc(231, 340)}`} fill="none" stroke="#30d158" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M23.6 2 19.4 7H22l-1.4 3 4.2-5h-2.6z" fill="#8e8e93" />
      <path d={`${wifi(11.2)}${wifi(6.9)}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <path d="M22 30.4 19.4 27.8a3.7 3.7 0 0 1 5.2 0z" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
      {[-26.7, -9.3, 9.3, 26.7].map((d) => { const [cx, cy] = at(180 + d, 22.7); return <circle key={d} cx={cx} cy={cy} r={2.2} fill="currentColor" />; })}
    </svg>
  );
}

/** Safari's own column: clock, back and reader at the top (`back`: the back button's top), the +/tabs pill at the
 *  bottom, centred DUO.centerFromEdge from the window's outer edge. `over`: drawn over a frame that includes the
 *  column, where the page paints the rest. */
function SafariColumn({ x, h, col, back, clock, over }: { x: number; h: number; col: Side; back: number; clock?: number; over?: boolean }) {
  const cx = col === "right" ? STRIP - DUO.centerFromEdge : DUO.centerFromEdge, at = (top: number): CSSProperties => ({ position: "absolute", left: cx - DUO.control / 2, top, transition: `top ${MOVE}ms ${ease}` });
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: STRIP, height: h, color: "var(--ink)", pointerEvents: "none", background: over ? undefined : "var(--card)" }}>
      {clock !== undefined && <Status x={cx} top={clock} />}
      <div data-wd-system style={{ ...circle, ...at(back) }}><Glyph d="m15 18-6-6 6-6" /></div>
      <div data-wd-system style={{ ...circle, ...at(back + DUO.control + DUO.gap) }}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <div data-wd-system style={{ ...glass, ...at(h - DUO.bottom - SAFARI.pill), width: DUO.control, height: SAFARI.pill, borderRadius: 99, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center" }}>
        <Glyph d="M5 12h14M12 5v14" /><Glyph d="M8 8h12v12H8zM4 16V4h12" />
      </div>
    </div>
  );
}

function UrlBar({ left, top, width, host }: { left: number; top: number; width: number; host: string }) {
  return <div data-wd-system style={{ position: "absolute", left, top, width, height: 46, borderRadius: 99, ...glass, display: "flex", alignItems: "center", justifyContent: "center", font: "500 17px -apple-system, system-ui", color: "var(--ink)", pointerEvents: "none" }}>{host}</div>;
}

/** Safari unfolded (Duo simulator): back and bookmarks, the address field centred, the +/tabs pill, then the clock
 *  and battery at the end of the row; the tab bar under it. */
function OpenSafari({ w, host }: { w: number; host: string }) {
  const at = (left: number, width = 44): CSSProperties => ({ ...circle, position: "absolute", left, top: 24, width, height: 44 });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: OPEN_BAR, background: "var(--card)", borderBottom: "0.5px solid var(--line)", color: "var(--ink)", pointerEvents: "none" }}>
      <div data-wd-system style={at(20)}><Glyph d="m15 18-6-6 6-6" style={{ opacity: 0.35 }} /></div>
      <div data-wd-system style={at(75)}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <UrlBar left={(w - 356) / 2} top={23} width={356} host={host} />
      <div data-wd-system style={{ ...at(w - 235, 109), display: "flex", justifyContent: "space-evenly", alignItems: "center" }}>
        <Glyph d="M5 12h14M12 5v14" style={{ margin: 0 }} /><Glyph d="M8 8h12v12H8zM4 16V4h12" style={{ margin: 0 }} />
      </div>
      <div data-wd-system style={{ position: "absolute", right: 30, top: 21, display: "flex", alignItems: "center", gap: 11 }}><Clock /><Battery /></div>
      <div data-wd-system style={{ position: "absolute", left: 20, right: 20, top: 80, height: 33, borderRadius: 99, background: "var(--bg)", display: "flex", alignItems: "center", padding: 2, gap: 2, font: "500 13px -apple-system, system-ui" }}>
        {["Duo Lab", "Duo Lab", "Duet"].map((t, i, all) => (
          <div key={i} style={{ flex: 1, height: "100%", borderRadius: 99, display: "grid", placeItems: "center", ...(i === all.length - 1 && { ...glass, flex: 1.4 }) }}>{t}</div>
        ))}
      </div>
    </div>
  );
}

/** The other app in the split: quiet placeholder content, so the eye stays on the Safari pane. */
function OtherApp() {
  const bar = (w: number | string, o = 1): CSSProperties => ({ height: 12, width: w, borderRadius: 6, background: "var(--line)", opacity: o });
  return (
    <div style={{ padding: "64px 22px 0" }}>
      <div style={{ ...bar(150), height: 26, borderRadius: 8, marginBottom: 26 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 0", borderBottom: "0.5px solid var(--line)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 99, background: "var(--line)", flex: "none" }} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}><div style={bar(`${50 + ((i * 17) % 35)}%`)} /><div style={bar(`${70 + ((i * 11) % 25)}%`, 0.6)} /></div>
        </div>
      ))}
    </div>
  );
}

/** The Home Screen beside a Safari window: quiet icon tiles, so the eye stays on the window. */
function HomeScreen({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, padding: "64px 34px 0", boxSizing: "border-box", display: "grid", gridTemplateColumns: "repeat(4, 64px)", gridAutoRows: 64, gap: "34px 30px", justifyContent: "center", alignContent: "start" }}>
      {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ borderRadius: 16, background: "var(--dim)", opacity: 0.25 }} />)}
    </div>
  );
}

function Crease() {
  return <div data-wd-crease style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 18, marginLeft: -9, pointerEvents: "none", zIndex: 1, background: "linear-gradient(90deg, transparent, rgb(0 0 0 / 0.05) 40%, rgb(255 255 255 / 0.06) 55%, transparent)" }} />;
}

function Glyph({ d, style, size = 24 }: { d: string; style?: CSSProperties; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto", ...style }}><path d={d} /></svg>;
}

// --- controls -------------------------------------------------------------------------------------

const control: CSSProperties = { height: 40, borderRadius: 99, border: 0, font: "500 15px -apple-system, system-ui", color: "var(--ink)", cursor: "pointer" };

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" style={{ display: "flex", padding: 3, gap: 2, borderRadius: 99, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }}>
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          style={{ ...control, height: 34, padding: "0 14px", whiteSpace: "nowrap", background: value === v ? "var(--accent)" : "transparent", color: value === v ? "var(--bg)" : "var(--ink)" }}>{label}</button>
      ))}
    </div>
  );
}

function Button({ onClick, label, on, children }: { onClick: () => void; label: string; on?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ ...control, display: "flex", alignItems: "center", gap: 7, padding: "0 16px", background: on ? "var(--accent)" : "var(--card)", color: on ? "var(--bg)" : "var(--ink)", boxShadow: "0 0 0 0.5px var(--line)" }}>
      {children}{label}
    </button>
  );
}

// --- host -----------------------------------------------------------------------------------------

const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
/** true on a desktop browser, where a page shows on the web Duo; false on phones (the iPhone Duo included,
 *  where Duet reads the real device) and inside the web Duo itself; null before hydration. `?plain` opts out. */
export function useDesktop(): boolean | null {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(DESKTOP); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.top === window && !new URLSearchParams(location.search).has("plain") && matchMedia(DESKTOP).matches,
    () => null,
  );
}
