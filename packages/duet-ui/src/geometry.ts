// Duo strip placement engine. Every number is measured from the SwiftUI lab app (duo-lab/ios) on the
// iPhone Duo simulator, iOS 27.1, closed portrait, in iOS points (= CSS px).

/** strip: Home Screen web app, iOS gives us the right-hand strip.
 *  column: Safari tab, closed (portrait or landscape) or a split-view pane; Safari owns the strip and we paint
 *  into the free space of its column (an undocumented WebKit behaviour, so only when every signal matches).
 *  inline: anything else (open posture full width, keyboard up, other browsers); a right-edge strip inside
 *  the page viewport. */
export type Mode = "strip" | "column" | "inline";
/** Which screen edge the controls hug. strip: wherever iOS puts the strip (its safe-area inset). column:
 *  wherever Safari puts its column: right in portrait, the side the closed Duo is turned to in landscape.
 *  inline: the user's choice; no API tells a split-view pane which side of the screen it is on. */
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
  /** First slot top, in screen coordinates, clear of the clock and a bare Dynamic Island in the strip. */
  top: 173.3,
  /** Live Activities grow the Dynamic Island down the strip and nothing tells the page, so every band top
   *  assumes the worst case, measured on device (two activities, call + Maps): Safari's back 173.3 -> 265. */
  island: 91.7,
  /** Bottom of the tab pill (and search button, accessory) above the screen bottom. */
  bottom: 23.7,
  /** Mini-player accessory: left inset, gap to the strip column, height. */
  accessory: { left: 50, gapToColumn: 53.3, height: 48 },
  /** Home Screen web app: depth of iOS's top scroll-edge blur into the viewport. */
  edgeBlur: 28,
} as const;

/** Safari's own column in a tab: back + reader rows at the top, a 2-item +/tabs pill at the bottom.
 *  In a closed tab DUO.island pushes the back + reader rows down; the pill never moves. */
export const SAFARI = { rows: 2, pill: DUO.pillPad + 2 * DUO.pillItem,
  /** Split-view pane: the back slot's top. The left pane has no status bar above it. The right pane sits
   *  under the same status column as a closed tab and grows the same way (bare: 124, recording: 178, a
   *  2-slot music activity: ~224), so it takes the closed tab's worst case. The pill sits DUO.bottom above
   *  the window bottom. */
  splitTop: { left: 23.5, right: DUO.top + DUO.island },
  /** Closed landscape (Duo Lab simulator, iOS 27.1, 2026-10-26): the column is on the side the Duo is turned to,
   *  48pt centre line from that edge as in portrait, and its buttons sit differently on each side. `top`: the back
   *  slot's top (reader under it, a step apart); `pill`: the +/tabs pill's top. Turned left (angle 90) the island
   *  heads the column and pushes the back slot down; turned right (270) it sits at the column's foot, under the
   *  pill. Measured with a bare island: how Live Activities grow it in landscape is not yet known. */
  landscape: { left: { top: 81.5, pill: 327 }, right: { top: 23.5, pill: 279 } } } as const;

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
  /** navigator.userAgent and maxTouchPoints: tell iOS and Safari apart (see isIOS, browserOf). Unknown (an
   *  emulator's signals) restricts nothing. */
  userAgent?: string;
  touchPoints?: number;
  /** screen.orientation.angle: in closed landscape, which way the Duo is turned and so which side Safari's column
   *  is on (90: left, 270: right). Unknown keeps landscape inline. */
  angle?: number;
}

export interface Context {
  mode: Mode;
  side: Side;
  width: number;
  height: number;
  /** The smallest `height` seen at this width and orientation, like CSS `100svh`: it ignores Safari's URL bar
   *  collapsing and expanding mid-scroll, so content sized from it does not jump. On a desktop it is `height`.
   *  Also set as `--duet-vh` (px). From `detect` alone (no history) it is `height`; `useDuet` remembers. */
  stableHeight: number;
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
  /** The browser the page runs in (see browserOf). Only Safari gets the column. */
  browser: Browser;
  /** The device the page runs on (see deviceOf). */
  device: Device;
  /** Opened from the Home Screen as a web app, not in a browser tab. */
  standalone: boolean;
}

export type Layout = "narrow" | "wide";
/** Page width from which two panes fit. The page spans the window, controls floating over it: the open Duo gives
 *  951, a split-view pane 385, closed landscape 594, closed Safari 382. */
export const WIDE = 600;
const layoutOf = (pageWidth: number): Layout => pageWidth >= WIDE ? "wide" : "narrow";

/** In-app Safari preview (SFSafariViewController) on the closed Duo. Its own buttons (close, reader, back, and a
 *  share/reload/Safari pill) fill the column beside the page, leaving ~122pt free between them with a bare island
 *  and ~31pt with Live Activities, so controls go inline, on the left by default, away from that column. Two
 *  windows say preview (docs/research-notes.md, "In-app Safari preview"):
 *  - iOS 27.1 (simulator, 2026-10-26, every presentation but a sheet): the closed screen's 466x678 window with an
 *    84pt column like a tab's, but only 75pt below the page (382x603) and the page reaching the screen bottom
 *    (safe-area-inset-bottom 34). A closed tab has 98pt (80 with the compact URL bar) and inset 0. As a sheet
 *    (450x670, page 366x600, inset 34) it reads exactly like windowed Safari, so it is not told apart.
 *    In landscape the preview's bar is above the page, no column width, so it is inline anyway.
 *  - Older builds (device screenshot 2026-10-25): a fixed 375x667 window at 3x, a size no iPhone has natively. */
const PREVIEW = { width: 375, height: 667, pixelRatio: 3, chrome: 77 } as const;
export const isPreview = (s: Signals) => !s.standalone && browserOf(s.userAgent) === "safari" && (
  (s.pixelRatio === PREVIEW.pixelRatio && s.outerWidth === PREVIEW.width && s.outerHeight === PREVIEW.height)
  || (s.insetBottom > 0 && hasColumn(s) && s.outerHeight - s.innerHeight <= PREVIEW.chrome
    && Math.abs(s.outerWidth - DUO_SIZES[0][0]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][1]) <= 1));

/** Window and screen sizes only the Duo has, as [short, long] sides: the closed screen (Safari's `screen.*` keeps
 *  466x678 after unfolding, so it holds in every Safari state), the open screen, and a split-view pane's window.
 *  Other phones and desktops never match, so apps can switch to a Duo layout on it alone. */
const DUO_SIZES = [[466, 678], [669, 951], [469, 669]] as const;
const duoSize = (w: number, h: number) => DUO_SIZES.some(([a, b]) => Math.abs(Math.min(w, h) - a) <= 1 && Math.abs(Math.max(w, h) - b) <= 1);
export const isDuo = (s: Signals) => isIOS(s) !== false && (duoSize(s.screenWidth, s.screenHeight) || duoSize(s.outerWidth, s.outerHeight));

/** iOS has no model in its UA, so the sizes above say Duo; the UA says iPhone. Safari's "Request Desktop Website"
 *  sends a Mac UA, told from a Mac by touch. undefined when the signals carry no UA. */
export const isIOS = (s: Signals) => s.userAgent === undefined ? undefined
  : /iPhone|iPod/.test(s.userAgent) || (/Macintosh/.test(s.userAgent) && (s.touchPoints ?? 0) > 1);

export type Browser = "safari" | "chrome" | "firefox" | "edge" | "webview" | "other";
/** Every iOS browser is WebKit; the others name themselves in the UA. An in-app web view (Instagram, Facebook)
 *  drops the "Safari/" token; the in-app Safari preview keeps it, and is Safari. */
export function browserOf(ua: string | undefined): Browser {
  if (ua === undefined) return "safari";
  if (/EdgiOS|Edg\//.test(ua)) return "edge";
  if (/CriOS|Chrome\//.test(ua)) return "chrome";
  if (/FxiOS|Firefox\//.test(ua)) return "firefox";
  if (/AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return "webview";
  if (/Version\/[\d.]+.*Safari\//.test(ua) && !/OPiOS|OPT\/|GSA\/|Ddg\//.test(ua)) return "safari";
  return "other";
}

export type Device = "duo" | "iphone" | "ipad" | "android" | "desktop";
/** The Duo by its sizes (isDuo), other iOS devices by their screen's short side (an iPad's is 744pt or more,
 *  and iPadOS sends a Mac UA with touch), Android by its UA. Without a UA (an emulator's signals) only the
 *  sizes count. */
export function deviceOf(s: Signals): Device {
  if (isDuo(s)) return "duo";
  const ua = s.userAgent ?? "";
  if (/iPad/.test(ua) || (isIOS(s) && Math.min(s.screenWidth, s.screenHeight) >= 700)) return "ipad";
  if (isIOS(s)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** A Safari split-view pane: its window is 469x669 in either pane. Nothing tells the left pane from the right
 *  (device probe 2026-10-25: screenX, availLeft, insets, visualViewport and touch screenX read the same in both),
 *  though Safari's column sits on the pane's outer edge. So the inline side is remembered apart for split view. */
export const isSplit = (s: Signals) => !s.standalone && isIOS(s) !== false && Math.abs(s.outerWidth - 469) <= 1 && Math.abs(s.outerHeight - 669) <= 1;

/** Measured on the Duo simulator: Safari's column is 84pt wide (outer − inner), the chrome below the
 *  page is 98pt (80 with the compact URL bar), the window is the closed screen's 678pt tall. A split-view
 *  pane on the open Duo (469x669 outer, 385x571 inner) has the same column on its outer edge, so either
 *  side of the page. In-document content paints into it once the document spans both columns (84 + 385 + 84)
 *  and is scrolled 84 across, with `shrink-to-fit=no` in the viewport meta, or Safari zooms the pane out to
 *  fit the wider document (simulator probes, 2026-10-25). Windowed Safari (floating, or beside the Home Screen)
 *  keeps the column at other window sizes (device 2026-10-25: 453x661 and 450x670 outer, 369x591 inner), and a
 *  pane with the compact URL bar has 75pt of chrome, so any portrait Safari window on the Duo with the column counts. */
const SAFARI_COLUMN = { width: [80, 88], chrome: [68, 102] } as const;
const within = (v: number, [a, b]: readonly [number, number]) => v >= a && v <= b;
const hasColumn = (s: Signals) => within(s.outerWidth - s.innerWidth, SAFARI_COLUMN.width) && within(s.outerHeight - s.innerHeight, SAFARI_COLUMN.chrome);

/** preferred: the side the user picked for inline controls, if any. */
export function detect(s: Signals, preferred?: Side, allowColumn = true): Context {
  const duo = isDuo(s), browser = browserOf(s.userAgent), device = deviceOf(s), standalone = s.standalone;
  // Only a Home Screen app owns the strip: a Safari tab reports the column as an 84pt inset for a frame while folding.
  if (s.standalone && (s.insetRight >= 60 || s.insetLeft >= 60)) {
    return { mode: "strip", duo, browser, device, standalone, layout: layoutOf(s.innerWidth), side: s.insetRight >= 60 ? "right" : "left", width: s.innerWidth, height: s.innerHeight, stableHeight: s.innerHeight, offsetTop: Math.max(0, s.screenHeight - s.innerHeight), screenWidth: s.screenWidth, screenHeight: s.screenHeight, insetTop: s.insetTop, insetBottom: s.insetBottom };
  }
  const base = { duo, browser, device, standalone, width: s.innerWidth, height: s.innerHeight, stableHeight: s.innerHeight, offsetTop: 0, insetTop: s.insetTop, insetBottom: s.insetBottom };
  // Closed landscape: the column is on the side the Duo is turned to, and the turn is the only signal for it.
  const landscape = s.innerWidth > s.innerHeight;
  const turned = s.angle === 90 ? "left" : s.angle === 270 ? "right" : undefined;
  const closed = Math.abs(s.outerWidth - DUO_SIZES[0][1]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][0]) <= 1;
  const columnSide: Side | undefined = !landscape ? "right" : closed ? turned : undefined;
  // Other iOS browsers draw their own chrome where Safari has its column: inline for them.
  // An in-app preview has the column signature too, but its column is full of its own buttons.
  const preview = isPreview(s), split = isSplit(s);
  const column = allowColumn && !!columnSide && !s.standalone && !s.framed && browser === "safari" && !preview
    && hasColumn(s) && s.visualHeight >= s.innerHeight - 1; // keyboard up
  // Safari's page viewport starts at screen top and ends above its address bar (382x580 of 466x678).
  if (column && split) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: "right", screenWidth: s.outerWidth, screenHeight: s.outerHeight, split: true };
  if (column && duo) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: columnSide!, screenWidth: s.outerWidth, screenHeight: s.outerHeight };
  return { ...base, mode: "inline", layout: layoutOf(s.innerWidth), side: preferred ?? (preview ? "left" : "right"), screenWidth: s.innerWidth, screenHeight: s.innerHeight, ...(preview && { preview }), ...(split && { split }) };
}

/** Mode flips are a feedback loop when the layout of one mode changes the signals into the other (the
 *  column layer's overflow resizing Safari's viewport). Three flips within FLIP_WINDOW pin the page to inline.
 *  Flips only count while the window keeps its size. The pin lifts when the window changes size, or after `until`: moving a split-view pane to the other side
 *  flips the mode a few times without changing the window's size. Each re-pin for the same window doubles
 *  the wait, so a real loop settles instead of flickering. */
export interface Damper { mode?: Mode; flips: number[]; key?: string; pinned?: string; until?: number; ttl?: number;
  /** Smallest viewport height per width and orientation (Context.stableHeight). */
  heights?: Record<string, number> }
const FLIP_WINDOW = 2000;
export const PIN_TTL = 3000;

/** settling: the window is still moving after a geometry event (signals.ts settling()). A fold lands the viewport
 *  first and outerWidth up to ~2s later, flipping the mode on the way at an unchanged window size, so flips then are
 *  the transition, not a loop, and do not count. */
export function stable(d: Damper, s: Signals, preferred: Side | undefined, now: number, settling = false): Context {
  const key = `${s.outerWidth}x${s.outerHeight}`;
  // A loop keeps the window size; a fold or rotation passes through other sizes, so only same-size flips count.
  if (d.key !== key) Object.assign(d, { key, pinned: undefined, ttl: undefined, flips: [] });
  if (d.pinned && now >= d.until!) Object.assign(d, { pinned: undefined, flips: [] });
  let c = detect(s, preferred, !d.pinned);
  if (d.mode && c.mode !== d.mode && !settling) {
    d.flips = [...d.flips.filter((t) => now - t < FLIP_WINDOW), now];
    if (d.flips.length >= 3) {
      // Doubles only when the loop resumes as the last pin lifts; a later pane move starts from PIN_TTL again.
      d.ttl = d.ttl && d.until !== undefined && now - d.until < FLIP_WINDOW ? d.ttl * 2 : PIN_TTL;
      Object.assign(d, { pinned: key, until: now + d.ttl });
      c = detect(s, preferred, false);
    }
  }
  d.mode = c.mode;
  // A mobile browser's URL bar grows and shrinks the viewport as the page scrolls, while the window keeps its
  // width and orientation. A desktop window has no such bar: its height is the user's, so it stays current.
  if (c.device === "desktop") return c;
  const h = `${s.innerWidth}${s.outerWidth > s.outerHeight ? "L" : "P"}`, heights = d.heights ??= {};
  heights[h] = Math.min(heights[h] ?? Infinity, s.innerHeight);
  return { ...c, stableHeight: heights[h] };
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
   *  under back where two do, never at the bottom of a wide screen (blueprint). It folds into "…" last, only
   *  where the band has no room for it and "…" both. */
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
  /** What did not fit, in order, behind the "…" slot: primary first, then back, leading, actions (indexes). */
  menu: { primary: boolean; back: boolean; leading: number; actions: number };
  /** min: only the selected tab shows (minimized, or the full pill does not fit). */
  tabs?: Box & { min: boolean };
  searchButton?: Box;
  accessory?: { left: number; width: number; top: number; height: number };
  /** Column mode: the band clear of Safari's column buttons (columnBand). Menus crossing the column stay inside
   *  it; only leading items and the primary action may rise above columnTop, into the island's reach. */
  columnTop?: number;
  columnBottom?: number;
}

/** Closed landscape Safari tab: its column's buttons sit apart from portrait's (SAFARI.landscape). */
const landscapeColumn = (c: Context) => !c.split && c.screenWidth > c.screenHeight;
const groupHeight = (n: number) => DUO.control + (n - 1) * DUO.groupItem;

/** Safari's column buttons are an exclusion zone like the insets: native chrome always paints over the page, so
 *  nothing of ours shows over its back + reader rows or its +/tabs pill. `top`: the reader row's bottom plus
 *  DUO.gap, at its worst-case (island-pushed) position. `bottom`: DUO.gap above the pill. `reach`: how far the
 *  island can push the rows, so with a bare island the free band starts that much higher; Live Activities, which
 *  nothing tells the page, take it back. Column mode only; landscape rows are measured with a bare island. */
export function columnBand(c: Context): { top: number; bottom: number; reach: number } | undefined {
  if (c.mode !== "column") return undefined;
  const rows = SAFARI.rows * (DUO.control + DUO.gap), pill = c.screenHeight - DUO.bottom - SAFARI.pill - DUO.gap;
  if (c.split) return { top: SAFARI.splitTop[c.side] + rows, bottom: pill, reach: c.side === "right" ? DUO.island : 0 };
  if (landscapeColumn(c)) return { top: SAFARI.landscape[c.side].top + rows, bottom: SAFARI.landscape[c.side].pill - DUO.gap, reach: 0 };
  return { top: DUO.top + DUO.island + rows, bottom: pill, reach: DUO.island };
}

/** Morph menu placement: the button grows into a labelled list, outer edge on the button's, opening down from
 *  its top or up from its bottom. Where it crosses Safari's column it stays inside the column band (flush with
 *  the column, as Safari's own menus open); a list too tall for that band moves wholly over the page, beside the
 *  column, where it may rise to the top; one too tall even there caps its height and scrolls. x0/y0: the button's
 *  top-left, where the morph starts. */
export function morphBox(c: Context, p: Plan, b: Box, n: number) {
  const w = MORPH.width, full = 2 * MORPH.pad + n * MORPH.row, x0 = p.left, y0 = b.top + b.height / 2 - DUO.control / 2;
  const place = (lo: number, hi: number) => {
    const height = Math.min(full, hi - lo), down = y0 >= lo && y0 + height <= hi;
    return { top: Math.min(Math.max(down ? y0 : y0 + DUO.control - height, lo), hi - height), height };
  };
  const flush = c.side === "left" ? p.left : p.left + DUO.control - w;
  const viewport = [c.insetTop + MORPH.pad, c.height - MORPH.pad] as const;
  if (p.columnTop !== undefined && p.columnBottom !== undefined && full > p.columnBottom - p.columnTop) {
    // Beside the column: its page-side edge a pad in from the column's inner edge.
    const column = c.screenWidth - c.width, left = c.side === "left" ? column + MORPH.pad : c.width - MORPH.pad - w;
    return { left, width: w, ...place(...viewport), scroll: full > viewport[1] - viewport[0], x0, y0 };
  }
  const band = p.columnTop !== undefined && p.columnBottom !== undefined ? [p.columnTop, Math.min(p.columnBottom, viewport[1])] as const : viewport;
  return { left: flush, width: w, ...place(...band), scroll: full > band[1] - band[0], x0, y0 };
}

/** Island menu placement: the button stretches sideways into a pill as tall as itself, outer edge on the
 *  button's. In the column it never rises above columnTop. */
export function islandBox(p: Plan, b: Box, n: number, side: Side) {
  const w = 2 * ISLAND.pad + n * ISLAND.item, top = Math.max(b.top + b.height / 2 - DUO.control / 2, p.columnTop ?? -Infinity);
  return { top, left: side === "left" ? p.left : p.left + DUO.control - w, width: w, height: DUO.control, x0: p.left };
}

export function plan(c: Context, s: Spec): Plan {
  // column: screen coordinates (the layer is in-document), in the band Safari's column never uses: below
  // its back + reader rows at their worst-case (island-pushed) position, above its +/tabs pill. strip and
  // inline: viewport coordinates.
  const col = columnBand(c);
  const top = col ? col.top : c.mode === "strip" ? DUO.top + DUO.island - c.offsetTop : c.insetTop + DUO.gap;
  const bottom = col ? col.bottom : c.mode === "strip" ? c.height - DUO.bottom : c.height - Math.max(c.insetBottom, DUO.gap);
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

  // Show everything that fits; the rest folds into "…" (actions first, then leading, then back). "…" itself
  // always gets a slot: where the band holds only two buttons (a closed Safari tab) the primary action
  // folds too, as the menu's first item, rather than leave folded items unreachable.
  let back = s.back ? 1 : 0, leading = s.leading, actions = s.actions, primary = !!s.primary;
  const floor = () => primaryLow && primary ? lowTop - DUO.gap : bottomH ? bottom - bottomH - DUO.gap : bottom;
  const menuCount = () => (s.menuExtra ?? 0) + (s.back ? 1 - back : 0) + (s.leading - leading) + (s.actions - actions) + (s.primary && !primary ? 1 : 0);
  const height = () => {
    const parts = [back ? DUO.control : 0, primaryTop && primary ? DUO.control : 0, leading ? groupHeight(leading) : 0, actions ? groupHeight(actions) : 0, menuCount() ? DUO.control : 0].filter(Boolean);
    return parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * DUO.gap;
  };
  // With nothing above it, the low primary slot needs only its own room, not a gap under the stack.
  const fitsFrom = (t: number) => height() ? height() <= floor() - t : !(primaryLow && primary) || lowTop >= t;
  while (!fitsFrom(top)) {
    if (actions) actions--; else if (leading) leading--; else if (back) back--; else if (primary) primary = false; else break;
  }
  // The free middle of Safari's column: before folding, the primary action and leading items may rise into the
  // zone the island only takes with Live Activities, the stack packed down onto the tabs so it rises as little as
  // it can. Only they do: back mirrors Safari's own, and "…" stays under the reader row so its menu opens clear of
  // Safari's buttons (morphBox).
  const reachTop = top - (col?.reach ?? 0);
  const reaches = () => fitsFrom(reachTop) && (!menuCount() || floor() - DUO.control >= top);
  if (reachTop < top && fitsFrom(top) && !back) {
    if (s.primary && !primary) { primary = true; if (!reaches()) primary = false; }
    while (leading < s.leading) { leading++; if (!reaches()) { leading--; break; } }
  }
  const fits = () => fitsFrom(top) || (reachTop < top && reaches());

  const p: Plan = { centerX, left: centerX - DUO.control / 2, menu: { primary: !!s.primary && !primary, back: s.back && !back, leading: s.leading - leading, actions: s.actions - actions } };
  if (s.tabs) p.tabs = { top: bottom - bottomH, height: bottomH, min: tabsMin };
  else if (s.searchButton) p.searchButton = { top: bottom - DUO.control, height: DUO.control };
  if (primaryLow && primary) p.primary = { top: lowTop, height: DUO.control };

  if (col) Object.assign(p, { columnTop: top, columnBottom: bottom });
  // Risen into the island's reach: packed down onto the floor instead of hanging from the top.
  let y = fitsFrom(top) ? top : floor() - height();
  if (fits()) {
    if (back) { p.back = { top: y, height: DUO.control }; y += step; }
    if (primaryTop && primary) { p.primary = { top: y, height: DUO.control }; y += step; }
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
  // In Safari's column it spans the page, a gap from its edge on the column's side.
  const column = c.screenWidth - c.width;
  const left = c.mode === "column" && c.side === "left" ? column + DUO.gap : c.side === "left" ? centerX + DUO.control / 2 + DUO.accessory.gapToColumn : DUO.accessory.left;
  const right = c.mode === "column" && c.side === "left" ? c.screenWidth - DUO.accessory.left : c.side === "left" ? c.width - DUO.accessory.left : c.mode === "column" ? c.width - DUO.gap : centerX - DUO.control / 2 - DUO.accessory.gapToColumn;
  return { accessory: { left, width: right - left, top: floor - DUO.accessory.height, height: DUO.accessory.height } };
}
