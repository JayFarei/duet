// Duo strip placement engine. Every number is measured from the SwiftUI lab app (duo-lab/ios) on the
// iPhone Duo simulator, iOS 27.1, closed portrait, in iOS points (= CSS px).

/** strip: Home Screen web app, iOS gives us the right-hand strip.
 *  column: Safari tab, closed portrait or a split-view pane; Safari owns the strip and we paint into the
 *  free space of its column (an undocumented WebKit behaviour, so only when every signal matches).
 *  inline: anything else (landscape, open posture full width, keyboard up, other browsers); a right-edge
 *  strip inside the page viewport. */
export type Mode = "strip" | "column" | "inline";
/** Which screen edge the controls hug. strip: wherever iOS puts the strip (its safe-area inset). column:
 *  always right, Safari owns it. inline: the user's choice; no API tells a split-view pane which side of
 *  the screen it is on. */
export type Side = "left" | "right";

export const DUO = {
  /** Strip centre line, from the right screen edge. */
  centerFromEdge: 48.2,
  /** Width of every control, and height of a single round button. */
  control: 49,
  /** Each extra item in a stacked group (actions, leading). */
  groupItem: 51.7,
  /** Tab pill: pad + per item (4 tabs = 212.7, 5 = 262.7). */
  pillPad: 12.7,
  pillItem: 50,
  /** Gap between stacked groups. */
  gap: 11,
  /** First slot top, in screen coordinates, clear of the clock and Dynamic Island in the strip. */
  top: 173.3,
  /** Bottom of the tab pill (and search button, accessory) above the screen bottom. */
  bottom: 23.7,
  /** Mini-player accessory: left inset, gap to the strip column, height. */
  accessory: { left: 50, gapToColumn: 53.3, height: 48 },
  /** Home Screen web app: depth of iOS's top scroll-edge blur into the viewport. */
  edgeBlur: 28,
} as const;

/** Safari's own column in a tab: back + reader rows at the top, a 2-item +/tabs pill at the bottom.
 *  Live Activities grow the Dynamic Island and push the back + reader rows down; the pill never moves.
 *  islandPush is the worst case measured on device (two activities, call + Maps): back 173.3 -> 265. */
export const SAFARI = { rows: 2, pill: DUO.pillPad + 2 * DUO.pillItem, islandPush: 91.7,
  /** Split-view pane (simulator, 2026-10-25): the back slot's top, in the left pane (no status bar) and in the
   *  right pane (under the status bar). The pill sits as in a closed tab, DUO.bottom above the window bottom. */
  splitTop: { left: 23.5, right: 123.5 } } as const;

/** Menu island slots: a button unrolls into a pill of these (Safari's own pill items are 50; 46.5 keeps
 *  every slot above the 44pt touch target). */
export const ISLAND = { pad: 3, item: 46.5 } as const;
/** Morph menu: a labelled list the size of an iOS context menu (rows above the 44pt touch target). */
export const MORPH = { width: 240, row: 44, pad: 6 } as const;

export interface Signals {
  innerWidth: number;
  innerHeight: number;
  /** Safari window incl. its column. Lags rotation by ~400ms; `screen.*` is stale, never use it for Safari. */
  outerWidth: number;
  outerHeight: number;
  visualHeight: number;
  insetTop: number;
  insetBottom: number;
  screenWidth: number;
  screenHeight: number;
  insetRight: number;
  insetLeft: number;
  standalone: boolean;
  /** Inside an iframe: the page cannot paint into Safari's column, so never use it. */
  framed?: boolean;
  /** devicePixelRatio: tells the in-app preview's 375x667 window from an iPhone SE's (2x). */
  pixelRatio?: number;
}

export interface Context {
  mode: Mode;
  side: Side;
  width: number;
  height: number;
  /** Screen-y minus viewport-y (status area above a standalone viewport). */
  offsetTop: number;
  /** strip: screen size. column: Safari window size. inline: safe-area insets top/bottom. */
  screenWidth: number;
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  /** In-app Safari preview (SFSafariViewController, opened from a social or mail app). */
  preview?: boolean;
  /** "wide" when the page has room for two panes side by side (the open Duo, full width), else "narrow"
   *  (closed, split view, closed landscape). From the window width, not the posture. */
  layout: Layout;
  /** Running on an iPhone Duo, in any posture or mode (see isDuo). */
  duo: boolean;
  /** A Safari split-view pane on the open Duo (see isSplit). In column mode nothing tells which pane it is, so
   *  the controls are drawn in both columns, each pane showing only its own (chrome.tsx); `side` is moot. */
  split?: boolean;
}

export type Layout = "narrow" | "wide";
/** Page width from which two panes fit. The page spans the window, controls floating over it: the open Duo gives
 *  951, a split-view pane 385, closed landscape 594, closed Safari 382. */
export const WIDE = 600;
const layoutOf = (pageWidth: number): Layout => pageWidth >= WIDE ? "wide" : "narrow";

/** In-app Safari preview on the closed Duo (simulator, iOS 27.1, and device screenshot 2026-10-25): the page
 *  window is a fixed 375x667 at 3x, a size no iPhone has natively, and the preview's own buttons (close,
 *  reader, back, share/reload/Safari) sit in the column beside it, which the page cannot paint into (it
 *  clips at its edge). So controls go inline, on the left by default, away from the preview's column. */
const PREVIEW = { width: 375, height: 667, pixelRatio: 3 } as const;
export const isPreview = (s: Signals) => !s.standalone && s.pixelRatio === PREVIEW.pixelRatio
  && s.outerWidth === PREVIEW.width && s.outerHeight === PREVIEW.height;

/** Window and screen sizes only the Duo has, as [short, long] sides: the closed screen (Safari's `screen.*` keeps
 *  466x678 after unfolding, so it holds in every Safari state), the open screen, and a split-view pane's window.
 *  Other phones and desktops never match, so apps can switch to a Duo layout on it alone. */
const DUO_SIZES = [[466, 678], [669, 951], [469, 669]] as const;
const duoSize = (w: number, h: number) => DUO_SIZES.some(([a, b]) => Math.abs(Math.min(w, h) - a) <= 1 && Math.abs(Math.max(w, h) - b) <= 1);
export const isDuo = (s: Signals) => duoSize(s.screenWidth, s.screenHeight) || duoSize(s.outerWidth, s.outerHeight);

/** A Safari split-view pane: its window is 469x669 in either pane. Nothing tells the left pane from the right
 *  (device probe 2026-10-25: screenX, availLeft, insets, visualViewport and touch screenX read the same in both),
 *  though Safari's column sits on the pane's outer edge. So the inline side is remembered apart for split view. */
export const isSplit = (s: Signals) => !s.standalone && Math.abs(s.outerWidth - 469) <= 1 && Math.abs(s.outerHeight - 669) <= 1;

/** Measured on the Duo simulator: Safari's column is 84pt wide (outer − inner), the chrome below the
 *  page is 98pt (80 with the compact URL bar), the window is the closed screen's 678pt tall. A split-view
 *  pane on the open Duo (469x669 outer, 385x571 inner) has the same column on its outer edge, so either
 *  side of the page. In-document content paints into it once the document spans both columns (84 + 385 + 84)
 *  and is scrolled 84 across, with `shrink-to-fit=no` in the viewport meta, or Safari zooms the pane out to
 *  fit the wider document (simulator probes, 2026-10-25). */
const SAFARI_COLUMN = { width: [80, 88], chrome: [76, 102], height: [675, 681] } as const;
const within = (v: number, [a, b]: readonly [number, number]) => v >= a && v <= b;

/** preferred: the side the user picked for inline controls, if any. */
export function detect(s: Signals, preferred?: Side, allowColumn = true): Context {
  const duo = isDuo(s);
  if (s.insetRight >= 60 || s.insetLeft >= 60) {
    return { mode: "strip", duo, layout: layoutOf(s.innerWidth), side: s.insetRight >= 60 ? "right" : "left", width: s.innerWidth, height: s.innerHeight, offsetTop: Math.max(0, s.screenHeight - s.innerHeight), screenWidth: s.screenWidth, screenHeight: s.screenHeight, insetTop: s.insetTop, insetBottom: s.insetBottom };
  }
  const base = { duo, width: s.innerWidth, height: s.innerHeight, offsetTop: 0, insetTop: s.insetTop, insetBottom: s.insetBottom };
  const column = allowColumn && !s.standalone && !s.framed
    && within(s.outerWidth - s.innerWidth, SAFARI_COLUMN.width)
    && within(s.outerHeight - s.innerHeight, SAFARI_COLUMN.chrome)
    && s.innerHeight > s.innerWidth // landscape moves Safari's column buttons around
    && s.visualHeight >= s.innerHeight - 1; // keyboard up
  // Safari's page viewport starts at screen top and ends above its address bar (382x580 of 466x678).
  if (column && isSplit(s)) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: "right", screenWidth: s.outerWidth, screenHeight: s.outerHeight, split: true };
  if (column && within(s.outerHeight, SAFARI_COLUMN.height)) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: "right", screenWidth: s.outerWidth, screenHeight: s.outerHeight };
  const preview = isPreview(s), split = isSplit(s);
  return { ...base, mode: "inline", layout: layoutOf(s.innerWidth), side: preferred ?? (preview ? "left" : "right"), screenWidth: s.innerWidth, screenHeight: s.innerHeight, ...(preview && { preview }), ...(split && { split }) };
}

/** Mode flips are a feedback loop when the layout of one mode changes the signals into the other (the
 *  column layer's overflow resizing Safari's viewport). Three flips within FLIP_WINDOW for the same Safari
 *  window pin it to inline until the window changes size. */
export interface Damper { mode?: Mode; flips: number[]; pinned?: string }
const FLIP_WINDOW = 2000;

export function stable(d: Damper, s: Signals, preferred: Side | undefined, now: number): Context {
  const key = `${s.outerWidth}x${s.outerHeight}`;
  if (d.pinned && d.pinned !== key) [d.pinned, d.flips] = [undefined, []];
  let c = detect(s, preferred, !d.pinned);
  if (d.mode && c.mode !== d.mode) {
    d.flips = [...d.flips.filter((t) => now - t < FLIP_WINDOW), now];
    if (d.flips.length >= 3) { d.pinned = key; c = detect(s, preferred, false); }
  }
  d.mode = c.mode;
  return c;
}

/** Inline side drag, like a magnet: the controls resist leaving their edge (rubber band up to MAGNET.hold),
 *  then let go and follow the finger once it pulls MAGNET.release past the start. Released past the middle
 *  of the viewport after letting go, they switch sides; otherwise they snap back. `dx` is the finger's
 *  travel, positive to the right. */
export const MAGNET = { dead: 16, release: 120, hold: 10 } as const;
export function magnet(side: Side, dx: number): { offset: number; free: boolean } {
  const away = side === "right" ? -dx : dx;
  if (away < MAGNET.release) {
    // A dead zone first, so taps and scrubs never nudge the strip, then a stiff rubber band that only hints at the pull.
    const pull = Math.sign(away) * Math.max(0, Math.min(Math.abs(away), MAGNET.release) - MAGNET.dead);
    const offset = Math.sign(pull) * MAGNET.hold * (1 - Math.exp(-Math.abs(pull) / (MAGNET.release - MAGNET.dead)));
    return { offset: side === "right" ? -offset : offset, free: false };
  }
  return { offset: dx, free: true };
}

/** Width the inline strip takes from the page (same column width as Safari's). */
export const INLINE_WIDTH = 84;

export interface Spec {
  back: boolean;
  leading: number;
  actions: number;
  /** Tab count including the search tab. */
  tabs: number;
  /** A standalone search button (searchable without tabs). */
  searchButton: boolean;
  accessory: boolean;
  minimized: boolean;
  /** Items that always live behind "…" (e.g. the inline side switch, destructive actions). */
  menuExtra?: number;
  /** The screen's main action (New chat, Compose): by the thumb above the tabs where one pane shows, at the top
   *  under back where two do, never at the bottom of a wide screen (blueprint). It never folds into "…". */
  primary?: boolean;
}

export interface Box { top: number; height: number }
export interface Plan {
  centerX: number;
  left: number;
  back?: Box;
  /** visible: leading items shown in their own group. */
  leading?: Box & { visible: number };
  /** visible: action slots shown. */
  actions?: Box & { visible: number };
  /** "…": its own round button under the actions, so it alone unrolls into the menu island. */
  more?: Box;
  primary?: Box;
  /** What did not fit, in order, behind the "…" slot: back first, then leading, then actions (indexes). */
  menu: { back: boolean; leading: number; actions: number };
  /** min: only the selected tab shows (minimized, or the full pill does not fit). */
  tabs?: Box & { min: boolean };
  searchButton?: Box;
  accessory?: { left: number; width: number; top: number; height: number };
}

const groupHeight = (n: number) => DUO.control + (n - 1) * DUO.groupItem;

export function plan(c: Context, s: Spec): Plan {
  // column: screen coordinates (the layer is in-document), in the band Safari's column never uses: below
  // its back + reader rows at their worst-case (island-pushed) position, above its +/tabs pill. strip and
  // inline: viewport coordinates.
  const top = c.mode === "strip" ? DUO.top - c.offsetTop
    : c.mode === "column" && c.split ? SAFARI.splitTop[c.side] + SAFARI.rows * (DUO.control + DUO.gap)
    : c.mode === "column" ? DUO.top + SAFARI.islandPush + SAFARI.rows * (DUO.control + DUO.gap)
    : c.insetTop + DUO.gap;
  const bottom = c.mode === "strip" ? c.height - DUO.bottom
    : c.mode === "column" ? c.screenHeight - DUO.bottom - SAFARI.pill - DUO.gap
    : c.height - Math.max(c.insetBottom, DUO.gap);
  const centerX = c.side === "left" ? DUO.centerFromEdge : (c.mode === "column" ? c.screenWidth : c.width) - DUO.centerFromEdge;
  const step = DUO.control + DUO.gap;

  // Safari's column band (146pt) holds two separate round buttons: the selected tab and "…" (or the one
  // item that fits). Only separate buttons unroll, so nothing is merged into a shared pill to save room.
  // Bottom item: the tab pill (minimized to the selected tab when it would crowd out the "…" slot), or
  // the search button.
  const fullPill = DUO.pillPad + DUO.pillItem * s.tabs;
  const primaryTop = !!s.primary && c.layout === "wide", primaryLow = !!s.primary && !primaryTop;
  const head = (s.back ? step : 0) + (primaryTop ? step : 0) + (s.leading ? groupHeight(s.leading) + DUO.gap : 0) + (s.actions ? step : 0);
  const tabsMin = !!s.tabs && (s.minimized || top + head + fullPill + (primaryLow ? step : 0) > bottom);
  const bottomH = s.tabs ? (tabsMin ? DUO.control : fullPill) : s.searchButton ? DUO.control : 0;
  const lowTop = bottom - bottomH - (bottomH ? DUO.gap : 0) - DUO.control;
  const floor = primaryLow ? lowTop - DUO.gap : bottomH ? bottom - bottomH - DUO.gap : bottom;

  // Show everything that fits; the rest folds into "…" (actions first, then leading, then back).
  let back = s.back ? 1 : 0, leading = s.leading, actions = s.actions;
  const menuCount = () => (s.menuExtra ?? 0) + (s.back ? 1 - back : 0) + (s.leading - leading) + (s.actions - actions);
  const height = () => {
    const parts = [back ? DUO.control : 0, primaryTop ? DUO.control : 0, leading ? groupHeight(leading) : 0, actions ? groupHeight(actions) : 0, menuCount() ? DUO.control : 0].filter(Boolean);
    return parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * DUO.gap;
  };
  while (height() > floor - top) {
    if (actions) actions--; else if (leading) leading--; else if (back) back--; else break;
  }

  const p: Plan = { centerX, left: centerX - DUO.control / 2, menu: { back: s.back && !back, leading: s.leading - leading, actions: s.actions - actions } };
  if (s.tabs) p.tabs = { top: bottom - bottomH, height: bottomH, min: tabsMin };
  else if (s.searchButton) p.searchButton = { top: bottom - DUO.control, height: DUO.control };
  if (primaryLow) p.primary = { top: lowTop, height: DUO.control };

  let y = top;
  if (height() <= floor - top) {
    if (back) { p.back = { top: y, height: DUO.control }; y += step; }
    if (primaryTop) { p.primary = { top: y, height: DUO.control }; y += step; }
    if (leading) { const h = groupHeight(leading); p.leading = { top: y, height: h, visible: leading }; y += h + DUO.gap; }
    if (actions) { const h = groupHeight(actions); p.actions = { top: y, height: h, visible: actions }; y += h + DUO.gap; }
    if (menuCount()) p.more = { top: y, height: DUO.control };
  }
  return { ...p, ...accessory(c, s, centerX, bottom) };
}

function accessory(c: Context, s: Spec, centerX: number, bottom: number): Pick<Plan, "accessory"> {
  if (!s.accessory) return {};
  // Split pane: drawn once, across the page, by the left copy, whose layer starts at the left column's outer edge.
  if (c.mode === "column" && c.split) return { accessory: { left: c.screenWidth - c.width + DUO.gap, width: c.width - 2 * DUO.gap, top: c.height - DUO.gap - DUO.accessory.height, height: DUO.accessory.height } };
  const floor = c.mode === "column" ? c.height - DUO.gap : bottom;
  // Mirrored on the left: inner edge clear of the column, outer edge DUO.accessory.left from the screen edge.
  const left = c.side === "left" ? centerX + DUO.control / 2 + DUO.accessory.gapToColumn : DUO.accessory.left;
  const right = c.side === "left" ? c.width - DUO.accessory.left : c.mode === "column" ? c.width - DUO.gap : centerX - DUO.control / 2 - DUO.accessory.gapToColumn;
  return { accessory: { left, width: right - left, top: floor - DUO.accessory.height, height: DUO.accessory.height } };
}
