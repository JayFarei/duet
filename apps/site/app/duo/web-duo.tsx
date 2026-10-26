"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Activity, AppWindow, ChevronLeft, ChevronRight, Compass, Highlighter, House, PanelLeft, PanelRight, Pause, Play, Pointer, RotateCcw, RotateCw, Smartphone, Snail, Tablet } from "lucide-react";
import { DUO, SAFARI, detect, type Mode, type Side, type Signals } from "duet-ui/geometry";

// A web iPhone Duo for desktop browsers: the site runs in an iframe shaped like the device's screen, and the
// iframe gets the signals the real device would give (duet-ui's `duet:signals` emulation), so Duet lays out
// exactly as it would on the phone. Every size is measured on the Duo simulator (docs/research-notes.md), on the
// device, or from its device artwork (tools/media/frame.py).

type Posture = "closed" | "open";
/** home: added to the Home Screen. safari: a full-screen tab. split: Safari in a split-view pane. window: a Safari
 *  window beside the Home Screen. */
type App = "home" | "safari" | "split" | "window";
/** live: Live Activities are running (the visitor's switch, kept across views). They grow the Dynamic Island down
 *  the closed strip, the only place the island is, so `island()` says where they show. */
interface State { posture: Posture; turn: Turn; upside: boolean; app: App; pane: Side; live: boolean }
/** The interface's turn, degrees clockwise from the natural orientation. iOS never turns upside down, so a quarter
 *  either way is all; turned on to its head (`upside`), the device keeps the quarter turn it came from. */
type Turn = -90 | 0 | 90;
/** Where the hardware points, in degrees clockwise. */
const hardware = (s: State) => s.upside ? 180 : s.turn;
/** A quarter turn of the hardware either way, round and round: the interface follows, except on to its head. */
const rotate = (s: State, by: -90 | 90): Partial<State> => {
  const to = (((hardware(s) + by) % 360) + 360) % 360;
  return to === 180 ? { upside: true } : { turn: (to === 270 ? -90 : to) as Turn, upside: false };
};
const UPSIDE_NOTE = "Upside down, iOS keeps the last way up, so the page stays as it was: Duet sees nothing change.";

// Natural orientation: closed is portrait (outer display), open is landscape (inner display). A clockwise turn puts
// the outer camera bottom right, an anticlockwise one top left.
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
// Safari's bottom row (Duo simulator, 3x captures): the address bar and the +/tabs pill share a bottom 33.3pt above
// the window's, upright and sideways. The pill is 103.4 tall; Duet budgets it as SAFARI.pill above DUO.bottom, the same top.
const BAR = { bottom: 33.3, h: 49, w: 335.4, pill: 103.4 };
// Safari windows as the device reports them: outer is the window with its column, page is innerWidth x innerHeight.
// Safari's `screen.*` keeps the closed screen in every state.
const TAB = { w: 466, h: 678, page: { w: 382, h: 580 } }; // closed portrait: the window is the screen
const PANE = { w: 469, page: { w: 385, h: 571 } }; // a split-view pane, either side, 669 tall
const WINDOW = { w: 451, h: 666, page: { w: 369, h: 591 } }; // a window beside the Home Screen (device: 450-453 x 661-670)

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
const TURN = 650; // rotation, ms
const FOLD = 900;
const MOVE = 520; // the page frame moving between apps
// While the device folds or turns the page never blanks, like iOS on the Duo: it starts to blur and dim (VEIL ms), the
// device moves once it is mostly soft (LEAD ms in), the new layout swaps in under the blur, and it sharpens slowly
// (SETTLE_MS), starting before an unfold has quite landed. DIM is the veil's darkening, as a black overlay.
const LEAD = 260, VEIL = 380, SETTLE_MS = 900, BLUR_PX = 16, DIM = 0.2;
const EDGE = 24; // the folding half's thickness, as the device's ~5mm at its scale
const SWING = "cubic-bezier(0.45, 0, 0.2, 1)"; // the fold, eased both ends so the swing reads
const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const HOLD = 1600; // the tour's pause at each stop, once settled

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
  + SLOTS.map(([slot, c]) => `[data-duet-slot="${slot}"] { --wd-c: ${c}; }`).join("\n")
  // Duet's column rim as the flat band the stage's Safari buttons use (site.css [data-wd-col]): in the stage Chrome
  // drops the rim's mask and lights the whole button. Only here, never on the page itself.
  + '\n.duet[data-mode="column"] .duet-glass:not(.duet-accessory)::after { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgb(255 255 255 / 0.2); }';

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
function safariWindow(o: { win: Box; page: Size; col: Side; back: number; clock?: number; low?: number; barX?: number; host: string; mode: Mode; split?: boolean; rounded?: boolean }) {
  const { win, page, col, mode, low = BAR.bottom } = o, colW = win.w - page.w, pageX = col === "left" ? colW : 0, column = mode === "column", bar = win.h - page.h;
  // The address bar centres on the page, or where given (sideways, on the screen); its bottom is the pill's.
  const barW = Math.min(BAR.w, page.w - 36), barX = o.barX ?? pageX + page.w / 2;
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
        <UrlBar left={barX - barW / 2} top={win.h - BAR.bottom - BAR.h} width={barW} host={o.host} />
        <SafariColumn x={col === "left" ? 0 : page.w} h={win.h} col={col} back={o.back} clock={o.clock} low={low} over={column} />
      </div>
    ),
  };
}

/** Where the page sits on the screen, the signals it gets and the system chrome around it. W x H is the screen as
 *  the user sees it (upright). `modeOf`: the mode the page shows for a set of signals. Live Activities push iOS's
 *  clock and Safari's rows down, telling the page nothing. */
function scene(s: State, W: number, H: number, host: string, modeOf: (s: Signals) => Mode): Scene {
  const full = { w: W, h: H }, screen = { x: 0, y: 0, w: W, h: H };
  const push = island(s) ? DUO.island : 0;
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
    // Sideways Safari moves its column to the camera's side and drops the clock. Its buttons keep clear of the camera:
    // back and reader sit below it when it is at the top, the pill rises above it when it is at the bottom.
    const portrait = W < H, page = portrait ? TAB.page : { w: W - STRIP, h: H - 98 }, high = s.turn < 0;
    const signals = sig(page, full, { screen: safariScreen(page) }), mode = modeOf(signals);
    const w = safariWindow(portrait
      ? { win: screen, page, col: "right", back: DUO.top + push, clock: 84 + push, host, mode }
      : { win: screen, page, col: high ? "left" : "right", back: high ? 81.3 : 23.3, low: high ? BAR.bottom : 81.3, barX: W / 2, host, mode });
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

const stop = (posture: Posture, app: App, o: Partial<State> = {}): State => ({ posture, turn: 0, upside: false, app, pane: "right", live: false, ...o });
const TOUR: State[] = [
  stop("closed", "home"), stop("closed", "home", { live: true }),
  stop("open", "home"), stop("open", "home", { turn: 90 }), stop("closed", "home", { turn: 90 }), stop("closed", "home"),
  stop("closed", "safari"), stop("closed", "safari", { live: true }), stop("open", "safari"),
  stop("open", "split"), stop("open", "split", { pane: "left" }), stop("open", "window"),
];
const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);
/** The same view, whatever the Live Activities switch says: the phase list follows views, not the switch. */
const sameView = (a: State, b: State) => same({ ...a, live: false }, { ...b, live: false });
/** Live Activities show: the island exists on the closed outer display only, and is measured upright only. */
const island = (s: State) => s.live && s.posture === "closed" && !s.turn;
/** The phase list: each row starts at a tour stop and lasts until the next row's. */
const PHASES: { group: string; rows: [label: string, at: number][] }[] = [
  { group: "Home Screen web app", rows: [["Closed", 0], ["Unfolded and turned", 2]] },
  { group: "Safari", rows: [["Closed tab", 6], ["Unfolded", 8], ["Split view", 9], ["Window", 11]] },
];
/** Apps that exist in one posture only, upright: anywhere else they fall back to a Safari tab. */
const ONLY: Partial<Record<App, Posture>> = { split: "open", window: "open" };
const fit = (s: State): State => {
  const only = ONLY[s.app];
  return !only || (s.posture === only && !s.turn) ? s : { ...s, app: "safari" };
};

const LIVE_NOTE: Partial<Record<App, string>> = {
  home: " Live Activities grow the Dynamic Island down the strip and push iOS's clock with it, telling the page nothing. Duet's controls already sit below the island's tallest size, so they stay put.",
  safari: " Live Activities grow the Dynamic Island and push Safari's own buttons down, telling the page nothing. Duet's controls already sit below them at their lowest, so they stay put.",
};
/** Every caption the stage can show, rendered invisibly under the real one so the text below never moves.
 *  Built on first use: `scene` needs the styles defined further down. */
let notes: string[] | undefined;
const allNotes = () => notes ??= [...new Set((["closed", "open"] as const).flatMap((posture) => ([0, 90, -90] as const).flatMap((turn) =>
  (["home", "safari", "split", "window"] as const).flatMap((app) => (["left", "right"] as const).flatMap((pane) =>
    (["strip", "column", "inline"] as const).flatMap((m) => [false, true].map((live) => {
      const n = SCREEN[posture], [W, H] = turn ? [n.h, n.w] : [n.w, n.h], st = fit({ posture, turn, upside: false, app, pane, live });
      return `${m}|${scene(st, W, H, "", () => m).note}${island(st) ? LIVE_NOTE[st.app] ?? "" : ""}`;
    }))))))), ...(["strip", "column", "inline"] as const).map((m) => `${m}|${UPSIDE_NOTE}`)];

/** A rough picture of what a screen shows, for the swinging flap to carry under its blur: background boxes, images
 *  and bars for text, from the stage page and the page in its iframe (same origin). Blurred, only colour and layout
 *  read, so a quarter-resolution canvas does. `page` must be unturned: rects are mapped by its scale alone. */
function snapshot(page: HTMLElement) {
  const w = page.offsetWidth, h = page.offsetHeight, S = 0.25, c = document.createElement("canvas");
  c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  c.dataset.w = `${w}`; c.dataset.h = `${h}`;
  const g = c.getContext("2d"), pr = page.getBoundingClientRect(), z = pr.width / w;
  if (!g || !z) return c;
  g.scale(S, S);
  g.fillStyle = getComputedStyle(page.parentElement ?? page).backgroundColor;
  g.fillRect(0, 0, w, h);
  const range = document.createRange();
  const paint = (root: Element, win: Window, map: (r: DOMRect) => Box) => {
    for (const el of root.querySelectorAll("*")) {
      const cs = win.getComputedStyle(el), op = +cs.opacity;
      if (cs.visibility === "hidden" || !op) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const b = map(r);
      if (el instanceof (win as typeof window).HTMLIFrameElement) {
        const doc = el.contentDocument, box = el.parentElement && map(el.parentElement.getBoundingClientRect());
        if (!doc?.body || !box || !el.contentWindow) continue;
        g.save();
        g.beginPath(); g.roundRect(box.x, box.y, box.w, box.h, parseFloat(getComputedStyle(el.parentElement!).borderTopLeftRadius) || 0); g.clip();
        g.fillStyle = win.getComputedStyle(doc.body).backgroundColor; g.fillRect(b.x, b.y, b.w, b.h);
        paint(doc.body, el.contentWindow, (q) => ({ x: b.x + q.left, y: b.y + q.top, w: q.width, h: q.height }));
        g.restore();
        continue;
      }
      g.globalAlpha = op;
      g.fillStyle = cs.backgroundColor;
      g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, Math.min(parseFloat(cs.borderTopLeftRadius) || 0, b.w / 2, b.h / 2)); g.fill();
      if (el instanceof (win as typeof window).HTMLImageElement) try { g.drawImage(el, b.x, b.y, b.w, b.h); } catch {}
      g.globalAlpha = op * 0.5;
      g.fillStyle = cs.color;
      for (const t of el.childNodes) {
        if (t.nodeType !== 3 || !t.textContent?.trim()) continue;
        range.selectNodeContents(t);
        for (const q of range.getClientRects()) { const m = map(q); g.fillRect(m.x, m.y + m.h * 0.2, m.w, m.h * 0.6); }
      }
    }
  };
  paint(page, window, (r) => ({ x: (r.left - pr.left) / z, y: (r.top - pr.top) / z, w: r.width / z, h: r.height / z }));
  g.globalAlpha = 1;
  return c;
}

/** embed: a stage inside a page, sized to its container, touring on its own while on screen. Its controls stay
 *  hidden behind "Try it yourself", which stops the tour. Otherwise a full-window playground. */
export function WebDuo({ src: first, sources, title = "Duet", intro = "This is the site on a web iPhone Duo. Fold it, turn it, split it. On a phone, the site opens directly.", embed = false }: { src: string; sources?: [string, string][]; title?: string; intro?: string; embed?: boolean }) {
  const [src, setSrc] = useState(first);
  const [s, setS] = useState<State>(TOUR[0]);
  // The page inside turns upright only once the device has finished turning, like iOS.
  const [upright, setUpright] = useState<Turn>(0);
  // A fold or turn is in flight: the page is faded out and its frame jumps instead of animating.
  const [instant, setInstant] = useState(false);
  const [folding, setFolding] = useState(false);
  // The posture the stage is sized for: the one a fold is heading to, so the stage settles with the swing, not after it.
  const [shape, setShape] = useState<Posture | null>(null);
  const [tour, setTour] = useState(false);
  const [manual, setManual] = useState(false);
  // "Try it yourself" becomes the toolbar: the pill under the button springs from the button's width to the toolbar's.
  const bar = useRef<HTMLDivElement>(null), tryBtn = useRef<HTMLButtonElement>(null);
  const [widths, setWidths] = useState<{ from: number; to: number } | null>(null);
  const [slots, setSlots] = useState(false);
  // The tour stop last reached (-1: somewhere the tour never goes), for the phase list.
  const [at, setAt] = useState(0);
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
  const fold = useRef<HTMLDivElement>(null), crease = useRef<HTMLDivElement>(null);
  const cur = useRef(s), busy = useRef(false), spin = useRef(0);
  cur.current = s;
  const host = useSyncExternalStore(() => () => {}, () => location.host, () => "");

  // Folding: the right half stays put and the left half swings round the hinge towards the viewer, like a book
  // closing, so the inner screens meet face to face and the outer display ends up in front. The
  // device recentres, so it unfolds from the middle. Web Animations, so timing never depends on React or timers.
  const swing = (open: boolean, easing = SWING) => {
    const o = { duration: FOLD * k.current, easing, fill: "both" as const };
    const [a, b] = open ? [0, 1] : [1, 0];
    const shift = (t: number) => `translateX(${-(1 - t) * BODY.open.w / 4}px)`;
    // The drop shadow follows the device's footprint: the right half, plus the flap's reach left of the hinge.
    const half = BODY.open.w / 2, reach = (t: number) => `${half * (1 - Math.max(0, Math.cos(Math.PI * (1 - t))))}px`;
    const steps = Array.from({ length: 25 }, (_, i) => a + (b - a) * i / 24);
    // Near flat, each face of the flap turns clear and the page shows through it, so content flows from screen to
    // screen with no flat panel popping in: the outer display at the closed end, the inner screen at the open end.
    // Closing, the outer face stays filled to the end: the page under it is still the open layout's right half until
    // the closed one takes over, and showing it would flash Duet's controls in the wrong place.
    // Turned away, a face fills with the page's veiled tone and darkens as it goes edge-on.
    const [fillIn, fillOut] = flap.current?.querySelectorAll<HTMLElement>("[data-wd-fill]") ?? [];
    const [shadeIn, shadeOut] = flap.current?.querySelectorAll<HTMLElement>("[data-wd-shade]") ?? [];
    // Each face also hides once turned away: WebKit ignores backface-visibility here, and a clear face would show it.
    const [faceIn, faceOut] = flap.current?.querySelectorAll<HTMLElement>("[data-wd-face]") ?? [];
    const fill = (t: number, face: 0 | 1) => face ? (open ? smooth(0.03, 0.42, t) : 1) : 1 - smooth(0.55, 0.97, t);
    const shade = (t: number, face: 0 | 1) => fill(t, face) * DIM + 0.32 * Math.sin(Math.PI / 2 * Math.min(1, 2 * (face ? t : 1 - t)));
    // The body shows left of the hinge only where the flap already covers it (its free edge in perspective, with
    // `P` matching the hinge's perspective), so the page under a clear inner screen lines up as it lands.
    const P = 2600, edge = (t: number) => {
      const f = Math.PI * (1 - t);
      return t >= 1 ? -40 : f >= Math.PI / 2 ? half : half - half * Math.cos(f) * P / (P - half * Math.sin(f)) + 2;
    };
    return [
      faceIn?.animate(steps.map((t) => ({ opacity: t >= 0.5 ? 1 : 0 })), o),
      faceOut?.animate(steps.map((t) => ({ opacity: t <= 0.5 ? 1 : 0 })), o),
      fillIn?.animate(steps.map((t) => ({ opacity: fill(t, 0) })), o),
      fillOut?.animate(steps.map((t) => ({ opacity: fill(t, 1) })), o),
      shadeIn?.animate(steps.map((t) => ({ opacity: shade(t, 0) })), o),
      shadeOut?.animate(steps.map((t) => ({ opacity: shade(t, 1) })), o),
      fold.current?.animate(steps.map((t) => ({ clipPath: `inset(-40px -40px -40px ${edge(t)}px)` })), o),
      // The half that stays put shades towards the hinge while the other half stands over it.
      crease.current?.animate(steps.map((t) => ({ opacity: 0.45 * Math.sin(Math.PI * t) })), o),
      hinge.current?.animate([{ transform: shift(a) }, { transform: shift(b) }], o),
      flap.current?.animate([{ transform: `rotateY(${180 * (1 - a)}deg)` }, { transform: `rotateY(${180 * (1 - b)}deg)` }], o),
      shadow.current?.animate(steps.map((t) => ({ left: reach(t) })), o),
    ].filter((x): x is Animation => !!x);
  };
  const finished = (as: Animation[]) => Promise.all(as.map((a) => a.finished)).catch(() => {});
  // The eye reads blur by its log, so the radius runs on a square: it softens gradually, and sharpening lingers in
  // the last few pixels instead of snapping clear once the radius is small.
  const veil = (on: boolean, ms: number) => page.current?.animate(Array.from({ length: 13 }, (_, i) => {
    const v = on ? i / 12 : 1 - i / 12;
    return { filter: `blur(${(BLUR_PX * v * v).toFixed(2)}px) brightness(${(1 - DIM * smooth(0, 1, v)).toFixed(3)})` };
  }), { duration: ms * k.current, fill: "forwards" }).finished.catch(() => {});
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms * k.current));
  // The flap's faces carry a blurred snapshot of their screen: the layout being left is painted as the swing starts,
  // the one arriving once it has laid out (unfolding) or from the last time it settled (folding: it is not there yet).
  const snaps = useRef(new Map<string, HTMLCanvasElement>());
  const layout = (x: State) => `${x.app}-${x.posture}-${x.pane}-${x.live}-${src}-${document.documentElement.getAttribute("data-lg-theme")}-${matchMedia("(prefers-color-scheme: dark)").matches}`;
  const snap = () => (page.current && !cur.current.turn ? snapshot(page.current) : undefined);
  const put = (face: 0 | 1, c?: HTMLCanvasElement) => {
    const el = flap.current?.querySelectorAll("[data-wd-snap]")[face];
    if (!el || !c) return;
    // The inner face shows the left half of the open screen at its size; the outer one stretches to its window.
    Object.assign(c.style, { position: "absolute", left: "0", top: "0", filter: `blur(${BLUR_PX}px)`, width: face ? "100%" : `${c.dataset.w}px`, height: face ? "100%" : `${c.dataset.h}px` });
    el.replaceChildren(c);
  };
  // Fill both faces for a swing from `from` (as painted in `before`) towards the other posture.
  const dress = (from: State, before?: HTMLCanvasElement) => {
    const closed = layout(fit({ ...from, posture: "closed" }));
    if (from.posture === "closed") { put(1, before); sleep(FOLD * 0.3).then(() => put(0, snap())); }
    else { put(0, before); put(1, snaps.current.get(closed)); }
  };
  const go = async (next: Partial<State>, fromTour = false) => {
    if (!fromTour) setTour(false);
    if (busy.current) return;
    const p = cur.current, n = { ...p, ...next };
    const only = ONLY[n.app];
    if (next.app && only) [n.posture, n.turn, n.upside] = [only, 0, false]; // picking the app moves the device there
    Object.assign(n, fit(n));
    if (!fromTour) setAt(TOUR.findIndex((t) => sameView(t, n)));
    // Upside down the interface does not turn, so only the device moves.
    if (n.posture === p.posture && n.turn === p.turn) return setS(n);
    // One overlapping timeline: the page softens, the device moves while it is still softening, and the new layout
    // sharpens in, already while an unfold lands.
    busy.current = true;
    flushSync(() => setInstant(true));
    veil(true, VEIL);
    await sleep(LEAD);
    let settled: Promise<unknown> | undefined;
    if (n.posture !== p.posture) {
      const open = n.posture === "open", before = snap();
      flushSync(() => { setFolding(true); setShape(n.posture); if (open) setS(n); });
      dress(p, before);
      const as = swing(open);
      if (open) settled = sleep(FOLD * 0.72).then(() => veil(false, SETTLE_MS));
      await finished(as);
      flushSync(() => { if (!open) setS(n); setFolding(false); setShape(null); });
      as.forEach((a) => a.cancel()); // only the swing: the page's veil is still sharpening
    } else {
      setS(n);
      settled = sleep(TURN * 0.6).then(() => veil(false, SETTLE_MS));
      await sleep(TURN);
    }
    busy.current = false;
    await (settled ?? veil(false, SETTLE_MS));
    page.current?.getAnimations().forEach((a) => a.cancel());
    setInstant(false);
  };

  // The fold scrubber: holding it opens the device (the open layout under a flap at the closed angle) and parks
  // the swing at the thumb; letting go finishes the swing towards the nearer end, from where it was.
  const hold = (t: number) => {
    if (!held.current.length) {
      if (busy.current) return;
      setTour(false);
      busy.current = true;
      veil(true, 160);
      const p = cur.current, before = snap();
      flushSync(() => { setInstant(true); setFolding(true); setS(fit({ ...p, posture: "open" })); });
      dress(p, before);
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
    setShape(open ? "open" : "closed");
    as.forEach((a) => { a.playbackRate = open ? 1 : -1; a.play(); });
    await finished(as);
    held.current = [];
    flushSync(() => { if (!open) setS((p) => fit({ ...p, posture: "closed" })); setFolding(false); setShape(null); setScrub(null); });
    as.forEach((a) => a.cancel());
    busy.current = false;
    await veil(false, SETTLE_MS);
    page.current?.getAnimations().forEach((a) => a.cancel());
    setInstant(false);
  };

  // Remember each settled layout's snapshot, for the next fold into it. Again later, in case the page was still loading.
  useEffect(() => {
    if (folding || instant || s.turn || upright) return;
    const keep = () => { const c = !busy.current && snap(); if (c) snaps.current.set(layout(cur.current), c); };
    const ts = [700, 2500].map((ms) => setTimeout(keep, ms));
    return () => ts.forEach(clearTimeout);
  }, [s, src, folding, instant, upright]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setUpright(s.turn), s.turn === upright ? 0 : turn);
    return () => clearTimeout(t);
  }, [s.turn, upright, turn]);

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
    // Each stop holds for HOLD once the device has settled, however long the move there took.
    let i = sameView(TOUR[at] ?? s, s) ? at : TOUR.findIndex((t) => sameView(t, s)), t = 0, on = true;
    const next = () => { t = window.setTimeout(async () => {
      i = (i + 1) % TOUR.length;
      setAt(i);
      const start = performance.now();
      await go(TOUR[i], true);
      if (!on) return;
      t = window.setTimeout(next, Math.max(0, MOVE * k.current - (performance.now() - start))); // an app change only slides
    }, HOLD); };
    next();
    return () => { on = false; clearTimeout(t); };
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
  const sc = scene({ ...s, turn: upright }, W, H, host, modeOf);

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

  // The glimmer: once each new screen settles, a sheen runs over the buttons Duet put in the page, so the web's own
  // controls stand apart from iOS's. Read from the page itself, in the frame's coordinates.
  const moved = useRef("");
  const [shine, setShine] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const shown = `${s.app}-${s.posture}-${upright}-${seen?.mode}-${src}`;
  useEffect(() => {
    if (slots || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // After the fold and the page's fade-in when the device moved, else once the page has slid into place.
    const wait = (moved.current !== `${s.posture}-${s.turn}` ? LEAD + FOLD + SETTLE_MS * 0.6 : MOVE + 250) * k.current;
    moved.current = `${s.posture}-${s.turn}`;
    const on = setTimeout(() => {
      const d = frame.current?.contentDocument;
      if (!d) return;
      setShine([...d.querySelectorAll<HTMLElement>("[data-duet-slot]")].flatMap((e) => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        return r.width && r.height && cs.visibility !== "hidden" && +cs.opacity > 0.05 ? [{ x: r.left, y: r.top, w: r.width, h: r.height }] : [];
      }));
    }, wait);
    const off = setTimeout(() => setShine([]), wait + 1500);
    return () => { clearTimeout(on); clearTimeout(off); setShine([]); };
  }, [shown, slots]);

  // Fit the turned device and the controls in the window.
  // What a person can do to the device: fold it, turn it, pick an app, and, open and upright, multitask Safari.
  // One pill of icons, so it fits beside Duet on a phone: fold, turn, pick what runs. Split View and a window need
  // the device open and upright, and picking one gets it there; picking Split View again swaps Safari's side.
  const split = s.app === "split", Pane = s.pane === "left" ? PanelLeft : PanelRight;
  const commands = (
    <div ref={bar} role="toolbar" aria-label="Device" data-wd-pop={embed ? (manual ? 1 : 0) : undefined} style={{ ...group, alignItems: "center", ...(embed && widths && { position: "relative",
      width: manual ? widths.to : widths.from, background: manual ? "var(--card)" : "var(--accent)", justifyContent: "center", ["--wd-spring" as string]: SPRING,
      transition: `width 760ms ${SPRING}, background 260ms ease, box-shadow 260ms ease`, boxShadow: manual ? group.boxShadow : "none",
    }) }}>
      <Tool label={s.posture === "open" ? "Fold" : "Unfold"} onClick={() => go({ posture: s.posture === "open" ? "closed" : "open" })}>
        {s.posture === "open" ? <Tablet size={18} style={{ rotate: "90deg" }} /> : <Smartphone size={18} />}
      </Tool>
      <Rule />
      {([[-90, "Rotate left", RotateCcw], [90, "Rotate right", RotateCw]] as const).map(([by, label, Icon]) => (
        <Tool key={by} label={label} onClick={() => go(rotate(s, by))}><Icon size={18} /></Tool>
      ))}
      <Rule />
      <Tool label="Home Screen" on={s.app === "home"} onClick={() => go({ app: "home" })}><House size={18} /></Tool>
      <Tool label="Safari" on={s.app === "safari"} onClick={() => go({ app: "safari" })}><Compass size={18} /></Tool>
      <Tool label={split ? "Swap Split View sides" : "Split View"} on={split} onClick={() => go(split ? { pane: s.pane === "left" ? "right" : "left" } : { app: "split" })}><Pane size={18} /></Tool>
      <Tool label="Safari window" on={s.app === "window"} onClick={() => go({ app: "window" })}><AppWindow size={18} /></Tool>
    </div>
  );
  // The icons burst out of the middle: each starts pulled to the centre and leaves later the further out it lands.
  // Measured once laid out, and again on the press, when the stage has surely settled.
  const gather = () => {
    const el = bar.current, kids = el && [...el.children] as HTMLElement[];
    if (!embed || !el || !kids?.length || !tryBtn.current || !el.offsetWidth) return;
    // Layout offsets, not rects: the hidden icons are scaled and pulled in, and rects would see that.
    const mid = el.clientWidth / 2, first = kids[0], last = kids[kids.length - 1];
    const to = Math.round(last.offsetLeft + last.offsetWidth - first.offsetLeft + 6), half = to / 2;
    for (const c of kids) {
      const x = mid - (c.offsetLeft + c.offsetWidth / 2);
      c.style.setProperty("--wd-x", `${x}px`);
      c.style.setProperty("--wd-delay", `${Math.round(40 + (Math.abs(x) / half) * 130)}ms`);
    }
    setWidths({ from: tryBtn.current.offsetWidth, to });
  };
  useLayoutEffect(gather, [embed, measured]);
  const open = () => {
    gather(); setManual(true); setTour(false);
    // A squeeze before the burst, the way the Dynamic Island gathers before it grows.
    bar.current?.animate([{ scale: "1" }, { scale: "0.9", offset: 0.22 }, { scale: "1" }], { duration: 520, easing: "cubic-bezier(0.3, 0, 0.2, 1)" });
  };
  // The device turns the short way round, so the angle it is drawn at keeps counting past a full turn.
  const hw = hardware(s);
  spin.current += ((((hw - spin.current) % 360) + 540) % 360) - 180;
  const sized = BODY[shape ?? s.posture], [bw, bh] = s.turn && !s.upside ? [sized.h, sized.w] : [sized.w, sized.h];
  // A fold moves the stage with the swing; a turn with the turn.
  const settle = (prop: string) => folding ? `${prop} ${FOLD * k.current}ms ${SWING}` : `${prop} ${turn}ms ${ease}`;
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
      {beside && <Showing app={s.app} style={{ position: "absolute", right: `calc(50% + ${bw * scale / 2 + 40}px)`, width: 170, top: "50%", translate: "0 -50%", transition: settle("right") }} />}
      {beside && <Phases at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live })} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} style={{ position: "absolute", left: `calc(50% + ${bw * scale / 2 + 40}px)`, width: 200, top: "50%", translate: "0 -50%", transition: settle("left") }} />}
      <div style={{ width: bw * scale, height: bh * scale, position: "relative", transition: `${settle("width")}, ${settle("height")}` }}>
        <div style={{
          position: "absolute", left: "50%", top: "50%", width: b.w, height: b.h,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${spin.current}deg)`,
          transition: settle("transform"),
        }}>
        {/* Perspective only while the flap swings: left on, Chrome rasterizes the scaled device at full size and it reads blurry. */}
        <div ref={hinge} style={{ position: "absolute", inset: 0, perspective: folding ? 2600 : undefined }}>
        {/* The drop shadow sits outside the fold's clip, so the clip never cuts it, and is cast down the page however the device is turned. */}
        <div ref={shadow} data-wd-shape style={{ ...corners(b.r), position: "absolute", inset: 0, boxShadow: `${Math.round(40 * Math.sin(hw * Math.PI / 180))}px ${Math.round(40 * Math.cos(hw * Math.PI / 180))}px 80px rgb(0 0 0 / 0.28)`, transition: `border-radius ${turn}ms ${ease}, box-shadow ${turn}ms ${ease}` }} />
        <div ref={fold} style={{ position: "absolute", inset: 0, clipPath: folding ? "inset(-40px -40px -40px 50%)" : undefined }}>
          {BUTTONS.map((x, i) => <div key={i} style={{ position: "absolute", right: x.right, top: x.top, width: x.w, height: x.h, borderRadius: 3, background: FINISH.button }} />)}
          <div data-wd-shape style={{
            ...corners(b.r), position: "absolute", inset: 0, background: FINISH.front,
            boxShadow: BODY_SHADE, transition: `border-radius ${turn}ms ${ease}`,
          }} />
          <div data-wd-shape data-wd-screen style={{ ...corners(b.screenR), position: "absolute", left: b.x, top: b.y, width: n.w, height: n.h, overflow: "hidden", background: "var(--bg)", isolation: "isolate" }}>
            {/* The page, upright for the user: counter-turned when the device is turned. */}
            <div style={{
              position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
              transform: upright > 0 ? `translateY(${n.h}px) rotate(-90deg)` : upright < 0 ? `translateX(${n.w}px) rotate(90deg)` : undefined,
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
                {shine.map((g, i) => <div key={`${shown}-${i}`} data-wd-shine style={{ left: sc.frame.x + g.x, top: sc.frame.y + g.y, width: g.w, height: g.h, "--wd-at": `${i * 90}ms` } as CSSProperties} />)}
              </div>
              {/* System chrome fades in with each new app or screen; under the veil it is just there, so nothing blanks. */}
              <div key={`${s.app}-${s.posture}-${upright}`} data-wd-callout={slots || undefined} style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: instant ? undefined : `wd-in ${MOVE}ms ${ease} both` }}>{sc.chrome}</div>
            </div>
            {s.posture === "closed" && <Island live={island(s)} />}
            {s.posture === "open" && <Crease />}
            {folding && <div ref={crease} style={{ position: "absolute", top: 0, bottom: 0, left: "50%", right: 0, opacity: 0, pointerEvents: "none", zIndex: 1, background: "linear-gradient(90deg, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0.25) 30%, transparent 75%)" }} />}
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
        <button ref={tryBtn} onClick={open} data-wd-try aria-hidden={manual || undefined} tabIndex={manual ? -1 : undefined}
          style={{ ...control, gridArea: "1/1", zIndex: 1, ...(manual && { opacity: 0, scale: "0.8", filter: "blur(4px)", pointerEvents: "none", visibility: "hidden" }),
            transition: "opacity 140ms ease, scale 200ms ease, filter 140ms ease, visibility 0s 200ms", display: "inline-flex", alignItems: "center", gap: 8, padding: "0 20px 0 16px", background: "var(--accent)", color: "var(--bg)", fontWeight: 600 }}>
          <Pointer size={18} strokeWidth={2.2} />Try it yourself
        </button>
      )}
      <div aria-hidden={(embed && !manual) || undefined} style={{ gridArea: "1/1", visibility: embed && !manual && !widths ? "hidden" : undefined, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 1100 }}>
        {embed ? <>
        {commands}
        </> : <>
        {sources && <Segmented value={src} onChange={setSrc} options={sources} />}
        {commands}
        <label title="Drag to fold and unfold by hand" style={{ ...control, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }}>
          Fold
          <input type="range" aria-label="Fold" min={0} max={1} step={0.001} value={scrub ?? (s.posture === "open" ? 1 : 0)}
            onChange={(e) => hold(+e.currentTarget.value)} onPointerUp={release} onKeyUp={release} onBlur={release} style={{ width: 120, accentColor: "var(--accent)" }} />
        </label>
        <Button onClick={() => setSlow((v) => !v)} label="¼ speed" on={slow}><Snail size={18} /></Button>
        <Button onClick={() => setSlots((v) => !v)} label="Slots" on={slots}><Highlighter size={18} /></Button>
        </>}
      </div>
      </div>
      {!beside && <Phases app={s.app} at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live })} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} row />}
      <p data-wd-mode={sc.mode} style={{ margin: 0, maxWidth: 560, display: "grid", textAlign: "center", color: "var(--dim)", font: "400 15px/1.45 -apple-system, system-ui", padding: "0 16px" }}>
        <Note mode={sc.mode} text={s.upside ? UPSIDE_NOTE : sc.note + (island(s) ? LIVE_NOTE[s.app] ?? "" : "")} />
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

/** The tour's phases, grouped by where the page runs: the current one follows the tour, and picking one jumps there
 *  (which pauses the tour). `row`: chips under the stage, where there is no room beside it. */
function Phases({ app, at, tour, onPick, onTour, live, onLive, row, style }: { app?: App; at: number; tour: boolean; onPick: (i: number) => void; onTour: () => void; live: boolean; onLive: () => void; row?: boolean; style?: CSSProperties }) {
  const starts = PHASES.flatMap((g) => g.rows.map(([, i]) => i)).sort((a, b) => a - b);
  const current = at < 0 ? -1 : starts.filter((i) => i <= at).at(-1);
  const item = (label: string, i: number) => {
    const on = i === current;
    return (
      <button key={i} onClick={() => onPick(i)} aria-current={on || undefined} data-wd-phase={i}
        style={{ ...control, height: row ? 32 : 30, padding: row ? "0 12px" : "0 10px", display: "flex", alignItems: "center", gap: 7, width: row ? undefined : "100%", textAlign: "left", font: "500 14px -apple-system, system-ui", whiteSpace: "nowrap",
          background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--dim)", boxShadow: on ? "0 0 0 0.5px var(--line)" : undefined, transition: "background 0.25s, color 0.25s" }}>
        <i style={{ width: 6, height: 6, borderRadius: 99, flex: "none", background: on ? "var(--accent)" : "var(--line)" }} />
        {label}
      </button>
    );
  };
  const toggle = (
    <button onClick={onTour} aria-label={tour ? "Pause the tour" : "Play the tour"} style={{ ...control, height: row ? 32 : 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "var(--dim)", font: "500 13px -apple-system, system-ui" }}>
      {tour ? <Pause size={13} /> : <Play size={13} />}{tour ? "Pause" : "Play tour"}
    </button>
  );
  // Live Activities are a switch, not a phase: they run on top of whichever view is showing.
  const activities = (
    <button role="switch" aria-checked={live} onClick={onLive} data-wd-live title="Live Activities grow the Dynamic Island on the closed display"
      style={{ ...control, height: row ? 32 : 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 8, background: "transparent", color: live ? "var(--ink)" : "var(--dim)", font: "500 14px -apple-system, system-ui", whiteSpace: "nowrap" }}>
      <i style={{ width: 26, height: 16, borderRadius: 99, flex: "none", position: "relative", background: live ? "#30d158" : "var(--line)", transition: "background 0.25s" }}>
        <i style={{ position: "absolute", top: 2, left: live ? 12 : 2, width: 12, height: 12, borderRadius: 99, background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 0.2)", transition: `left 0.25s ${ease}` }} />
      </i>
      Live Activities
    </button>
  );
  if (row) {
    // Narrow, the list folds into one line: play, step back, what is showing, step on, Live Activities; dots below.
    const rows = PHASES.flatMap((g) => g.rows.map(([label, i]) => ({ label, i, group: g.group })));
    const k = rows.findIndex((x) => x.i === current), now = rows[k], [title, sub] = SHOWING[app ?? "safari"];
    const round = (onClick: () => void, label: string, glyph: ReactNode, o: { on?: boolean; role?: string } = {}) => (
      <button onClick={onClick} aria-label={label} title={label} role={o.role} aria-checked={o.role ? o.on : undefined}
        style={{ ...control, width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: o.on ? "var(--card)" : "transparent", color: o.on ? "var(--ink)" : "var(--dim)", boxShadow: o.on ? "0 0 0 0.5px var(--line)" : undefined }}>{glyph}</button>
    );
    const step = (by: number) => onPick(rows[(Math.max(k, 0) + by + rows.length) % rows.length].i);
    return (
      <div data-wd-phases style={{ display: "grid", justifyItems: "center", gap: 8, padding: "0 16px", width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
          {round(onTour, tour ? "Pause the tour" : "Play the tour", tour ? <Pause size={16} /> : <Play size={16} />)}
          {round(() => step(-1), "Previous", <ChevronLeft size={18} />)}
          <div data-wd-showing style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {app === "home"
              ? <img src="/apple-touch-icon.png" alt="" width={32} height={32} style={{ borderRadius: 7, boxShadow: "0 0 0 0.5px var(--line)", flex: "none" }} />
              : <SafariIcon size={32} />}
            <div style={{ font: "400 13px/1.3 -apple-system, system-ui", color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <b style={{ display: "block", color: "var(--ink)", fontWeight: 600, fontSize: 15 }}>{now?.label ?? title}</b>{now ? now.group : sub}
            </div>
          </div>
          {round(() => step(1), "Next", <ChevronRight size={18} />)}
          {round(onLive, "Live Activities", <Activity size={16} />, { on: live, role: "switch" })}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {rows.map((x) => (
            <button key={x.i} onClick={() => onPick(x.i)} aria-label={x.label} aria-current={x.i === current || undefined} data-wd-phase={x.i}
              style={{ ...control, width: 20, height: 20, display: "grid", placeItems: "center", background: "transparent", padding: 0 }}>
              <i style={{ width: x.i === current ? 16 : 6, height: 6, borderRadius: 99, background: x.i === current ? "var(--accent)" : "var(--line)", transition: `width 0.25s ${ease}, background 0.25s` }} />
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <nav data-wd-phases aria-label="Tour phases" style={{ display: "grid", gap: 14, ...style }}>
      {PHASES.map((g) => (
        <div key={g.group} style={{ display: "grid", gap: 2, justifyItems: "start" }}>
          <div style={{ font: "600 12px -apple-system, system-ui", letterSpacing: 0.3, textTransform: "uppercase", color: "var(--dim)", padding: "0 10px 4px" }}>{g.group}</div>
          {g.rows.map(([label, i]) => item(label, i))}
        </div>
      ))}
      <div style={{ display: "grid", justifyItems: "start", gap: 2 }}>{activities}{toggle}</div>
    </nav>
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
  const half = BODY.open.w / 2, face: CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden" };
  // Each screen is a window: the bezel is its spread shadow, so when swing() clears the fill, the page behind shows
  // through. The fill is the page's tone with a soft sheen, so the swinging half reads against a dark page; the shade
  // over it is the veil's dimming plus the darkening as the face turns away.
  const screen = (style: CSSProperties) => (
    <div data-wd-shape style={{ ...style, position: "absolute", overflow: "hidden", boxShadow: `0 0 0 400px ${FINISH.front}` }}>
      <div data-wd-fill style={{ position: "absolute", inset: 0, background: "var(--bg)" }}>
        <div data-wd-snap style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02) 70%)" }} />
      </div>
      <div data-wd-shade style={{ position: "absolute", inset: 0, background: "#000", opacity: DIM }} />
    </div>
  );
  // The rim runs past the hinge edge, where this half meets the other, so no seam shows down the middle.
  const rim = (inset: string) => <div style={{ position: "absolute", inset, borderRadius: "inherit", cornerShape: "inherit", boxShadow: BODY_SHADE } as CSSProperties} />;
  return (
    <div ref={ref} style={{ position: "absolute", left: 0, top: 0, width: half, height: BODY.open.h, transformOrigin: "100% 50%", transformStyle: "preserve-3d", transform: "rotateY(180deg)" }}>
      <div data-wd-shape data-wd-face style={{ ...face, ...corners([C.free, C.none, C.none, C.free]) }}>
        {screen({ left: BODY.open.x, top: BODY.open.y, right: 0, bottom: BODY.open.y, ...corners([C.inner, C.none, C.none, C.inner]) })}
        {rim("0 -4px 0 0")}
      </div>
      <div data-wd-shape data-wd-face style={{ ...face, transform: "rotateY(180deg)", ...corners(BODY.closed.r) }}>
        {screen({ left: BODY.closed.x, top: BODY.open.y, right: 13, bottom: BODY.open.y, ...corners(BODY.closed.screenR) })}
        {rim("0")}
        {/* The camera is hardware: it swings in with the outer display, where the Island takes over once closed. */}
        <div style={{ ...CAMERA_PILL, left: BODY.closed.x + CAMERA.x - CAMERA_PILL.width / 2, top: BODY.closed.y + CAMERA.y - CAMERA_PILL.width / 2, height: CAMERA_PILL.width }} />
      </div>
      {/* The free edge has depth: a band standing square to the faces, unseen flat and full width upright. */}
      <div style={{
        position: "absolute", left: -EDGE / 2, width: EDGE, top: 34, bottom: 34, transform: "rotateY(90deg)", borderRadius: `${EDGE / 2}px / 44px`,
        background: `linear-gradient(90deg, ${FINISH.rim}, ${FINISH.band} 22%, #1c1c1e 50%, ${FINISH.band} 78%, ${FINISH.rim})`,
      }} />
    </div>
  );
}

// --- system chrome --------------------------------------------------------------------------------

const glass: CSSProperties = { background: "var(--wd-glass)", boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.12), 0 4px 14px rgb(0 0 0 / 0.08)", backdropFilter: "blur(12px)" };
const windowBg: CSSProperties = { position: "absolute", top: 0, borderRadius: 30, overflow: "hidden", background: "var(--card)", transition: `left 0.7s ${ease}` };
const circle: CSSProperties = { ...glass, width: 49, height: 49, borderRadius: 99, display: "grid", placeItems: "center" };
/** Safari's column buttons take their look from site.css ([data-wd-col]), Duet's column look. */
const column: CSSProperties = { width: 49, height: 49, borderRadius: 99, display: "grid", placeItems: "center" };

/** A damped spring as a CSS easing (`linear()` points): the Dynamic Island's overshoot and settle. */
const spring = (damping: number, n = 40) => {
  const end = Math.log(400) / damping, wd = Math.sqrt(1 - damping * damping);
  const x = (t: number) => 1 - Math.exp(-damping * t) * (Math.cos(wd * t) + (damping / wd) * Math.sin(wd * t));
  return `linear(${Array.from({ length: n + 1 }, (_, i) => +x((end * i) / n).toFixed(4)).join(", ")})`;
};
const SPRING = spring(0.55), SETTLE = spring(0.8);

/** The Dynamic Island at rest, around the outer display's camera. */
const CAMERA_PILL = { position: "absolute", width: CAMERA.d + 2, borderRadius: 99, background: "#000", boxShadow: "0 0 0 1px var(--wd-island-rim)" } satisfies CSSProperties;

/** The outer display's camera, in the Dynamic Island. Two Live Activities, the worst case measured on the device
 *  (call + Maps), grow it down the strip within DUO.island: the first activity joins the camera's pill, the second
 *  splits off below as its own bubble. They spring out of the camera and back into it, like iOS. In device
 *  coordinates, so it stays with the hardware when turned. */
function Island({ live: want }: { live: boolean }) {
  // Mounted closed, then grown: a device that closes with activities running springs them out of the camera.
  const [live, setLive] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setLive(want)); return () => cancelAnimationFrame(r); }, [want]);
  const w = CAMERA_PILL.width, left = CAMERA.x - w / 2, top = CAMERA.y - w / 2, icon = 30, gap = 6;
  const pill = live ? w + icon + 6 : w, bubble = top + pill + gap;
  // Out: the pill stretches, then the bubble pinches off it. In: the bubble is drawn back first, then the pill.
  const t = (props: string, ms: number, delay: number, easing = SPRING) => props.split(" ").map((p) => `${p} ${ms}ms ${easing} ${delay}ms`).join(", ");
  const shape: CSSProperties = { ...CAMERA_PILL, left, zIndex: 2, overflow: "hidden" };
  const content = (delay: number): CSSProperties => ({
    position: "absolute", left: (w - icon) / 2, bottom: (w - icon) / 2, width: icon, height: icon, borderRadius: 99, display: "grid", placeItems: "center", color: "#fff",
    opacity: live ? 1 : 0, scale: live ? "1" : "0.4", filter: live ? "none" : "blur(4px)",
    transition: live ? t("opacity scale filter", 420, delay) : t("opacity scale filter", 160, 0, "ease-in"),
  });
  return (
    <>
      <div data-wd-system data-wd-island style={{ ...shape, top: live ? bubble : top + pill - w, height: w, scale: live ? "1" : "0.5", opacity: live ? 1 : 0,
        transition: live ? t("top scale", 620, 140) + ", opacity 80ms linear 140ms" : t("top scale", 300, 0, SETTLE) + ", opacity 80ms linear 220ms" }}>
        <i style={{ ...content(320), background: "#0a84ff" }}><Glyph d="m3 11 19-9-9 19-2-8-8-2z" size={15} /></i>
      </div>
      <div data-wd-system data-wd-island style={{ ...shape, top, height: pill, transition: live ? t("height", 560, 0) : t("height", 420, 160) }}>
        <i style={{ ...content(160), color: "#30d158", boxShadow: "inset 0 0 0 1.5px #30d158" }}><Glyph d="M13.83 10.17a8 8 0 0 0 0 3.66M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" size={16} /></i>
      </div>
    </>
  );
}

/** iOS's clock and status as the Duo draws them in the strip and in Safari's column (Duo simulator, 3x captures):
 *  the clock over the battery ring, moving down when the Island grows. */
function Status({ x, top }: { x: number; top: number }) {
  return (
    <div data-wd-system style={{ position: "absolute", left: x - 40, top, width: 80, display: "grid", justifyItems: "center", gap: 3, color: "var(--ink)", pointerEvents: "none", transition: `top ${MOVE}ms ${ease}` }}>
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
 *  bottom (`low`: its bottom above the window's), centred DUO.centerFromEdge from the window's outer edge. `over`: drawn over a frame that includes the
 *  column, where the page paints the rest. */
function SafariColumn({ x, h, col, back, clock, low, over }: { x: number; h: number; col: Side; back: number; clock?: number; low: number; over?: boolean }) {
  const cx = col === "right" ? STRIP - DUO.centerFromEdge : DUO.centerFromEdge, at = (top: number): CSSProperties => ({ position: "absolute", left: cx - DUO.control / 2, top, transition: `top ${MOVE}ms ${ease}` });
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: STRIP, height: h, color: "var(--ink)", pointerEvents: "none", background: over ? undefined : "var(--card)" }}>
      {clock !== undefined && <Status x={cx} top={clock} />}
      <div data-wd-system data-wd-col style={{ ...column, ...at(back) }}><Glyph d="m15 18-6-6 6-6" /></div>
      <div data-wd-system data-wd-col style={{ ...column, ...at(back + DUO.control + DUO.gap) }}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <div data-wd-system data-wd-col style={{ ...at(h - low - BAR.pill), width: DUO.control, height: BAR.pill, borderRadius: 99, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center" }}>
        <Glyph d="M5 12h14M12 5v14" /><Glyph d="M8 8h12v12H8zM4 16V4h12" />
      </div>
    </div>
  );
}

function UrlBar({ left, top, width, host, h = BAR.h }: { left: number; top: number; width: number; host: string; h?: number }) {
  return <div data-wd-system style={{ position: "absolute", left, top, width, height: h, borderRadius: 99, ...glass, display: "flex", alignItems: "center", justifyContent: "center", font: "500 17px -apple-system, system-ui", color: "var(--ink)", pointerEvents: "none" }}>{host}</div>;
}

/** Safari unfolded (Duo simulator): back and bookmarks, the address field centred, the +/tabs pill, then the clock
 *  and battery at the end of the row; the tab bar under it. */
function OpenSafari({ w, host }: { w: number; host: string }) {
  const at = (left: number, width = 44): CSSProperties => ({ ...circle, position: "absolute", left, top: 24, width, height: 44 });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: OPEN_BAR, background: "var(--card)", borderBottom: "0.5px solid var(--line)", color: "var(--ink)", pointerEvents: "none" }}>
      <div data-wd-system style={at(20)}><Glyph d="m15 18-6-6 6-6" style={{ opacity: 0.35 }} /></div>
      <div data-wd-system style={at(75)}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <UrlBar left={(w - 356) / 2} top={23} width={356} h={46} host={host} />
      <div data-wd-system style={{ ...at(w - 234, 89), display: "flex", justifyContent: "space-evenly", alignItems: "center" }}>
        <Glyph d="M5 12h14M12 5v14" style={{ margin: 0 }} /><Glyph d="M8 8h12v12H8zM4 16V4h12" style={{ margin: 0 }} />
      </div>
      <div data-wd-system style={{ position: "absolute", right: 26, top: 21, display: "flex", alignItems: "center", gap: 17 }}><Clock /><Battery /></div>
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

const group: CSSProperties = { display: "flex", padding: 3, gap: 2, borderRadius: 99, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" };
const glyphBox: CSSProperties = { width: 31, height: 34, padding: 0, display: "grid", placeItems: "center" };

/** One icon in a toolbar, named by its tooltip. `on`: the current choice; `off`: not possible from here. */
function Tool({ label, on, off, onClick, children }: { label: string; on?: boolean; off?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={off} aria-label={label} title={label} aria-pressed={on}
      style={{ ...control, ...glyphBox, background: on ? "var(--accent)" : "transparent", color: on ? "var(--bg)" : "var(--ink)", opacity: off ? 0.3 : 1, cursor: off ? "default" : "pointer", transition: "background 0.2s, color 0.2s" }}>{children}</button>
  );
}
const Rule = () => <i aria-hidden style={{ width: 1, height: 18, margin: "0 3px", background: "var(--line)" }} />;

function Button({ onClick, label, on, children }: { onClick: () => void; label: string; on?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-pressed={on} style={{ ...control, width: 40, display: "grid", placeItems: "center", background: on ? "var(--accent)" : "var(--card)", color: on ? "var(--bg)" : "var(--ink)", boxShadow: "0 0 0 0.5px var(--line)" }}>
      {children}
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
