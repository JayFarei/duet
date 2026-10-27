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
// Closed landscape moves the pill on each side and stretches it to 107.6 (SAFARI.landscape has the tops).
const BAR = { bottom: 33.3, h: 49, w: 335.4, pill: 103.4, landPill: 107.6 };
// Safari windows as the device reports them: outer is the window with its column, page is innerWidth x innerHeight.
// Safari's `screen.*` keeps the closed screen in every state.
const TAB = { w: 466, h: 678, page: { w: 382, h: 580 } }; // closed portrait: the window is the screen
const PANE = { w: 469, page: { w: 385, h: 571 } }; // a split-view pane, either side, 669 tall
const WINDOW = { w: 451, h: 666, page: { w: 369, h: 591 } }; // a window beside the Home Screen (device: 450-453 x 661-670)

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
/** A CSS cubic-bezier as a function, for keyframes sampled at even times (the easing then lives in the values). */
const bezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (at(x1, x2, m) < x) lo = m; else hi = m; }
  return at(y1, y2, (lo + hi) / 2);
};
// The turn, timed on Apple's film: two eased legs read as one, leaving rest gently and landing without overshoot.
// The page stays lit and turns with the device, like a phone before iOS turns its interface; near the end iOS turns
// the interface upright: the page blurs, the new layout appears under the blur and sharpens.
const TURN = 800; // rotation, ms
const TURN_EASE = "cubic-bezier(0.45, 0, 0.2, 1)", turnEase = bezier(0.45, 0, 0.2, 1);
const SWAP = 0.85, REFLOW = 100;
const SOFTEN = { px: 10, in: 90, out: 220 }; // the page blurring and back while iOS swaps layouts
const MOVE = 520; // the page frame moving between apps
// Asked for less motion, folds and turns cross-fade: the screen dims over DARK_MS and lights over LIGHT_MS.
const DARK_MS = 160, LIGHT_MS = 360;
// The fold, as Apple's film shows it, drawn in real perspective. Unfolding, the closed device turns on its vertical
// axis, its free edge towards the viewer, until it is edge-on: a thick rounded metal band. It then opens into a V
// towards the viewer, two halves hinged at the far end, and lands flat. Folding runs back. Every surface is a flat
// layer with its own 3D transform under one perspective (no preserve-3d, whose depth sorting and backface handling
// differ between browsers): the closed body and its free side, or the open device's two halves (the body cut at the
// hinge, the right half a copy of the open screen) and their outer edges. A surface turned away from the viewer is
// hidden by pose, so no layer ever shows through another. The swap happens edge-on, where both postures draw the
// same band at the same place. The closed screen dims as it turns away; the open screen is dark glass in the V that
// lights near flat. Folding, the open screen stays lit in the V and dims as it closes, and the closed screen lights a
// moment after it lands.
const FOLDS = { open: { ms: 560, ease: bezier(0.4, 0, 0.2, 1) }, closed: { ms: 520, ease: bezier(0.45, 0, 0.3, 1) } } as const;
const DEPTH = 32; // the closed device's thickness (each half is half of it), at the device's scale: Apple's band is 0.045 of the height
const EDGE_R = DEPTH / 2; // the band's rounded ends, seen edge-on
const PERSPECTIVE = 2400; // the viewer's distance, at the device's scale
const LANDED = { hold: 40, light: 80 }; // folded, the closed screen stays off this long after landing, then lights
// The body's front: black, inside a thin bright rim and a graphite band.
const RIM = `inset 0 0 0 1.5px ${FINISH.rim}, inset 0 0 0 3.5px ${FINISH.band}`;
// The device's side: polished chamfers along both faces, graphite between, and the dark line where the halves meet.
// Edge-on the closed device's side is both halves' edges together, so the full band is the half band and its mirror.
const HALF = "#2c2c2e, #c9c9ce 16%, #6a6a6f 34%, #3a3a3c 86%, #141416";
const SIDE = { half: `linear-gradient(90deg, ${HALF})`, halfR: `linear-gradient(270deg, ${HALF})`,
  both: "linear-gradient(90deg, #2c2c2e, #c9c9ce 8%, #6a6a6f 17%, #3a3a3c 43%, #141416 50%, #3a3a3c 57%, #6a6a6f 83%, #c9c9ce 92%, #2c2c2e)" };
// The open device cut at the hinge: the left half a hair past the middle, over the right half, so no seam opens.
const CUT = { whole: "inset(-40px)", left: "inset(-40px calc(50% - 1px) -40px -40px)", right: "inset(-40px -40px -40px 50%)" };
const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
type Part = "body" | "copy" | "back" | "back2" | "side" | "edgeL" | "edgeR" | "buttons" | "power" | "dark" | "tintL" | "tintR" | "crease" | "shadow";
/** Fold progress t (0 closed, 1 open) as the parts of the device draw it, in the device's coordinates with the origin
 *  at its centre, z towards the viewer (who is PERSPECTIVE away), the front face at z 0 at rest.
 *  Up to edge-on (t 0.5) it is the closed body turned by ψ about its own centre (D/2 behind the face), free edge
 *  towards the viewer, its side showing once it faces the viewer. From there it is the open device as a V, each half
 *  turned φ about the hinge (90° edge-on, 0 flat), the hinge pushed back so the free edges stay where the closed
 *  device's band was; each half's outer edge shows once it faces the viewer.
 *  `lit`: folding, the open screen stays lit in the V and dims as it closes, the closed one stays off; unfolding, the
 *  closed screen dims as it turns away and the open one is dark until near flat. */
function pose(t: number, closed = t <= 0.5, lit = false): Record<Part, Keyframe> {
  const f = (x: number) => x.toFixed(4), D = DEPTH, P = PERSPECTIVE;
  const turn = closed ? Math.min(t, 0.5) / 0.5 : (1 - Math.max(t, 0.5)) / 0.5; // 0 square on, 1 edge-on
  const deg = turn * 90, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // A side seen turned runs between the body's rounded corners (their own sides are the back face showing past the
  // front), growing to the full height edge-on, where its ends are the band's. `long`: its scale for a body h tall.
  const long = (h: number) => 1 - (2 * (C.free.r - EDGE_R) * smooth(0, 0.3, c)) / h, ends = (h: number) => `${f(EDGE_R / long(h))}px`;
  const shown = s > 0.001 ? 1 : 0;
  const x = (px: number, z: number) => px * P / (P - z); // where a point lands on screen (x only)
  const shadow = (l: number, r: number, w: number) => ({ transform: `translateX(${f((l + r) / 2)}px) scaleX(${f((r - l) / w)})` });
  // Square on, the faces carry no transform at all: a 3D transform, even an identity one, makes Chrome resample the
  // layer and soften the rim and screen at rest.
  // Likewise the layers that only the turned device shows are hidden, not just transparent, whenever they do not draw:
  // left composited beside the body they make Chrome composite it too, off the pixel grid, and blur it.
  const flatOn = (k: Keyframe): Keyframe => (turn === 0 ? { ...k, transform: "none" } : k);
  const only = (k: Keyframe, on = k.opacity !== 0): Keyframe => ({ ...k, visibility: on ? "visible" : "hidden" });
  if (closed) {
    const B = BODY.closed, hw = B.w / 2;
    const at = (px: number, pz: number) => x(px * c - pz * s, px * s + pz * c - D / 2); // a point of the body, turned
    const xs = [at(-hw, D / 2), at(-hw, -D / 2), at(hw, D / 2), at(hw, -D / 2)];
    const turned = `translateZ(${-D / 2}px) rotateY(${f(-deg)}deg)`;
    return {
      body: flatOn({ transform: `${turned} translateZ(${D / 2}px)`, clipPath: CUT.whole }), copy: only({ opacity: 0 }),
      back: only(flatOn({ transform: `${turned} translateZ(${-D / 2}px)`, clipPath: CUT.whole, opacity: shown })), back2: only({ opacity: 0 }),
      // The free side faces the viewer once the angle to it opens past the line of sight.
      side: only({ transform: `${turned} translateX(${hw}px) rotateY(90deg) scaleY(${f(long(B.h))})`, opacity: s * (P + D / 2) - hw > 0 ? 1 : 0, borderRadius: `${D / 2}px / ${ends(B.h)}` }),
      edgeL: only({ opacity: 0 }), edgeR: only({ opacity: 0 }),
      buttons: { opacity: +f(c * c) }, power: { opacity: +f(c * c) },
      dark: { opacity: lit ? 1 : +f(0.75 * s * s) }, tintL: { opacity: 0 }, tintR: { opacity: 0 }, crease: { opacity: 0 },
      shadow: shadow(Math.min(...xs), Math.max(...xs), B.w),
    };
  }
  const B = BODY.open, L = B.w / 2, hs = 1 + (BODY.closed.h / B.h - 1) * s * s;
  const zh = (BODY.closed.w / 2 - D / 2 - L) * s; // the hinge, pushed back: edge-on the free edges are the band
  const half = (k: 1 | -1) => `translateZ(${f(zh)}px) rotateY(${f(k * deg)}deg) scaleY(${f(hs)})`;
  // A half's outer edge: centred D/4 behind its face, facing outwards.
  const ex = -L * c - (D / 4) * s, ez = zh + L * s - (D / 4) * c, edgeOn = c * ex + s * (P - ez) > 0 ? 1 : 0;
  const out = x(-L * c - (D / 2) * s, zh + L * s - (D / 2) * c), front = x(-L * c, zh + L * s), l = Math.min(out, front);
  const e = ends(B.h), k = f(long(B.h)), flat = turn === 0;
  return {
    body: flatOn({ transform: half(1), clipPath: flat ? CUT.whole : CUT.left }), copy: only(flatOn({ transform: half(-1), opacity: 1 }), !flat), // open, the copy stays drawn under the body, so its frame is painted when the V shows it
    back: only(flatOn({ transform: `${half(1)} translateZ(${-D / 2}px)`, clipPath: CUT.left, opacity: shown })), back2: only(flatOn({ transform: `${half(-1)} translateZ(${-D / 2}px)`, opacity: shown })),
    side: only({ opacity: 0 }),
    edgeL: only({ transform: `${half(1)} translate3d(${-L}px, 0, ${-D / 4}px) rotateY(-90deg) scaleY(${k})`, opacity: edgeOn, borderRadius: `${D / 2}px 0 0 ${D / 2}px / ${e} 0 0 ${e}` }),
    edgeR: only({ transform: `${half(-1)} translate3d(${L}px, 0, ${-D / 4}px) rotateY(90deg) scaleY(${k})`, opacity: edgeOn, borderRadius: `0 ${D / 2}px ${D / 2}px 0 / 0 ${e} ${e} 0` }),
    buttons: { opacity: +f(c * c) }, power: { opacity: +f(c * c) },
    dark: { opacity: +f(lit ? 0.85 * smooth(0.3, 1, turn) : 0.92 * smooth(0, 0.35, turn)) },
    // Lit from the right: the left half, turned away from the light, is darker, and the crease shades both sides.
    tintL: { opacity: +f(0.3 * s) }, tintR: { opacity: +f(0.08 * s) }, crease: { opacity: +f(Math.min(1, 2 * s) ** 2) },
    shadow: shadow(l, -l, B.w),
  };
}

const HOLD = 1600; // the tour's pause at each stop, once settled
const REDUCE = "(prefers-reduced-motion: reduce)";

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
function safariWindow(o: { win: Box; page: Size; col: Side; back: number; clock?: number; low?: number; pill?: { top: number; h: number }; barX?: number; host: string; mode: Mode; split?: boolean; rounded?: boolean }) {
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
        <SafariColumn x={col === "left" ? 0 : page.w} h={win.h} col={col} back={o.back} clock={o.clock} pill={o.pill ?? { top: win.h - low - BAR.pill, h: BAR.pill }} over={column} />
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
    // back and reader sit below it when it is at the top, the pill rises above it when it is at the bottom. The page
    // reads the side from screen.orientation.angle: an anticlockwise interface turn is 90, a clockwise one 270.
    const portrait = W < H, page = portrait ? TAB.page : { w: W - STRIP, h: H - 98 }, col: Side = portrait || s.turn > 0 ? "right" : "left";
    const signals = sig(page, full, { screen: safariScreen(page), angle: portrait ? 0 : s.turn > 0 ? 270 : 90 }), mode = modeOf(signals);
    const land = SAFARI.landscape[col];
    const w = safariWindow(portrait
      ? { win: screen, page, col, back: DUO.top + push, clock: 84 + push, host, mode }
      : { win: screen, page, col, back: land.top, pill: { top: land.pill, h: BAR.landPill }, barX: W / 2, host, mode });
    return {
      ...w, signals, mode,
      note: portrait
        ? "In a closed Safari tab, Safari leaves its column empty between its own buttons. Duet paints its controls there, so the page keeps its full width."
        : "Turned sideways, Safari keeps its column on the camera's side and moves its buttons. Duet follows them into the gap between.",
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

/** embed: a stage inside a page, sized to its container, touring on its own while on screen. Its controls stay
 *  hidden behind "Try it yourself", which stops the tour. Otherwise a full-window playground. */
export function WebDuo({ src: first, sources, title = "Duet", intro = "This is the site on a web iPhone Duo. Fold it, turn it, split it. On a phone, the site opens directly.", embed = false }: { src: string; sources?: [string, string][]; title?: string; intro?: string; embed?: boolean }) {
  const [src, setSrc] = useState(first);
  const [s, setS] = useState<State>(TOUR[0]);
  // The page inside turns upright only once the device has finished turning, like iOS.
  const [upright, setUpright] = useState<Turn>(0);
  // A fold or turn is in flight: the page is faded out and its frame jumps instead of animating.
  const [instant, setInstant] = useState(false);
  // Live Activities drawing back into the camera before the device unfolds.
  const [retract, setRetract] = useState(false);
  // The reader asked for less motion: folds and turns cross-fade instead of moving.
  const calm = useSyncExternalStore((f) => { const m = matchMedia(REDUCE); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, () => matchMedia(REDUCE).matches, () => false);
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
  const k = useRef(1), held = useRef<{ closed: boolean; as: Animation[]; ms: number } | null>(null);
  k.current = slow ? 4 : 1;
  const turn = measured ? TURN * k.current : 0;
  const frame = useRef<HTMLIFrameElement>(null), frame2 = useRef<HTMLIFrameElement>(null);
  const page = useRef<HTMLDivElement>(null), device = useRef<HTMLDivElement>(null), cast = useRef<HTMLDivElement>(null), shadow = useRef<HTMLDivElement>(null);
  // The device's surfaces (see pose): the body and the open device's right half (a copy), each with its buttons,
  // screen light and shading, and the sides.
  const body = useRef<HTMLDivElement>(null), copy = useRef<HTMLDivElement>(null), back = useRef<HTMLDivElement>(null), back2 = useRef<HTMLDivElement>(null), side = useRef<HTMLDivElement>(null), edgeL = useRef<HTMLDivElement>(null), edgeR = useRef<HTMLDivElement>(null);
  const buttons = useRef<HTMLDivElement>(null), power = useRef<HTMLDivElement>(null), dark = useRef<HTMLDivElement>(null), tintL = useRef<HTMLDivElement>(null), crease = useRef<HTMLDivElement>(null);
  const buttons2 = useRef<HTMLDivElement>(null), power2 = useRef<HTMLDivElement>(null), dark2 = useRef<HTMLDivElement>(null), tintR = useRef<HTMLDivElement>(null), crease2 = useRef<HTMLDivElement>(null);
  const cur = useRef(s), busy = useRef(false), spin = useRef(0);
  cur.current = s;
  const host = useSyncExternalStore(() => () => {}, () => location.host, () => "");

  // A fold, drawn part by part (see pose): keyframes at even times through `ts`, the easing already in the values.
  // `closed`: the posture on screen, the closed device up to edge-on or the open one from there.
  const draw = (ts: number[], ms: number, closed: boolean, lit = false) => {
    const poses = ts.map((t) => pose(t, closed, lit)), o = { duration: ms * k.current, fill: "both" as const };
    const els: Record<Part, (HTMLElement | null)[]> = { body: [body.current], copy: [copy.current], back: [back.current], back2: [back2.current], side: [side.current], edgeL: [edgeL.current], edgeR: [edgeR.current],
      buttons: [buttons.current, buttons2.current], power: [power.current, power2.current], dark: [dark.current, dark2.current],
      tintL: [tintL.current], tintR: [tintR.current], crease: [crease.current, crease2.current], shadow: [shadow.current] };
    return (Object.keys(els) as Part[]).flatMap((part) => { const ks = poses.map((x) => x[part]); return els[part].flatMap((el) => el ? [el.animate(ks, o)] : []); });
  };
  // One half of a fold: the posture it leaves up to edge-on, or the one it reaches from there. The fold's easing runs
  // across both halves, split where it is half done.
  const leg = (unfold: boolean, first: boolean) => {
    const f = FOLDS[unfold ? "open" : "closed"];
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (f.ease(m) < 0.5) lo = m; else hi = m; }
    const [u0, u1] = first ? [0, lo] : [lo, 1], N = 32, closed = unfold === first;
    const ts = Array.from({ length: N + 1 }, (_, i) => {
      const e = Math.min(1, Math.max(0, f.ease(u0 + ((u1 - u0) * i) / N))), t = unfold ? e : 1 - e;
      return closed ? Math.min(t, 0.5) : Math.max(t, 0.5);
    });
    return draw(ts, (u1 - u0) * f.ms, closed, !unfold);
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms * k.current));
  const finished = (as: Animation[]) => Promise.all(as.map((a) => a.finished)).catch(() => {});
  // A style moving from wherever it is now: the screen's light (`dark` turning off and on) or the page's blur while
  // iOS swaps layouts.
  const fade = (el: HTMLElement | null, prop: "opacity" | "filter", to: string, ms: number, easing: string) => {
    if (!el) return sleep(ms);
    const from = getComputedStyle(el)[prop];
    el.getAnimations().forEach((a) => a.cancel());
    el.animate([{ [prop]: from === "none" ? "blur(0px)" : from }, { [prop]: to }], { duration: ms * k.current, easing, fill: "forwards" });
    return sleep(ms);
  };
  const darken = (on: boolean, ms: number) => fade(dark.current, "opacity", on ? "1" : "0", ms, on ? "ease-in" : "ease-out");
  const relit = () => { for (const el of [dark.current, page.current]) el?.getAnimations().forEach((a) => a.cancel()); setInstant(false); };
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
    busy.current = true;
    // Asked for less motion: the screen dims out and back on the new view, and the device is simply there.
    if (calm) {
      flushSync(() => setInstant(true));
      await darken(true, DARK_MS);
      flushSync(() => { setS(n); setUpright(n.turn); });
      await sleep(REFLOW);
      await darken(false, LIGHT_MS);
      busy.current = false;
      return relit();
    }
    flushSync(() => { setInstant(true); setRetract(n.posture !== p.posture); });
    if (n.posture !== p.posture) {
      // The device turns edge-on in the posture it leaves, swaps there (both are the same band) and opens or closes
      // in the new one, in one task so no frame shows between. The screen's light follows the angle (pose).
      const unfold = n.posture === "open";
      let as = leg(unfold, true);
      await finished(as);
      flushSync(() => setS(n));
      as.forEach((a) => a.cancel());
      as = leg(unfold, false);
      await finished(as);
      // Folded, the closed screen lands off and lights a moment later, quickly, as in the film.
      const { hold, light } = LANDED, on = unfold ? null : dark.current?.animate([{ opacity: 1 }, { opacity: 1, offset: hold / (hold + light) }, { opacity: 0 }], { duration: (hold + light) * k.current, fill: "forwards" });
      as.forEach((a) => a.cancel());
      if (on) await finished([on]);
      setRetract(false);
    } else {
      // The device turns with the page lit on it (the layout effect below draws the turn). Near the end iOS swaps in
      // the upright layout: the page blurs, lays out again turned upright under the blur, and comes back sharp. It
      // never leaves the screen.
      setS(n);
      await sleep(TURN * SWAP - SOFTEN.in);
      await fade(page.current, "filter", `blur(${SOFTEN.px}px)`, SOFTEN.in, "ease-in");
      flushSync(() => setUpright(n.turn));
      await sleep(REFLOW);
      await fade(page.current, "filter", "blur(0px)", SOFTEN.out, "ease-out");
      setRetract(false);
    }
    busy.current = false;
    relit();
  };

  // The fold scrubber: holding it parks the fold at the thumb (the closed device below half way, the open one
  // above); letting go finishes the fold towards the nearer end, from where it was.
  const hold = (t: number) => {
    if (!held.current) {
      if (busy.current) return;
      setTour(false);
      busy.current = true;
      flushSync(() => { setInstant(true); setRetract(true); });
    }
    const closed = t < 0.5, ms = FOLDS.open.ms / 2;
    if (held.current?.closed !== closed) {
      flushSync(() => setS((p) => fit({ ...p, posture: closed ? "closed" : "open" })));
      held.current?.as.forEach((a) => a.cancel());
      const ts = Array.from({ length: 33 }, (_, i) => (closed ? 0 : 0.5) + (0.5 * i) / 32);
      held.current = { closed, as: draw(ts, ms, closed), ms };
      held.current.as.forEach((a) => a.pause());
    }
    const f = closed ? t / 0.5 : (t - 0.5) / 0.5;
    held.current!.as.forEach((a) => { a.currentTime = f * ms * k.current; });
    setScrub(t);
  };
  const release = async () => {
    const h = held.current;
    if (!h) return;
    h.as.forEach((a) => { a.playbackRate = h.closed ? -1 : 1; a.play(); });
    await finished(h.as);
    held.current = null;
    h.as.forEach((a) => a.cancel());
    flushSync(() => setScrub(null));
    setRetract(false);
    busy.current = false;
    relit();
  };

  // go() turns the interface itself, while the screen is dark; this catches any other change of turn.
  useEffect(() => {
    if (busy.current) return;
    const t = setTimeout(() => setUpright(s.turn), s.turn === upright ? 0 : turn * SWAP);
    return () => clearTimeout(t);
  }, [s.turn, upright, turn]);

  // The embedded stage tours by itself unless the reader asked for less motion, and only while it is on screen.
  useEffect(() => {
    if (!embed || matchMedia(REDUCE).matches) return;
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
  // The open device's right half in the V: the same page laid out open.
  const [W2, H2] = upright ? [SCREEN.open.h, SCREEN.open.w] : [SCREEN.open.w, SCREEN.open.h];
  const sc2 = s.posture === "open" ? sc : scene({ ...fit({ ...s, posture: "open" }), turn: upright }, W2, H2, host, modeOf);

  // Tell the page what the device would tell it: now, and whenever it (re)loads and says it is listening.
  const signals = JSON.stringify(sc.signals), signals2 = JSON.stringify(sc2.signals);
  useEffect(() => {
    const send = (f: HTMLIFrameElement | null, x: string) => f?.contentWindow?.postMessage({ type: "duet:signals", signals: JSON.parse(x) }, location.origin);
    const post = () => { sent.current = signals; send(frame.current, signals); send(frame2.current, signals2); };
    const ready = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "duet:ready") return;
      if (e.source === frame.current?.contentWindow) { sent.current = signals; send(frame.current, signals); }
      if (e.source === frame2.current?.contentWindow) send(frame2.current, signals2);
    };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [signals, signals2]);

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
    const els = [frame.current, frame2.current], off = els.map((el) => {
      const apply = () => {
        const d = el?.contentDocument;
        if (!d?.head) return;
        if (!d.getElementById("wd-callout")) d.head.append(Object.assign(d.createElement("style"), { id: "wd-callout", textContent: CALLOUT }));
        d.documentElement.toggleAttribute("data-wd-slots", slots);
      };
      apply();
      el?.addEventListener("load", apply);
      return () => el?.removeEventListener("load", apply);
    });
    return () => off.forEach((f) => f());
  }, [slots]);

  // The glimmer: once each new screen settles, a sheen runs over the buttons Duet put in the page, so the web's own
  // controls stand apart from iOS's. Read from the page itself, in the frame's coordinates.
  const moved = useRef("");
  const [shine, setShine] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const shown = `${s.app}-${s.posture}-${upright}-${seen?.mode}-${src}`;
  useEffect(() => {
    if (slots || matchMedia(REDUCE).matches) return;
    // After the fold and the page's fade-in when the device moved, else once the page has slid into place.
    const wait = (moved.current !== `${s.posture}-${s.turn}` ? FOLDS.open.ms + LIGHT_MS : MOVE + 250) * k.current;
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
  // One scale per orientation, the smaller of the two postures', so a fold never resizes the device; the stage box is
  // the larger of the two, so nothing beside it moves on a fold.
  const sideways = hw % 180 !== 0, orient = (x: Size) => sideways ? [x.h, x.w] : [x.w, x.h];
  const scaleFor = (w: number, h: number) => embed ? Math.min(view.w / w, view.h / h, 1) : Math.min((view.w - 64) / w, (view.h - 320) / h, 1);
  const scale = Math.min(...[BODY.closed, BODY.open].map((x) => scaleFor(orient(x)[0], orient(x)[1])));
  const bw = Math.max(...[BODY.closed, BODY.open].map((x) => orient(x)[0])), bh = Math.max(...[BODY.closed, BODY.open].map((x) => orient(x)[1]));
  const settle = (prop: string) => calm || !measured ? "none" : `${prop} ${turn}ms ${TURN_EASE}`;
  // The turn: the angle on the film's curve, the scale moving with it from one orientation's to the other's and never
  // dipping between (the device does not shrink as it turns; the stage clips it at the window's edges). Web Animations
  // at even times, ending on the styles React set.
  const spun = spin.current, drawn = useRef<{ spin: number; scale: number } | null>(null);
  useLayoutEffect(() => {
    const was = drawn.current;
    drawn.current = { spin: spun, scale };
    if (!was || was.spin === spun || calm || !measured) return;
    const N = 40, o = { duration: TURN * k.current };
    const keys = Array.from({ length: N + 1 }, (_, i) => {
      const e = turnEase(i / N);
      return { th: was.spin + (spun - was.spin) * e, sc: was.scale + (scale - was.scale) * e };
    });
    device.current?.animate(keys.map(({ th, sc }) => ({ transform: `translate(-50%, -50%) scale(${sc}) rotate(${th}deg)` })), o);
    cast.current?.animate(keys.map(({ th }) => ({ transform: `rotate(${-th}deg) translateY(${DEPTH}px) rotate(${th}deg)` })), o);
  }, [spun, scale]); // eslint-disable-line react-hooks/exhaustive-deps -- drawn on a change of angle only
  // What the stage shows (Safari or a Home Screen web app) sits beside the device when the widest posture leaves room.
  const widest = Math.max(...[BODY.closed, BODY.open].flatMap((x) => [x.w * scaleFor(x.w, x.h), x.h * scaleFor(x.h, x.w)]));
  const beside = (view.w - widest) / 2 >= 230;
  // System chrome fades in with each new app or screen; while the screen is dark or covered it is just there.
  const chromeKey = `${s.app}-${s.posture}-${upright}`, lastChrome = useRef(chromeKey), fadeChrome = useRef(false);
  if (lastChrome.current !== chromeKey) { fadeChrome.current = !instant; lastChrome.current = chromeKey; }
  const rest = pose(s.posture === "open" ? 1 : 0);
  const motion = (props: string[]) => instant || !measured ? "none" : props.map((x) => `${x} ${MOVE}ms ${ease}`).join(", ");
  // A body with its screen: the device's own (`primary`, the frame the stage talks to and watches), or the open
  // device's copy, whose frame shows the same page laid out open, for the right half in the V.
  const shell = (bd: typeof b, sn: Size, x: Scene, w: number, h: number, primary: boolean, st: Record<Part, Keyframe>) => (
    <div ref={primary ? body : copy} data-wd-shape aria-hidden={primary ? undefined : true} style={{ ...corners(bd.r), position: "absolute", left: -bd.w / 2, top: -bd.h / 2, width: bd.w, height: bd.h,
      background: FINISH.front, boxShadow: RIM, ...(primary ? st.body : { ...st.copy, clipPath: CUT.right, pointerEvents: "none" }) as CSSProperties }}>
      {/* The buttons, on the body's top and free side. A top button is the part above the body, shaded as the top of a
          taller one, and one pixel of rim colour over the rim, so no dark seam shows between them. */}
      {([[primary ? buttons : buttons2, BUTTONS.filter((x) => x.top < 0), st.buttons, "3px 3px 0 0"], [primary ? power : power2, BUTTONS.filter((x) => x.top >= 0), st.power, "0 3px 3px 0"]] as const).map(([ref, xs, o, r], j) => (
        <div key={j} ref={ref} style={{ position: "absolute", inset: 0, ...o as CSSProperties }}>
          {xs.map((x, i) => <div key={i} style={{ position: "absolute", right: x.right, top: x.top, width: x.w, height: x.top < 0 ? 1 - x.top : x.h, borderRadius: r,
            background: x.top < 0 ? `linear-gradient(#6e6e73, #424245) top / 100% ${-x.top}px no-repeat ${FINISH.rim}` : FINISH.button }} />)}
        </div>
      ))}
      {/* clip-path as well as the rounded overflow: in a 3D-turned body Chrome clips a backdrop-filtered layer (the
          Safari glass) to the screen's box only, and its corner would show past the screen's rounded corner. */}
      <div data-wd-shape data-wd-screen={primary || undefined} style={{ ...corners(bd.screenR), clipPath: `inset(0 round ${bd.screenR.map((x) => `${x.round}px`).join(" ")})`, position: "absolute", left: bd.x, top: bd.y, width: sn.w, height: sn.h, overflow: "hidden", background: "var(--bg)", isolation: "isolate" }}>
        {/* The page, upright for the user: counter-turned when the device is turned. */}
        <div ref={primary ? page : undefined} style={{
          position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0",
          transform: upright > 0 ? `translateY(${sn.h}px) rotate(-90deg)` : upright < 0 ? `translateX(${sn.w}px) rotate(90deg)` : undefined,
        }}>
          {x.under}
          {/* The window the page shows through, and the page in it. */}
          <div style={{
            position: "absolute", left: x.clip.x, top: x.clip.y, width: x.clip.w, height: x.clip.h, overflow: "hidden",
            borderRadius: x.clipR, transition: motion(["left", "top", "width", "height", "border-radius"]),
          }}>
            <iframe ref={primary ? frame : frame2} src={src} title={primary ? "Duet on the iPhone Duo" : ""} tabIndex={embed || !primary ? -1 : undefined} aria-hidden={primary ? undefined : true} style={{
              position: "absolute", left: x.frame.x, top: x.frame.y, width: x.frame.w, height: x.frame.h,
              border: 0, display: "block", background: "var(--bg)", pointerEvents: embed || !primary ? "none" : undefined, transition: motion(["left", "top", "width", "height"]),
            }} />
            {primary && shine.map((g, i) => <div key={`${shown}-${i}`} data-wd-shine style={{ left: x.frame.x + g.x, top: x.frame.y + g.y, width: g.w, height: g.h, "--wd-at": `${i * 90}ms` } as CSSProperties} />)}
          </div>
          <div key={chromeKey} data-wd-callout={slots || undefined} style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: fadeChrome.current ? `wd-in ${MOVE}ms ${ease} both` : undefined }}>{x.chrome}</div>
        </div>
        {/* The V's shading: each half's tone, and the crease darkening towards the hinge. */}
        <div ref={primary ? tintL : tintR} style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", ...(primary ? st.tintL : st.tintR) as CSSProperties }} />
        <div ref={primary ? crease : crease2} style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent calc(50% - 90px), rgb(0 0 0 / 0.5) 50%, transparent calc(50% + 90px))", pointerEvents: "none", ...st.crease as CSSProperties }} />
        {primary && s.posture === "closed" && <Island live={island(s) && !retract} />}
      </div>
      {/* The screen switched off: over the screen and a pixel past its edge, so its antialiased rim never shows the
          page's light tone between the bezel and the black. */}
      <div ref={primary ? dark : dark2} data-wd-shape data-wd-dark={primary || undefined} style={{ ...corners(bd.screenR), position: "absolute", left: bd.x - 1, top: bd.y - 1, width: sn.w + 2, height: sn.h + 2, background: "#000", pointerEvents: "none", ...st.dark as CSSProperties, ...(primary && { opacity: 0 }) }} />
    </div>
  );

  return (
    <div ref={stage} style={embed ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" } : { minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "28px 0", background: "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg), #888 12%))" }}>
      {!embed && <header style={{ textAlign: "center" }}>
        <div style={{ font: "800 30px/1 -apple-system, system-ui", letterSpacing: -0.6 }}>{title}</div>
        <div style={{ color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", marginTop: 6 }}>
          {intro}
        </div>
      </header>}

      <div style={{ position: "relative", alignSelf: "stretch", display: "flex", justifyContent: "center", alignItems: "center", visibility: measured ? undefined : "hidden", ...(embed && { height: view.h }) }}>
      {beside && <Showing app={s.app} style={{ position: "absolute", right: "50%", width: 170, top: "50%", translate: `${-(bw * scale / 2 + 40)}px -50%`, transition: settle("translate") }} />}
      {beside && <Phases at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live })} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} style={{ position: "absolute", left: "50%", width: 200, top: "50%", translate: `${bw * scale / 2 + 40}px -50%`, transition: settle("translate") }} />}
      {/* Embedded the stage's height is fixed and the device centred in it, so the box jumps instead of laying out every frame. */}
      <div style={{ width: bw * scale, height: bh * scale, position: "relative", transition: embed ? undefined : `${settle("width")}, ${settle("height")}` }}>
        <div ref={device} data-wd-device data-wd-posture={s.posture} style={{
          position: "absolute", left: "50%", top: "50%", width: b.w, height: b.h,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${spin.current}deg)`,
        }}>
        {/* The drop shadow is cast down the page however the device is turned: its offset is turned back by the device's
            own angle, so mid-turn it still falls straight down. A blurred fill, not a box-shadow: a box-shadow is hollow,
            and moved out from under the body its hole shows as a pale slab. */}
        <div ref={cast} style={{ position: "absolute", inset: 0, transform: `rotate(${-spin.current}deg) translateY(${DEPTH}px) rotate(${spin.current}deg)` }}>
          <div ref={shadow} data-wd-shape data-wd-shadow style={{ ...corners(b.r), position: "absolute", inset: 0, background: "rgb(0 0 0 / 0.28)", filter: "blur(40px)" }} />
        </div>
        {/* The device under one perspective centred on it: the body (closed, or the open device's left half in the V),
            the open device's right half (a copy with its own frame of the page), and the sides (see pose). */}
        <div style={{ position: "absolute", left: b.w / 2, top: b.h / 2, width: 0, height: 0, perspective: PERSPECTIVE }}>
          {/* The back faces, behind everything: past the front they are the sides of the rounded corners. */}
          {([[back, b, rest.back], [back2, BODY.open, { ...rest.back2, clipPath: CUT.right }]] as const).map(([ref, bd, st], i) => (
            <div key={i} ref={ref} data-wd-shape style={{ ...corners(bd.r), position: "absolute", left: -bd.w / 2, top: -bd.h / 2, width: bd.w, height: bd.h, background: FINISH.band, pointerEvents: "none", ...st as CSSProperties }} />
          ))}
          {shell(BODY.open, SCREEN.open, sc2, W2, H2, false, rest)}
          {shell(b, n, sc, W, H, true, rest)}
          <div ref={side} data-wd-band style={{ position: "absolute", left: -DEPTH / 2, top: -BODY.closed.h / 2, width: DEPTH, height: BODY.closed.h, background: SIDE.both, ...rest.side as CSSProperties }} />
          {([[edgeL, SIDE.half, rest.edgeL], [edgeR, SIDE.halfR, rest.edgeR]] as const).map(([ref, bg, st], i) => (
            <div key={i} ref={ref} style={{ position: "absolute", left: -DEPTH / 4, top: -BODY.open.h / 2, width: DEPTH / 2, height: BODY.open.h, background: bg, ...st as CSSProperties }} />
          ))}
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
function SafariColumn({ x, h, col, back, clock, pill, over }: { x: number; h: number; col: Side; back: number; clock?: number; pill: { top: number; h: number }; over?: boolean }) {
  const cx = col === "right" ? STRIP - DUO.centerFromEdge : DUO.centerFromEdge, at = (top: number): CSSProperties => ({ position: "absolute", left: cx - DUO.control / 2, top, transition: `top ${MOVE}ms ${ease}` });
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: STRIP, height: h, color: "var(--ink)", pointerEvents: "none", background: over ? undefined : "var(--card)" }}>
      {clock !== undefined && <Status x={cx} top={clock} />}
      <div data-wd-system data-wd-col style={{ ...column, ...at(back) }}><Glyph d="m15 18-6-6 6-6" /></div>
      <div data-wd-system data-wd-col style={{ ...column, ...at(back + DUO.control + DUO.gap) }}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <div data-wd-system data-wd-col style={{ ...at(pill.top), width: DUO.control, height: pill.h, borderRadius: 99, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center" }}>
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
