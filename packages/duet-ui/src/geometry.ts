// Duo strip placement engine. Every number is measured from the SwiftUI lab app (duo-lab/ios) on the
// iPhone Duo simulator, iOS 27.1, closed portrait, in iOS points (= CSS px).

/** strip: Home Screen web app, iOS gives us the right-hand strip.
 *  column: Safari tab, closed (portrait or landscape) or a split-view pane; Safari owns the strip and we paint
 *  into the free space of its column (an undocumented WebKit behaviour, so only when every signal matches).
 *  inline: anything else (open posture full width, other browsers); a right-edge strip inside
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
  /** Bottom of the tab pill (and search button) above the screen bottom. */
  bottom: 23.7,
  /** Home Screen web app: depth of iOS's top scroll-edge blur into the viewport. */
  edgeBlur: 28,
} as const;

/** Safari's own column in a tab: back + reader rows at the top, a 2-item +/tabs pill at the bottom.
 *  In a closed tab DUO.island pushes the back + reader rows down; the pill never moves. `forward`: with forward
 *  history the back button grows into a back + forward pill (100.7pt, Duo Lab and device, 2026-10-27), pushing
 *  the reader row down by one group item, and the reader sits 13pt under it, not 11; nothing tells the page, so
 *  the band always assumes it. */
export const SAFARI = { rows: 2, forward: DUO.groupItem + 2, pill: DUO.pillPad + 2 * DUO.pillItem,
  /** Split-view pane: the back slot's top. The left pane has no status bar above it. The right pane sits
   *  under the same status column as a closed tab but grows less: bare 124, recording 178, music alone or
   *  music and timer Live Activities 224 (Duo Lab, iOS 27.1, 2026-10-30), not the closed tab's 264, so it takes
   *  224. The pill sits DUO.bottom above the window bottom. */
  splitTop: { left: 23.5, right: 224 },
  /** Closed landscape (Duo Lab simulator, iOS 27.1, 2026-10-26): the column is on the side the Duo is turned to,
   *  48pt centre line from that edge as in portrait, and its buttons sit differently on each side. `top`: the back
   *  slot's top (reader under it, a step apart); `pill`: the +/tabs pill's top. Turned left (angle 90) the island
   *  heads the column and pushes the back slot down; turned right (270) it sits at the column's foot, under the
   *  pill. Measured with a bare island: how Live Activities grow it in landscape is not yet known. */
  landscape: { left: { top: 81.5, pill: 327 }, right: { top: 23.5, pill: 279 } } } as const;

/** How close one group may come to Safari's column buttons where the band is short (a lone group may take all
 *  but `gap` of the usual gap on each side). */
export const RAIL = { gap: 5 } as const;

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
  /** visualViewport.scale: above 1 under pinch zoom, when innerWidth is in zoomed px and says nothing about the
   *  column. Unknown counts as 1. */
  scale?: number;
  /** navigation.canGoForward: the in-app preview shows a Forward button only with forward history, and its Back
   *  moves up a row (PREVIEW.gap.forward). Same-origin entries only (the Navigation API); unknown counts as none. */
  canGoForward?: boolean;
  /** A text field (or an iframe, which may hold one) has focus: only then can a short visual viewport be the
   *  keyboard. Unknown (an emulator's signals) does not rule it out. */
  editing?: boolean;
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
  /** Screen-y minus viewport-y: the status area above a standalone viewport, or the Shared with You bar above a
   *  Safari tab's page (column mode, BANNER). */
  offsetTop: number;
  /** strip: screen size. column: Safari window size. inline: safe-area insets top/bottom. */
  screenWidth: number;
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  /** Page y that native chrome over the page reaches down the controls' edge: the unfolded preview's status column
   *  (with Live Activities at their worst) or its floating top bar (UNFOLDED_PREVIEW). Slots and menus stay below. */
  clearTop?: number;
  /** In-app Safari preview (SFSafariViewController, opened from a social or mail app). */
  preview?: boolean;
  /** The in-app preview has forward history (Signals.canGoForward): its Back sits a row higher, and so does the band. */
  forward?: boolean;
  /** The on-screen keyboard is up (visual viewport shorter than the page). The mode stays as it was; in column
   *  mode the controls hide until it goes down. */
  keyboard?: boolean;
  /** Page y where the visual viewport ends, set only while it is short with no keyboard up: a turn can leave Safari
   *  that way (466 for a 580pt page, closed Duo turned from 90 to upright with a page dialog open, #122), with its
   *  minimized bar drawn at the visual viewport's bottom and taking touches from there down. columnBand keeps the
   *  controls above it (#140). */
  visualBottom?: number;
  /** From stable() only. "sure": nothing is moving. "settling": the window is still settling after an event, so
   *  the mode may still change. "held": the last committed context, kept while the page is pinch-zoomed or while a
   *  drifting signal (viewport height) alone asks for another mode before the window settles. */
  confidence?: "sure" | "settling" | "held" | "moving";
  /** The controls are not drawn (the page keeps its full width, no inset). "moving": a fold, unfold or turn is
   *  caught halfway (stable() only, see inTransit), so the controls hide for those frames instead of showing in a
   *  place that is right for neither posture. "preview": the in-app preview turned to landscape, whose column has no
   *  room for a button and where an inline strip would cover the page (docs/research-notes.md, "Preview placement in
   *  the gap"); the preview's own back and close buttons remain, and Duet's return in portrait or in a tab.
   *  "pending": the first second of a page whose signals would read as the preview once its bottom inset lands
   *  (previewPending), so the controls never show at a tab's places, over the preview's own buttons (#143), and the
   *  first second of a preview's new window (unfolding it), while its insets land. */
  hidden?: "moving" | "preview" | "pending";
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
 *  share/reload/Safari pill) fill a column beside the page like a tab's. In portrait Duet's controls go into the free
 *  gap of that column, between its reader/menu button and its back button (PREVIEW.gap, columnBand); turned, that
 *  gap is ~26pt, too small for a button, so they go inline on the side away from the preview's column. Two
 *  windows say preview (docs/research-notes.md, "In-app Safari preview"):
 *  - iOS 27.1 (simulator, 2026-10-26, every presentation but a sheet): the closed screen's 466x678 window with an
 *    84pt column like a tab's, but only 75pt below the page (382x603) and the page reaching the screen bottom
 *    (safe-area-inset-bottom 34). A closed tab has 98pt (80 with the compact URL bar) and inset 0.
 * *  - The page sheet, the common presentation (real Duo, iOS 18.7, Messages, 2026-10-26; simulator, iOS 27.1): a
 *    450x670 window inside the 466x678 screen, page 366x600 (column 84, chrome 70), inset 34. The inset lands
 *    ~100ms after the first sample (0, then 34), so stable() lets the verdict rise to preview at first (PREVIEW_RISE).
 *    Turned, the sheet is 662x458 in the 678x466 screen, page 578x388, inset 34, its column on the side the Duo
 *    is turned to (simulator, iOS 27.1, 2026-10-26).
 *  - Full screen turned (simulator, iOS 27.1, e2e round 2): the 678x466 window, page 678x391 (no column, chrome 75),
 *    inset bottom 34, the buttons in a safe-area inset of 84 on the side the Duo is turned to.
 *    No tab is smaller than the screen: closed 466x678, open 951x669, a split pane 469x669 (wider than the 466
 *    screen Safari keeps reporting), all inset 0 in every state measured.
 *  - Older builds (device screenshot 2026-10-25): a fixed 375x667 window at 3x, a size no iPhone has natively. */
/** chrome: 75pt at rest; scrolling the default and full styles compacts the top bar to 46 (603 -> 632pt page, 70,
 *  65 ... 47 on the way; the sheet keeps 70), the window and page width unchanged (Duo Lab, iOS 27.1, 2026-10-27).
 *  The band stays clear of a tab's 98 and 80 (compact or scrolled URL bar), and a tab's inset 0 keeps it out
 *  anyway. A compact split pane (75) has another window size. stable() also keeps a tab's verdict while it scrolls,
 *  so a tab whose chrome drifts into the band mid-scroll is not taken for the preview. sheetInset: how far inside the screen, on
 *  each side, a window must be to count as a sheet (16x8 measured; a split pane is 3pt wider than the screen). */
/** gap: the free band of the preview's portrait column, in screen points (the same in the sheet and full screen,
 *  simulator iOS 27.1 and real Duo iOS 18.7, 2026-10-26): its reader/menu button's bottom and its back button's top,
 *  with a bare island. Live Activities push the X and reader/menu buttons down as they push a tab's back + reader
 *  rows (one activity: ~45pt, device, 2026-10-27); the back button stays. Nothing tells the page, so columnBand
 *  assumes the worst case (DUO.island): a ~54pt gap, room for one button. */
/** gap.forward: the band's bottom once the preview has forward history: going back gives it a Forward button and
 *  moves its Back up a row (simulator iOS 27.1, e2e ctl02, #117). That gap has room for one button and none for the
 *  Live Activities allowance. */
const PREVIEW = { width: 375, height: 667, pixelRatio: 3, chrome: [44, 77], column: 84, sheetInset: 4, gap: { top: 282, bottom: 428, forward: 374 } } as const;
/** The width to lay the page out at when iOS left it narrower than its window, else undefined. Back from another app
 *  the preview's page can stay 52pt short of its column for good (e2e life04, iOS 27.1: layout 314 in the sheet's 450
 *  window, whose column leaves 366), a blank band beside it. Closed and upright only, where the column is known. */
export function staleLayoutWidth(s: Signals, c: Context, layoutWidth: number): number | undefined {
  const [w, h] = DUO_SIZES[0];
  if (!c.preview || c.mode !== "column" || s.outerWidth > s.outerHeight || s.outerWidth > w + 1 || s.outerHeight > h + 1) return;
  const width = s.outerWidth - PREVIEW.column;
  return layoutWidth < width - 1 ? width : undefined;
}
/** Why the signals read as the in-app preview, for probes and logs; undefined when they do not. */
export function previewReason(s: Signals): string | undefined {
  if (s.standalone || browserOf(s.userAgent) !== "safari") return;
  if (s.pixelRatio === PREVIEW.pixelRatio && s.outerWidth === PREVIEW.width && s.outerHeight === PREVIEW.height) return "375x667 window at 3x";
  const chrome = s.outerHeight - s.innerHeight;
  // The sheet on the open screen (e2e round 3/4: 653x661 wide, 653x869 tall, no column, inset 0 or 34): no Safari
  // window has these sizes.
  if (UNFOLDED_SHEETS.some(([a, b]) => Math.abs(s.outerWidth - a) <= 1 && Math.abs(s.outerHeight - b) <= 1)
    && s.outerWidth - s.innerWidth <= 2 && within(chrome, LANDED.chrome))
    return `${s.outerWidth}x${s.outerHeight} sheet on the open screen, inset ${s.insetBottom}`;
  const open = unfoldedPreview(s);
  if (open) return `${s.outerWidth}x${s.outerHeight} window, ${chrome}pt chrome, inset ${s.insetBottom}, unfolded ${open}`;
  // A tab measured inset 0 in every state (fresh, scrolled, keyboard, landscape); the preview 34.
  if (s.insetBottom < 20) return;
  // Turned full screen (iOS 27.1, every presentation but a sheet): the whole 678x466 window, no page column (the
  // preview's buttons sit in a safe-area inset instead, left at 90, right at 270), 75pt chrome. A turned tab has
  // 98 with its column, or 126 fresh (inset 34 after a fold), so the chrome band alone tells them apart.
  if (within(chrome, PREVIEW.chrome) && Math.abs(s.outerWidth - DUO_SIZES[0][1]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][0]) <= 1
    && Math.abs(s.innerWidth - s.outerWidth) <= 1)
    return `678x466 window, ${chrome}pt chrome, inset ${s.insetBottom}, turned`;
  // The column by its width alone: the preview's chrome is its top bar, not a tab's bottom bar (SAFARI_COLUMN.chrome).
  if (!columnWidth(s)) return;
  if (within(chrome, PREVIEW.chrome) && Math.abs(s.outerWidth - DUO_SIZES[0][0]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][1]) <= 1)
    return `466x678 window, ${chrome}pt chrome, inset ${s.insetBottom}`;
  if (closedSheet(s)) return `${s.outerWidth}x${s.outerHeight} sheet in the ${s.screenWidth}x${s.screenHeight} screen, inset ${s.insetBottom}`;
}
/** The sheet's window: inside the closed screen on both sides, in either orientation. No tab window is smaller than
 *  the screen (previewReason). */
function closedSheet(s: Signals): boolean {
  const [w, h] = DUO_SIZES[0], m = PREVIEW.sheetInset;
  return Math.min(s.screenWidth, s.screenHeight) === w && Math.max(s.screenWidth, s.screenHeight) === h
    && Math.min(s.outerWidth, s.outerHeight) <= w - m && Math.max(s.outerWidth, s.outerHeight) <= h - m;
}
export const isPreview = (s: Signals) => previewReason(s) !== undefined;
/** Signals that read as a tab only because the page is not laid out yet: the in-app preview before its inset lands.
 *  The inset reads 0 until viewport-fit=cover applies, and the sheet's first frames (~70ms, iOS 27.1, e2e pvl01) even
 *  read the whole 466x678 screen as the page inside its 450x670 window, no column; the pre-paint boot reads just those.
 *  The verdicts were a tab's and its controls showed over the preview's share and reload buttons until hydration
 *  (#143). The full screen preview's first frame (~200ms, iOS 27.1, e2e j37/pvl02) reads the whole screen as both
 *  window and page, no chrome, no column, inset 0 (#155). So: the preview with its inset, or a Safari page in the
 *  sheet's window whatever its page reads, or a Safari page that is the whole closed screen. Or the preview read
 *  but placed wrong: the unfolded wide one before its side band lands (unlaidWide). */
export const previewPending = (s: Signals) => isPreview(s) ? unlaidWide(s)
  : isPreview({ ...s, insetBottom: 34 }) || (!s.standalone && browserOf(s.userAgent) === "safari" && (closedSheet(s) || closedWhole(s)));
/** The unfolded wide preview before its status column's safe-area inset lands: no band on either side, so detect()
 *  would put the controls inline right, over the clock and island. Unfolding the full screen preview, its first frame
 *  drew them there for ~40ms (iOS 27.1, e2e j38-02). Every unfolded wide preview measured has the 84pt band. */
const unlaidWide = (s: Signals) => unfoldedPreview(s) === "wide" && s.insetLeft < STRIP_INSET && s.insetRight < STRIP_INSET;
/** The page is the whole closed screen, window and all, in either orientation: no Safari tab reads that, its column
 *  and bar are always there on the closed Duo (previewPending). */
function closedWhole(s: Signals): boolean {
  const [w, h] = DUO_SIZES[0], near1 = (a: number, b: number) => Math.abs(a - b) <= 1;
  return Math.min(s.screenWidth, s.screenHeight) === w && Math.max(s.screenWidth, s.screenHeight) === h
    && near1(s.outerWidth, s.screenWidth) && near1(s.outerHeight, s.screenHeight)
    && near1(s.innerWidth, s.outerWidth) && near1(s.innerHeight, s.outerHeight);
}

/** The page is the whole open screen, wide (951x669), window and all: no Safari tab (chrome 126) or in-app preview
 *  (a 75pt top bar) reads that. */
function openWideWhole(s: Signals): boolean {
  const [w, h] = DUO_SIZES[1], near1 = (a: number, b: number) => Math.abs(a - b) <= 1;
  return near1(s.outerWidth, h) && near1(s.outerHeight, w) && near1(s.innerWidth, s.outerWidth) && near1(s.innerHeight, s.outerHeight);
}

/** An app's web view as wide as the screen, closed upright or open wide, whatever its height. Open, X's sheet keeps
 *  reporting the closed screen (678x466, e2e xsheet 2026-10-30), so the open width alone says it. */
function topWebview(s: Signals): boolean {
  const near1 = (a: number, b: number) => Math.abs(a - b) <= 1, lo = Math.min(s.screenWidth, s.screenHeight), hi = Math.max(s.screenWidth, s.screenHeight);
  const closed = lo === DUO_SIZES[0][0] && hi === DUO_SIZES[0][1];
  return (closed && (s.angle ?? 0) === 0 && near1(s.innerWidth, lo)) || near1(s.innerWidth, DUO_SIZES[1][1]);
}

/** The in-app preview on the open screen, default, full screen and over full screen styles (iOS 27.1, e2e matrix
 *  2026-10-27; the sheet is UNFOLDED_SHEETS). No column, and no Safari tab has these chrome and inset pairs (a tab
 *  unfolded: chrome 126, inset 34, in both postures).
 *  - Wide: the 951x669 window, page 951x594 under a 75pt top bar holding every button, inset bottom 34, and the status
 *    column (clock at screen y 33 to 48, a bare island to 102) in an 84pt safe-area inset on the right, the band a
 *    Home Screen app's strip has. Before, the controls went inline there, over the clock and island.
 *  - Tall: the 669x951 window, page 669x800 at screen y 75 (chrome 151: a 76pt bottom bar), inset 0. Turned right
 *    (page angle 180) the status row heads the screen and the top bar floats over the page (its buttons at screen
 *    y 85 to 129); turned left (angle 0) the bar sits above the page. The island sits top right (bare bottom 68), above the controls' edge, in both.
 *  `clear`: where the controls start (Context.clearTop), assuming Live Activities grow the island by DUO.island as in
 *  the closed strip (not yet measured on the open screen). */
const UNFOLDED_PREVIEW = { chrome: { wide: [73, 77], tall: [149, 153] },
  clear: { wide: DUO.top + DUO.island - 75, tall: Math.max(129, 68 + DUO.island) - 75 + DUO.gap } } as const;
function unfoldedPreview(s: Signals): "wide" | "tall" | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1, [w, h] = DUO_SIZES[1], chrome = s.outerHeight - s.innerHeight;
  if (!near(s.innerWidth, s.outerWidth)) return;
  if (near(s.outerWidth, h) && near(s.outerHeight, w) && within(chrome, UNFOLDED_PREVIEW.chrome.wide) && s.insetBottom >= 20) return "wide";
  if (near(s.outerWidth, w) && near(s.outerHeight, h) && within(chrome, UNFOLDED_PREVIEW.chrome.tall) && s.insetBottom < 20) return "tall";
}

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
 *  fit the wider document (simulator probes, 2026-10-25). A device trace (2026-10-25) read the column at other
 *  window sizes (453x661 and 450x670 outer, 369x591 and 366x600 inner), then taken for windowed Safari; 450x670
 *  with inset 34 is the in-app preview's sheet (isPreview), which goes inline. A pane with the compact URL bar has
 *  75pt of chrome, so any portrait Safari window on the Duo with the column counts. */
// The largest Dynamic Type grows the bottom bar to 106pt (382x572 in 466x678, e2e round 3). On a real Duo the bar
// collapses further while the page scrolls: 59pt (382x619 in 466x678, iOS 27, 2026-10-28), so the column fell inline
// once the scroll settled (#132).
const SAFARI_COLUMN = { width: [80, 88], chrome: [50, 110] } as const;
const within = (v: number, [a, b]: readonly [number, number]) => v >= a && v <= b;
// The full open window (951x669, 669x951) never has the column: a column-wide page there is the closed page's, not yet
// resized (inTransit).
const openWindow = (s: Signals) => Math.max(s.outerWidth, s.outerHeight) >= DUO_SIZES[1][1] - 1;
const columnWidth = (s: Signals) => within(s.outerWidth - s.innerWidth, SAFARI_COLUMN.width) && !openWindow(s);
/** Shared with You: a page opened from a link a contact sent in Messages has a "From <name>" bar with a close button
 *  above it, under the status bar, until the user closes it (real Duo, iOS 27, 2026-10-27: closed tab 382x580 to
 *  382x540 in 466x678, closed landscape 594x328 in 678x466, split pane 385x531 in 469x669, each chrome 98 to 138 with
 *  Safari's column buttons and URL bar where they were). The page starts that far down the screen
 *  (Context.offsetTop). Before, the 138pt chrome failed the column and the controls fell inline. The full open
 *  window never has the column, so a column there is a stale layout, bar or not (LANDED). */
const BANNER = 40;
const bannerOf = (s: Signals) => {
  const chrome = s.outerHeight - s.innerHeight;
  return !openWindow(s) && chrome > SAFARI_COLUMN.chrome[1] && within(chrome - BANNER, SAFARI_COLUMN.chrome) ? BANNER : 0;
};
/** The keyboard on a real Duo shrinks the layout viewport, not only the visual one: 382x411 in 466x678 with the visual
 *  viewport as tall, a 267pt "chrome" no Safari bar has (iOS 27, 2026-10-28, #132). Safari's column stays where it
 *  was. Only with a text field focused: a stale layout handed a new window reads the same (inTransit). */
const keyboardResized = (s: Signals) => s.editing === true && columnWidth(s) && s.outerHeight - s.innerHeight > SAFARI_COLUMN.chrome[1] + BANNER;
const hasColumn = (s: Signals) => columnWidth(s) && (keyboardResized(s) || within(s.outerHeight - s.innerHeight - bannerOf(s), SAFARI_COLUMN.chrome));

/** Side inset of a Home Screen app on the Duo: 84 measured (closed portrait). iPhones have up to 59 in landscape. */
const STRIP_INSET = 76;

/** The keyboard covers the bottom of the page: a text field has focus and the visual viewport is shorter than the
 *  layout one. WebKit can report a negative visual height after the preview's sheet is folded from the open screen
 *  (-78 for a 600pt page, e2e round 3, held until the next resize); no viewport is that short, so it is not a
 *  keyboard. It can also leave the visual viewport short after a turn (466 for a 580pt page, closed Duo turned from
 *  90 to upright with a page dialog open, #122) with no field focused, so without focus it is not a keyboard. A real
 *  Duo shrinks the layout viewport with it instead (keyboardResized). */
const shortView = (s: Signals) => s.visualHeight > 0 && s.visualHeight < s.innerHeight - 1;
export const keyboardUp = (s: Signals) => s.editing !== false && (shortView(s) || keyboardResized(s));

/** preferred: the side the user picked for inline controls, if any. preview: the in-app preview verdict, when the
 *  caller holds a sticky one (stable()). */
export function detect(s: Signals, preferred?: Side, allowColumn = true, preview = isPreview(s)): Context {
  const duo = isDuo(s), browser = browserOf(s.userAgent), device = deviceOf(s), standalone = s.standalone;
  // Only a Home Screen app owns the strip: a Safari tab reports the column as an 84pt inset for a frame while folding.
  const keyboard = keyboardUp(s);
  const kb = keyboard ? { keyboard } : shortView(s) ? { visualBottom: s.visualHeight } : {};
  if (s.standalone && duo && (s.insetRight >= STRIP_INSET || s.insetLeft >= STRIP_INSET)) {
    return { ...kb, mode: "strip", duo, browser, device, standalone, layout: layoutOf(s.innerWidth), side: s.insetRight >= STRIP_INSET ? "right" : "left", width: s.innerWidth, height: s.innerHeight, stableHeight: s.innerHeight, offsetTop: Math.max(0, s.screenHeight - s.innerHeight), screenWidth: s.screenWidth, screenHeight: s.screenHeight, insetTop: s.insetTop, insetBottom: s.insetBottom };
  }
  const base = { ...kb, duo, browser, device, standalone, width: s.innerWidth, height: s.innerHeight, stableHeight: s.innerHeight, offsetTop: 0, insetTop: s.insetTop, insetBottom: s.insetBottom };
  // Closed landscape: the column is on the side the Duo is turned to, and the turn is the only signal for it.
  const landscape = s.innerWidth > s.innerHeight;
  const turned = s.angle === 90 ? "left" : s.angle === 270 ? "right" : undefined;
  const closed = Math.abs(s.outerWidth - DUO_SIZES[0][1]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][0]) <= 1;
  const columnSide: Side | undefined = !landscape ? "right" : closed ? turned : undefined;
  // Other iOS browsers draw their own chrome where Safari has its column: inline for them.
  // An in-app preview has the column signature too: in portrait its column has a gap Duet's controls fit in
  // (columnBand); turned, it has none, so the preview goes inline there.
  // Pinch zoom puts innerWidth in zoomed px, so the column signature means nothing then (stable() holds instead).
  // The keyboard leaves Safari's column in place (only the visual viewport shrinks), so it does not change the mode.
  const split = isSplit(s);
  const column = allowColumn && !!columnSide && !s.standalone && !s.framed && browser === "safari" && (!preview || !landscape)
    && (preview ? s.outerWidth - s.innerWidth >= SAFARI_COLUMN.width[0] : hasColumn(s)) && (s.scale ?? 1) === 1;
  // Safari's page viewport starts at screen top and ends above its address bar (382x580 of 466x678).
  if (column && split) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: "right", offsetTop: bannerOf(s), screenWidth: s.outerWidth, screenHeight: s.outerHeight, split: true };
  if (column && duo) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: columnSide!, offsetTop: bannerOf(s), screenWidth: s.outerWidth, screenHeight: s.outerHeight, ...(preview && { preview }), ...(preview && s.canGoForward && { forward: true }) };
  // The turned full-screen preview (default and full styles, iOS 27.1): its buttons all sit in a top bar, and the 84pt
  // safe-area inset on the side the Duo is turned to (left at 90, right at 270) is page area nothing native uses
  // below that bar. The controls take it, like a Home Screen app's strip (e2e round 4: the sheet turned has only a
  // ~26pt gap in its column, so it stays hidden).
  // The unfolded wide preview has the same band on the right, headed by the status column (UNFOLDED_PREVIEW).
  const band: Side | undefined = s.insetLeft >= STRIP_INSET ? "left" : s.insetRight >= STRIP_INSET ? "right" : undefined;
  const open = preview ? unfoldedPreview(s) : undefined;
  if (preview && landscape && (closed || open === "wide") && band && browser === "safari" && !s.standalone && !s.framed)
    return { ...base, mode: "strip", layout: layoutOf(s.innerWidth - INLINE_WIDTH), side: band, screenWidth: s.innerWidth, screenHeight: s.innerHeight, preview, ...(open && { clearTop: UNFOLDED_PREVIEW.clear.wide }) };
  // A preview inline: away from its own column (on the side the Duo is turned to, else the right).
  // On the open screen the sheet has no column of its own: inline right, like a full-width tab, and never hidden.
  const onClosed = Math.min(s.outerWidth, s.outerHeight) <= DUO_SIZES[0][0] + 1 && Math.max(s.outerWidth, s.outerHeight) <= DUO_SIZES[0][1] + 1;
  const away: Side = preview && onClosed ? (landscape && turned === "left" ? "right" : "left") : "right";
  const side = preferred ?? away;
  // An app's own web view over the whole screen, closed upright or open wide (X's link preview: WKWebView, no Safari
  // token, chrome 0, inset top 0, iOS 27.1): the status column (clock, island, Live Activities) is over the page's right
  // edge, and nothing native says so. The controls start below it, where a Home Screen app's strip does (#194). Open
  // tall, the status row heads the page and the controls already start below it.
  // A shorter form, X's in-app browser in early 2026-10: a full-width web view on the screen's top 61%, its bar and the tweet card
  // below (#194, 466x413 closed). Only the width says so, and the short page reads landscape.
  const statusOver = duo && !s.standalone && side === "right"
    && ((!landscape && closedWhole(s)) || openWideWhole(s) || (browser === "webview" && topWebview(s)));
  return { ...base, mode: "inline", layout: layoutOf(s.innerWidth), side, screenWidth: s.innerWidth, screenHeight: s.innerHeight, ...(preview && { preview }), ...(preview && onClosed && landscape && browser === "safari" && !s.standalone && { hidden: "preview" as const }), ...(open === "tall" && { clearTop: UNFOLDED_PREVIEW.clear.tall }), ...(statusOver && { clearTop: DUO.top + DUO.island }), ...(split && { split }) };
}

/** Every window a Safari page on the Duo lands in, as measured (docs/research-notes.md): `page` is how much
 *  narrower the page is than the window (0, or Safari's 84pt column), `chrome` how much shorter (the address bar:
 *  closed 98 or 80 compact, open and fresh landscape 126, split pane 98, preview 70 to 75). A sample outside these
 *  is a fold, unfold or turn caught halfway: the viewport lands first and the window up to ~2s later (rotation 90 to
 *  0, simulator 2026-10-26: 678x340, 466x498, 382x498, then 382x580 in 466x678). */
/** How far inside the closed screen the preview's sheet may be: 16x8 measured. */
const SHEET_SLACK = 40;
/** The in-app preview's sheet on the open screen, wide and tall posture (simulator, iOS 27.1). */
const UNFOLDED_SHEETS = [[653, 661], [653, 869]] as const;
// chrome tops out at an open tab with its tab bar under the Shared with You bar, 172 (real Duo, 951x497 in 951x669);
// a fold's page lands at 180 first.
const LANDED = { page: [[0, 2], [83, 85]], chrome: [0, 176], columnChrome: 110 } as const;
/** True while a Safari page on the Duo is between postures: the page and its window disagree on orientation, the
 *  turn (screen.orientation.angle) disagrees with the page, or page and window are not a pair Safari settles in
 *  (LANDED, or the window is not a Duo window or the preview's sheet). Only asked while the window settles
 *  (signals.ts settling(), at most SETTLE.cap), so a state never measured cannot hide the controls for good. */
export function inTransit(s: Signals): boolean {
  if (s.standalone || s.framed || browserOf(s.userAgent) !== "safari" || isIOS(s) === false || !isDuo(s)) return false;
  // The preview's sheet on the open screen: a near-square window of its own, no column, its page wider than tall in
  // the wide posture (e2e round 3: 653x661 wide, 653x869 tall).
  if (s.outerWidth - s.innerWidth <= LANDED.page[0][1] && within(s.outerHeight - s.innerHeight, LANDED.chrome)
    && UNFOLDED_SHEETS.some(([a, b]) => Math.abs(s.outerWidth - a) <= 1 && Math.abs(s.outerHeight - b) <= 1)) return false;
  const landscape = s.innerWidth > s.innerHeight;
  if (landscape !== s.outerWidth > s.outerHeight) return true;
  const [w, h] = DUO_SIZES[0], m = PREVIEW.sheetInset, short = Math.min(s.outerWidth, s.outerHeight), long = Math.max(s.outerWidth, s.outerHeight);
  // The turn speaks for the closed screen only: the open screen is landscape at angle 0.
  const closed = short <= w + 1 && long <= h + 1;
  if (closed && s.angle !== undefined && s.angle % 90 === 0 && (s.angle % 180 === 90) !== landscape) return true;
  // A real Duo's keyboard shrinks the page below every landed chrome, with a field focused (keyboardResized).
  if (keyboardResized(s)) return false;
  const page = s.outerWidth - s.innerWidth, chrome = s.outerHeight - s.innerHeight;
  if (!LANDED.page.some((r) => within(page, r)) || !within(chrome, LANDED.chrome)) return true;
  // Safari's column is 84pt in every window measured, and comes with its bottom URL bar (chrome 98, 106 at the largest
  // Dynamic Type, preview 70 to 75), never with the 126pt bars of a full open window. Anything else is a stale layout
  // handed a new window (e2e round 3: entering split view, 867x543 in 951x669 for ~200ms before the pane; going home
  // from a split pane, the pane's 385x571 page in the closed screen's 466x678 window, an 81pt "column"). Nor in the
  // full open window at all: unfolding the closed preview hands it the closed page's 585x876 for ~45ms (e2e RC run,
  // 2026-10-27).
  if (page >= LANDED.page[1][0] && (chrome - bannerOf(s) > LANDED.columnChrome || openWindow(s))) return true;
  // Nor a page as wide as the closed portrait window under more than a column's bar: Safari lays one out there only
  // for the full screen preview (chrome 0). Unfolding the default style preview passes through 466x527 in 466x678,
  // inset 0, for ~40ms (iOS 27.1, e2e unf01-02, #159), and read as a tab it drew the controls inline over the page.
  if (closed && !landscape && within(page, LANDED.page[0]) && chrome > LANDED.columnChrome) return true;
  // A Duo window, or the preview's sheet (a window a few points inside the closed screen; its inset lands ~100ms late,
  // so sizes alone decide).
  const sheet = short <= w - m && long <= h - m && short >= w - SHEET_SLACK && long >= h - SHEET_SLACK;
  return !duoSize(s.outerWidth, s.outerHeight) && !sheet;
}

/** Mode flips are a feedback loop when the layout of one mode changes the signals into the other (the
 *  column layer's overflow resizing Safari's viewport). Three flips within FLIP_WINDOW pin the page to inline.
 *  Flips only count while the window keeps its size. The pin lifts when the window changes size, or after `until`: moving a split-view pane to the other side
 *  flips the mode a few times without changing the window's size. Each re-pin for the same window doubles
 *  the wait, so a real loop settles instead of flickering. */
export interface Damper { mode?: Mode; flips: number[]; key?: string; pinned?: string; until?: number; ttl?: number;
  /** Smallest viewport height per width and orientation (Context.stableHeight). */
  heights?: Record<string, number>;
  /** Sticky in-app preview verdict, and the window it was taken in. */
  preview?: boolean; previewKey?: string; previewAt?: number;
  /** The page has read as the preview, and no tab's inset since. */
  wasPreview?: boolean;
  /** Last context returned, the stable signals it was committed under, and its window (outer size). */
  last?: Context; stableKey?: string; lastKey?: string;
  /** A fold or turn was caught halfway, and the landing (its stable signals, first seen at landAt) must hold until
   *  landUntil before the controls show (LAND_HOLD). */
  moving?: boolean; landKey?: string; landAt?: number; landUntil?: number;
  /** Focus left a keyboard that was up while the visual viewport is still short: it counts as up until then
   *  (KEYBOARD_DOWN). */
  kbUntil?: number;
  /** When the page first read its signals, when its controls started hiding for a preview not laid out yet
   *  (previewPending: at that first reading, or in the first window after a preview's), and until when (PREVIEW_RISE). */
  bornAt?: number; pendingAt?: number; pendingUntil?: number }
const FLIP_WINDOW = 2000;
export const PIN_TTL = 3000;
/** Longest pin: a loop that keeps resuming doubles the wait up to this. */
export const PIN_MAX = 60000;
/** How long after a window first shows (stable signals or epoch changed) its verdict may still rise to preview:
 *  the real sheet's bottom inset reads 0 on the first sample and 34 ~100ms later (device, 2026-10-26). */
export const PREVIEW_RISE = 1000;
/** How long a landing after a fold or turn caught halfway must hold before the controls show there: unfolding from
 *  closed landscape passes through the closed portrait window (382x580 in 466x678, angle 0) for ~90ms before the
 *  open one (simulator, e2e round 2), a state that reads as landed and would flash the column for a frame. */
export const LAND_HOLD = 150;
/** Longest a keyboard stays up after focus leaves it while the visual viewport is still short: the open screen's
 *  grew back ~40ms after the blur (e2e kb02-03); a viewport left short with no focus (#122) must not hide the
 *  controls for good. */
export const KEYBOARD_DOWN = 1000;

/** settling: the window is still moving after a geometry event (signals.ts settling()). A fold lands the viewport
 *  first and outerWidth up to ~2s later, flipping the mode on the way at an unchanged window size, so flips then are
 *  the transition, not a loop, and do not count.
 *  epoch: signals.ts epoch(), bumped on pageshow and when the page becomes visible again.
 *
 *  Signals come in two kinds. Stable ones (window size, page width, turn, standalone, frame, epoch) change only on
 *  load, fold, rotation or a new page show, and a mode they ask for is taken at once. Drifting ones (page height
 *  with the URL bar or find bar, the visual viewport with the keyboard, pinch zoom) move while the user scrolls or
 *  types, and never move the controls mid-gesture: a mode only they ask for waits until the window settles, and
 *  under pinch zoom the last context holds. They never take a tab out of Safari's column at all (#132).
 *
 *  The preview verdict is sticky the same way: a page that loaded as a tab stays a tab while it scrolls, since the
 *  URL bar collapsing changes only the page height. A tab becomes a preview only on a stable change or in the
 *  first PREVIEW_RISE ms of a window (the sheet's late inset); a preview becomes a tab as soon as the rule stops
 *  matching (Open in Safari). */
export function stable(d: Damper, s: Signals, preferred: Side | undefined, now: number, settling = false, epoch = 0): Context {
  const key = `${s.outerWidth}x${s.outerHeight}`;
  // The keyboard going down: focus leaves first, while iOS still holds the layout viewport scrolled up by the
  // keyboard (visual viewport 286 of 618, offset 107), so the inline rail shown then was drawn 107px high for a
  // frame, its top item off the screen (e2e kb02-03, #126). A keyboard that was up stays up until the viewport grows.
  // On a real Duo the layout viewport is the short one (keyboardResized).
  const short = shortView(s) || keyboardResized({ ...s, editing: true });
  if (s.editing === false && short && (d.last?.keyboard || d.kbUntil !== undefined)) {
    d.kbUntil ??= now + KEYBOARD_DOWN;
    if (now < d.kbUntil) s = { ...s, editing: true };
  } else d.kbUntil = undefined;
  // Pinch zoom holds the context committed in this window. A scale off 1 in another window is WebKit's, not the
  // user's: folding the open preview sheet (653 wide, its document briefly 935) onto the closed screen leaves
  // visualViewport.scale at 1.0152 with the visual viewport as wide as the page (366), held until the next
  // gesture (e2e round 4, pvu-open-unfolded-fold). Holding there kept the open screen's inline controls, drawn off
  // the closed screen, so a window change reads the signals as unzoomed.
  if ((s.scale ?? 1) !== 1 && d.last) {
    if (d.lastKey === key) {
      const keyboard = keyboardUp(s) || undefined;
      return { ...d.last, keyboard, confidence: "held" };
    }
    s = { ...s, scale: 1 };
  }
  const stableKey = `${key} ${s.innerWidth} ${s.angle ?? 0} ${s.standalone} ${!!s.framed} ${epoch}`;
  // Leaving for another app, iOS snapshots the page at other sizes and hands the preview back changed (e2e life03-06,
  // iOS 27.1): a taller top bar for a while (382x548, chrome 130), and the page sometimes 52 to 60pt narrower until
  // it is laid out again (314x600 in the sheet's 450x670, 322x603 in 466x678). Either dropped the verdict for good, and an inline strip
  // sat inside the page, beside the preview's own column. A page that was the preview stays it through both, until
  // its inset goes: a tab's is 0 (Open in Safari).
  if (s.insetBottom < 20) d.wasPreview = false;
  const raw = isPreview(s) || (!!d.wasPreview && isPreview({ ...s, innerHeight: s.outerHeight - PREVIEW.chrome[1], innerWidth: Math.max(s.innerWidth, s.outerWidth - SAFARI_COLUMN.width[1]) }));
  if (raw) d.wasPreview = true;
  // Handed back so, the page is laid out, however long it stays: not in transit, nor a preview still to land. Each read
  // that way hid the controls for up to ~3s (e2e life04). Closed only, and upright: unfolding or turning a preview
  // passes through pages that would normalise the same.
  const [cw, ch] = DUO_SIZES[0];
  const handedBack = raw && !isPreview(s) && (s.innerWidth > s.innerHeight) === (s.outerWidth > s.outerHeight)
    && Math.min(s.outerWidth, s.outerHeight) <= cw + 1 && Math.max(s.outerWidth, s.outerHeight) <= ch + 1;
  const pending = !handedBack && previewPending(s);
  if (d.bornAt === undefined) [d.bornAt, d.pendingAt] = [now, pending ? now : undefined];
  if (stableKey !== d.previewKey) d.previewAt = now;
  const rising = now - (d.previewAt ?? now) < PREVIEW_RISE;
  if (d.preview === undefined || !raw || stableKey !== d.previewKey || rising) d.preview = raw;
  d.previewKey = stableKey;
  const preview = d.preview;
  // A preview's window changing (unfolding it) lays the page out afresh, its insets landing late like a first load's.
  if (pending && d.last?.preview && stableKey !== d.stableKey) d.pendingAt = now;
  // A loop keeps the window size; a fold or rotation passes through other sizes, so only same-size flips count.
  if (d.key !== key) Object.assign(d, { key, pinned: undefined, ttl: undefined, flips: [] });
  if (d.pinned && now >= d.until!) Object.assign(d, { pinned: undefined, flips: [] });
  let c = detect(s, preferred, !d.pinned, preview);
  // Halfway through a fold or turn: hidden, and nothing committed, so the landing is taken as a stable change. The
  // last context's geometry stays whole: mixing its screenWidth with the half-turned width made the page's insets
  // jump mid-turn (84, 0, 212, 296px on a left column turn, -485px on an unfold; final review, 2026-10-27).
  const moving = () => ({ ...(d.last ?? c), keyboard: c.keyboard, hidden: "moving" as const, confidence: "moving" as const });
  if (settling && !handedBack && inTransit(s)) {
    Object.assign(d, { moving: true, landKey: undefined, landUntil: undefined });
    return moving();
  }
  // Landed after a transit: hidden until the landing holds LAND_HOLD (the caller re-reads at landUntil).
  if (settling && d.moving) {
    if (d.landKey !== stableKey) Object.assign(d, { landKey: stableKey, landAt: now, landUntil: now + LAND_HOLD });
    if (now < d.landUntil!) return moving();
  }
  Object.assign(d, { moving: undefined, landKey: undefined, landUntil: undefined });
  // The preview verdict counts as stable: a preview handed to a tab (Open in Safari) moves at once. Safari's column
  // never leaves a tab on drift alone, so column to inline is held after the settle too: a real Duo's bar and
  // keyboard read outside every range measured on the simulator (#132), and a wrong inline verdict committed once the
  // scroll settled dropped the controls off the rail for good. Inline to column still moves, so a wrong inline heals.
  // A context hidden as pending was never shown, so there is nothing to hold: its insets landing moves it.
  const columnHeld = d.last?.mode === "column" && c.mode === "inline" && !d.pinned;
  if (d.last && c.mode !== d.last.mode && (settling || columnHeld) && stableKey === d.stableKey && !!d.last.preview === preview && d.pendingUntil === undefined) {
    const { width, height, insetTop, insetBottom, keyboard, visualBottom } = c;
    return { ...d.last, width, height, insetTop, insetBottom, keyboard, visualBottom, confidence: "held" };
  }
  d.stableKey = stableKey;
  if (d.mode && c.mode !== d.mode && !settling) {
    d.flips = [...d.flips.filter((t) => now - t < FLIP_WINDOW), now];
    if (d.flips.length >= 3) {
      // Doubles only when the loop resumes as the last pin lifts; a later pane move starts from PIN_TTL again.
      d.ttl = d.ttl && d.until !== undefined && now - d.until < FLIP_WINDOW ? Math.min(d.ttl * 2, PIN_MAX) : PIN_TTL;
      Object.assign(d, { pinned: key, until: now + d.ttl });
      c = detect(s, preferred, false, preview);
    }
  }
  d.mode = c.mode;
  c = { ...c, confidence: settling ? "settling" : "sure" };
  // A mobile browser's URL bar grows and shrinks the viewport as the page scrolls, while the window keeps its
  // width and orientation. A desktop window has no such bar: its height is the user's, so it stays current.
  d.lastKey = key;
  if (c.device === "desktop") return d.last = c;
  const h = `${s.innerWidth}${s.outerWidth > s.outerHeight ? "L" : "P"}`, heights = d.heights ??= {};
  heights[h] = Math.min(heights[h] ?? Infinity, s.innerHeight);
  d.last = { ...c, stableHeight: heights[h] };
  // A preview not laid out yet keeps its controls hidden for PREVIEW_RISE ms instead of showing them at a tab's places
  // (the caller re-reads at pendingUntil). Only from a first reading that was pending, or a preview's window changing:
  // a tab loads with 98 or 80pt of chrome, and its bar collapsing into the preview's band on a quick scroll (59pt, real
  // Duo) must not hide its controls.
  d.pendingUntil = d.pendingAt !== undefined && pending && now - d.pendingAt < PREVIEW_RISE ? d.pendingAt + PREVIEW_RISE : undefined;
  return d.pendingUntil === undefined ? d.last : { ...d.last, hidden: "pending" };
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
// Whether the controls are on screen to show a close button, for <html data-duet-close> (#135). Column and inline
// controls step aside with the keyboard (duet.css) and a landscape closed preview hides them, leaving the page's own
// X. A turn's few hidden frames ("moving") and a load's wait for the preview's inset ("pending") still count, so the
// page's X doesn't flash on every fold or turn.
export const controlsShown = (c: Pick<Context, "mode" | "keyboard" | "hidden">) => c.hidden !== "preview" && !(c.keyboard && c.mode !== "strip");

export const INLINE_WIDTH = 84;

/** Where the page goes beside the controls, and the insets left for it to keep clear by (chrome.tsx writes them on
 *  <html>). In Safari's column without children the document is the page, and Duet owns its layout (`reserve`, the
 *  default): when the document spans a column on the left (a split pane, which spans one on each side, or a left
 *  column closed) it is scrolled one column across, so the page is moved right by that column (`shift`, margins on
 *  <html>) and lands exactly in the visible viewport, beside the controls, with nothing to keep clear (insets 0).
 *  Before, a page that ignored the insets ran under the controls on the left and left a column-wide gap on the
 *  right (RegTail, split pane, 2026-10-27). With `reserve: false` the page runs under the column and keeps clear by
 *  the insets itself. With children the scroller runs on under the column and pads by the insets; an emulated
 *  column (the site's web Duo) already frames both columns and is never scrolled across. */
export function pageInsets(o: {
  mode: Mode; side: Side; split: boolean; screenWidth: number; width: number; hiddenPreview: boolean;
  inner: boolean; emulated: boolean; reserve: boolean; env: (side: Side) => string;
}): { left: string; right: string; shift: number } {
  const column = o.screenWidth - o.width, split = o.mode === "column" && o.split;
  if (o.mode === "column" && !o.inner && !o.emulated && o.reserve)
    return { left: "0px", right: "0px", shift: split || o.side === "left" ? column : 0 };
  const inset = o.hiddenPreview ? "0px" : o.mode === "strip" ? o.env(o.side) : o.mode === "inline" ? `${INLINE_WIDTH}px` : `${column}px`;
  const other = (side: Side) => o.mode === "column" ? "0px" : o.env(side);
  // Without children nothing runs under a right column: the document is laid out in the viewport (simulator,
  // 2026-10-26: 84px of padding left a 100px gap).
  const under = o.mode !== "column" || o.inner || o.emulated;
  return {
    right: (o.side === "right" || split) && under ? inset : other("right"),
    left: o.side === "left" || split ? inset : other("left"),
    shift: 0,
  };
}

/** Closed landscape Safari tab: its column's buttons sit apart from portrait's (SAFARI.landscape). */
const landscapeColumn = (c: Context) => !c.split && !c.preview && c.screenWidth > c.screenHeight;

/** Safari's column buttons are an exclusion zone like the insets: native chrome always paints over the page, so
 *  nothing of ours shows over its back + reader rows or its +/tabs pill. `top`: the reader row's bottom plus
 *  DUO.gap, at its worst-case position (island-pushed, under a back + forward pill). `bottom`: DUO.gap above
 *  the pill. `reach`: how far the island can push the rows, so with a bare island the free band starts that much
 *  higher; Live Activities, which nothing tells the page, take it back. Column mode only; landscape rows are measured with a bare island. */
export function columnBand(c: Context): { top: number; bottom: number; reach: number } | undefined {
  if (c.mode !== "column") return undefined;
  const rows = SAFARI.rows * (DUO.control + DUO.gap) + SAFARI.forward, pill = c.screenHeight - DUO.bottom - SAFARI.pill - DUO.gap;
  // In-app preview: the gap in its column at its worst case, from screen points to the page's (the page reaches the
  // screen bottom). No reach: nothing rises into the zone Live Activities give its buttons. With forward history its
  // Back is a row higher and the gap holds one button with little to spare, so the Live Activities allowance shrinks
  // to what is left: an activity may then cover the button, never Back.
  if (c.preview) {
    const y0 = DUO_SIZES[0][1] - c.height, back = c.forward ? PREVIEW.gap.forward : PREVIEW.gap.bottom;
    const island = c.forward ? Math.max(0, back - PREVIEW.gap.top - 2 * DUO.gap - DUO.control) : DUO.island;
    return { top: PREVIEW.gap.top + island + DUO.gap - y0, bottom: back - DUO.gap - y0, reach: 0 };
  }
  // Safari's buttons stay put in screen points; the layer starts at the page top, below a Shared with You bar.
  const y = c.offsetTop;
  const band = c.split ? { top: SAFARI.splitTop[c.side] + rows - y, bottom: pill - y, reach: c.side === "right" ? DUO.island : 0 }
    : landscapeColumn(c) ? { top: SAFARI.landscape[c.side].top + rows - y, bottom: SAFARI.landscape[c.side].pill - DUO.gap - y, reach: 0 }
    : { top: DUO.top + DUO.island + rows - y, bottom: pill - y, reach: DUO.island };
  // A short visual viewport with no keyboard (Context.visualBottom): Safari's bar takes touches from its bottom down,
  // so the band moves up clear of it, keeping its height by taking the lift from the Live Activities allowance first.
  // Live Activities may then cover the top button, as in the preview. A band left too short drops its buttons.
  const lift = c.visualBottom === undefined ? 0 : Math.max(0, band.bottom - (c.visualBottom - DUO.gap));
  if (!lift) return band;
  const rise = Math.min(lift, band.reach);
  return { top: band.top - rise, bottom: band.bottom - lift, reach: band.reach - rise };
}
