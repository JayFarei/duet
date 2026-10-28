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
  /** Bottom of the tab pill (and search button, accessory) above the screen bottom. */
  bottom: 23.7,
  /** Mini-player accessory: left inset, gap to the strip column, height. */
  accessory: { left: 50, gapToColumn: 53.3, height: 48 },
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
/** Rail: where the band holds one button, "…" and the bottom item share a two-item group (as tall as Safari's
 *  back + forward pill), centred between Safari's buttons, at least `gap` clear of each. */
export const RAIL = { gap: 5 } as const;
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
  /** visualViewport.scale: above 1 under pinch zoom, when innerWidth is in zoomed px and says nothing about the
   *  column. Unknown counts as 1. */
  scale?: number;
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
  /** Screen-y minus viewport-y (status area above a standalone viewport). */
  offsetTop: number;
  /** strip: screen size. column: Safari window size. inline: safe-area insets top/bottom. */
  screenWidth: number;
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  /** In-app Safari preview (SFSafariViewController, opened from a social or mail app). */
  preview?: boolean;
  /** The on-screen keyboard is up (visual viewport shorter than the page). The mode stays as it was; in column
   *  mode the controls hide until it goes down. */
  keyboard?: boolean;
  /** From stable() only. "sure": nothing is moving. "settling": the window is still settling after an event, so
   *  the mode may still change. "held": the last committed context, kept while the page is pinch-zoomed or while a
   *  drifting signal (viewport height) alone asks for another mode before the window settles. */
  confidence?: "sure" | "settling" | "held" | "moving";
  /** The controls are not drawn (the page keeps its full width, no inset). "moving": a fold, unfold or turn is
   *  caught halfway (stable() only, see inTransit), so the controls hide for those frames instead of showing in a
   *  place that is right for neither posture. "preview": the in-app preview turned to landscape, whose column has no
   *  room for a button and where an inline strip would cover the page (docs/research-notes.md, "Preview placement in
   *  the gap"); the preview's own back and close buttons remain, and Duet's return in portrait or in a tab. */
  hidden?: "moving" | "preview";
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
/** chrome: a band around the 75pt measured, clear of a tab's 98 and 80 (compact or scrolled URL bar). A compact
 *  split pane (75) has another window size. stable() also keeps a tab's verdict while it scrolls, so a tab whose
 *  chrome drifts into the band mid-scroll is not taken for the preview. sheetInset: how far inside the screen, on
 *  each side, a window must be to count as a sheet (16x8 measured; a split pane is 3pt wider than the screen). */
/** gap: the free band of the preview's portrait column, in screen points (the same in the sheet and full screen,
 *  simulator iOS 27.1 and real Duo iOS 18.7, 2026-10-26): its reader/menu button's bottom and its back button's top.
 *  146pt, room for two buttons ("…" and the selected tab) with DUO.gap around them. Measured with a bare island:
 *  how Live Activities move the preview's buttons is not yet known. */
const PREVIEW = { width: 375, height: 667, pixelRatio: 3, chrome: [73, 77], sheetInset: 4, gap: { top: 282, bottom: 428 } } as const;
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
  // A tab measured inset 0 in every state (fresh, scrolled, keyboard, landscape); the preview 34.
  if (s.insetBottom < 20) return;
  // Turned full screen (iOS 27.1, every presentation but a sheet): the whole 678x466 window, no page column (the
  // preview's buttons sit in a safe-area inset instead, left at 90, right at 270), 75pt chrome. A turned tab has
  // 98 with its column, or 126 fresh (inset 34 after a fold), so the chrome band alone tells them apart.
  if (within(chrome, PREVIEW.chrome) && Math.abs(s.outerWidth - DUO_SIZES[0][1]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][0]) <= 1
    && Math.abs(s.innerWidth - s.outerWidth) <= 1)
    return `678x466 window, ${chrome}pt chrome, inset ${s.insetBottom}, turned`;
  if (!hasColumn(s)) return;
  if (within(chrome, PREVIEW.chrome) && Math.abs(s.outerWidth - DUO_SIZES[0][0]) <= 1 && Math.abs(s.outerHeight - DUO_SIZES[0][1]) <= 1)
    return `466x678 window, ${chrome}pt chrome, inset ${s.insetBottom}`;
  // The sheet: a window inside the closed screen on both sides, in either orientation.
  const [w, h] = DUO_SIZES[0], m = PREVIEW.sheetInset;
  const short = (a: number, b: number) => Math.min(a, b), long = (a: number, b: number) => Math.max(a, b);
  if (short(s.screenWidth, s.screenHeight) === w && long(s.screenWidth, s.screenHeight) === h
    && short(s.outerWidth, s.outerHeight) <= w - m && long(s.outerWidth, s.outerHeight) <= h - m)
    return `${s.outerWidth}x${s.outerHeight} sheet in the ${s.screenWidth}x${s.screenHeight} screen, inset ${s.insetBottom}`;
}
export const isPreview = (s: Signals) => previewReason(s) !== undefined;

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
// The largest Dynamic Type grows the bottom bar to 106pt (382x572 in 466x678, e2e round 3).
const SAFARI_COLUMN = { width: [80, 88], chrome: [68, 110] } as const;
const within = (v: number, [a, b]: readonly [number, number]) => v >= a && v <= b;
const hasColumn = (s: Signals) => within(s.outerWidth - s.innerWidth, SAFARI_COLUMN.width) && within(s.outerHeight - s.innerHeight, SAFARI_COLUMN.chrome);

/** Side inset of a Home Screen app on the Duo: 84 measured (closed portrait). iPhones have up to 59 in landscape. */
const STRIP_INSET = 76;

/** The keyboard covers the bottom of the page: a text field has focus and the visual viewport is shorter than the
 *  layout one. WebKit can report a negative visual height after the preview's sheet is folded from the open screen
 *  (-78 for a 600pt page, e2e round 3, held until the next resize); no viewport is that short, so it is not a
 *  keyboard. It can also leave the visual viewport short after a turn (466 for a 580pt page, closed Duo turned from
 *  90 to upright with a page dialog open, #122) with no field focused, so without focus it is not a keyboard. */
export const keyboardUp = (s: Signals) => s.editing !== false && s.visualHeight > 0 && s.visualHeight < s.innerHeight - 1;

/** preferred: the side the user picked for inline controls, if any. preview: the in-app preview verdict, when the
 *  caller holds a sticky one (stable()). */
export function detect(s: Signals, preferred?: Side, allowColumn = true, preview = isPreview(s)): Context {
  const duo = isDuo(s), browser = browserOf(s.userAgent), device = deviceOf(s), standalone = s.standalone;
  // Only a Home Screen app owns the strip: a Safari tab reports the column as an 84pt inset for a frame while folding.
  const keyboard = keyboardUp(s);
  const kb = keyboard ? { keyboard } : {};
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
    && hasColumn(s) && (s.scale ?? 1) === 1;
  // Safari's page viewport starts at screen top and ends above its address bar (382x580 of 466x678).
  if (column && split) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: "right", screenWidth: s.outerWidth, screenHeight: s.outerHeight, split: true };
  if (column && duo) return { ...base, mode: "column", layout: layoutOf(s.innerWidth), side: columnSide!, screenWidth: s.outerWidth, screenHeight: s.outerHeight, ...(preview && { preview }) };
  // The turned full-screen preview (default and full styles, iOS 27.1): its buttons all sit in a top bar, and the 84pt
  // safe-area inset on the side the Duo is turned to (left at 90, right at 270) is page area nothing native uses
  // below that bar. The controls take it, like a Home Screen app's strip (e2e round 4: the sheet turned has only a
  // ~26pt gap in its column, so it stays hidden).
  const band: Side | undefined = s.insetLeft >= STRIP_INSET ? "left" : s.insetRight >= STRIP_INSET ? "right" : undefined;
  if (preview && landscape && closed && band && browser === "safari" && !s.standalone && !s.framed)
    return { ...base, mode: "strip", layout: layoutOf(s.innerWidth - INLINE_WIDTH), side: band, screenWidth: s.innerWidth, screenHeight: s.innerHeight, preview };
  // A preview inline: away from its own column (on the side the Duo is turned to, else the right).
  // On the open screen the sheet has no column of its own: inline right, like a full-width tab, and never hidden.
  const onClosed = Math.min(s.outerWidth, s.outerHeight) <= DUO_SIZES[0][0] + 1 && Math.max(s.outerWidth, s.outerHeight) <= DUO_SIZES[0][1] + 1;
  const away: Side = preview && onClosed ? (landscape && turned === "left" ? "right" : "left") : "right";
  return { ...base, mode: "inline", layout: layoutOf(s.innerWidth), side: preferred ?? away, screenWidth: s.innerWidth, screenHeight: s.innerHeight, ...(preview && { preview }), ...(preview && onClosed && landscape && browser === "safari" && !s.standalone && { hidden: "preview" as const }), ...(split && { split }) };
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
const LANDED = { page: [[0, 2], [83, 85]], chrome: [0, 160], columnChrome: 110 } as const;
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
  const page = s.outerWidth - s.innerWidth, chrome = s.outerHeight - s.innerHeight;
  if (!LANDED.page.some((r) => within(page, r)) || !within(chrome, LANDED.chrome)) return true;
  // Safari's column is 84pt in every window measured, and comes with its bottom URL bar (chrome 98, 106 at the largest
  // Dynamic Type, preview 70 to 75), never with the 126pt bars of a full open window. Anything else is a stale layout
  // handed a new window (e2e round 3: entering split view, 867x543 in 951x669 for ~200ms before the pane; going home
  // from a split pane, the pane's 385x571 page in the closed screen's 466x678 window, an 81pt "column").
  if (page >= LANDED.page[1][0] && chrome > LANDED.columnChrome) return true;
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
  /** Last context returned, the stable signals it was committed under, and its window (outer size). */
  last?: Context; stableKey?: string; lastKey?: string;
  /** A fold or turn was caught halfway, and the landing (its stable signals, first seen at landAt) must hold until
   *  landUntil before the controls show (LAND_HOLD). */
  moving?: boolean; landKey?: string; landAt?: number; landUntil?: number }
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

/** settling: the window is still moving after a geometry event (signals.ts settling()). A fold lands the viewport
 *  first and outerWidth up to ~2s later, flipping the mode on the way at an unchanged window size, so flips then are
 *  the transition, not a loop, and do not count.
 *  epoch: signals.ts epoch(), bumped on pageshow and when the page becomes visible again.
 *
 *  Signals come in two kinds. Stable ones (window size, page width, turn, standalone, frame, epoch) change only on
 *  load, fold, rotation or a new page show, and a mode they ask for is taken at once. Drifting ones (page height
 *  with the URL bar or find bar, the visual viewport with the keyboard, pinch zoom) move while the user scrolls or
 *  types, and never move the controls mid-gesture: a mode only they ask for waits until the window settles, and
 *  under pinch zoom the last context holds.
 *
 *  The preview verdict is sticky the same way: a page that loaded as a tab stays a tab while it scrolls, since the
 *  URL bar collapsing changes only the page height. A tab becomes a preview only on a stable change or in the
 *  first PREVIEW_RISE ms of a window (the sheet's late inset); a preview becomes a tab as soon as the rule stops
 *  matching (Open in Safari). */
export function stable(d: Damper, s: Signals, preferred: Side | undefined, now: number, settling = false, epoch = 0): Context {
  const key = `${s.outerWidth}x${s.outerHeight}`;
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
  const stableKey = `${key} ${s.innerWidth} ${s.angle ?? 0} ${s.standalone} ${!!s.framed} ${epoch}`, raw = isPreview(s);
  if (stableKey !== d.previewKey) d.previewAt = now;
  const rising = now - (d.previewAt ?? now) < PREVIEW_RISE;
  if (d.preview === undefined || !raw || stableKey !== d.previewKey || rising) d.preview = raw;
  d.previewKey = stableKey;
  const preview = d.preview;
  // A loop keeps the window size; a fold or rotation passes through other sizes, so only same-size flips count.
  if (d.key !== key) Object.assign(d, { key, pinned: undefined, ttl: undefined, flips: [] });
  if (d.pinned && now >= d.until!) Object.assign(d, { pinned: undefined, flips: [] });
  let c = detect(s, preferred, !d.pinned, preview);
  // Halfway through a fold or turn: hidden, and nothing committed, so the landing is taken as a stable change. The
  // last context's geometry stays whole: mixing its screenWidth with the half-turned width made the page's insets
  // jump mid-turn (84, 0, 212, 296px on a left column turn, -485px on an unfold; final review, 2026-10-27).
  const moving = () => ({ ...(d.last ?? c), keyboard: c.keyboard, hidden: "moving" as const, confidence: "moving" as const });
  if (settling && inTransit(s)) {
    Object.assign(d, { moving: true, landKey: undefined, landUntil: undefined });
    return moving();
  }
  // Landed after a transit: hidden until the landing holds LAND_HOLD (the caller re-reads at landUntil).
  if (settling && d.moving) {
    if (d.landKey !== stableKey) Object.assign(d, { landKey: stableKey, landAt: now, landUntil: now + LAND_HOLD });
    if (now < d.landUntil!) return moving();
  }
  Object.assign(d, { moving: undefined, landKey: undefined, landUntil: undefined });
  // The preview verdict counts as stable: a preview handed to a tab (Open in Safari) moves at once.
  if (d.last && c.mode !== d.last.mode && settling && stableKey === d.stableKey && !!d.last.preview === preview) {
    const { width, height, insetTop, insetBottom, keyboard } = c;
    return { ...d.last, width, height, insetTop, insetBottom, keyboard, confidence: "held" };
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
  return d.last = { ...c, stableHeight: heights[h] };
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
  menu: { primary: boolean; back: boolean; leading: number; actions: number; search?: boolean };
  /** min: only the selected tab shows (minimized, or the full pill does not fit). merged: the band holds one
   *  button, so the selected tab is the only one and its menu lists the tabs, then everything in `menu`. */
  tabs?: Box & { min: boolean; merged?: boolean };
  searchButton?: Box;
  /** One shared group holding "…" (top) and the minimized tab or search button (bottom), whose boxes are its
   *  two slots: the band holds one button, but the room between Safari's buttons holds a two-item group (RAIL). */
  rail?: Box;
  accessory?: { left: number; width: number; top: number; height: number };
  /** Column mode: the band clear of Safari's column buttons (columnBand). Menus crossing the column stay inside
   *  it; only leading items and the primary action may rise above columnTop, into the island's reach. */
  columnTop?: number;
  columnBottom?: number;
}

/** Closed landscape Safari tab: its column's buttons sit apart from portrait's (SAFARI.landscape). */
const landscapeColumn = (c: Context) => !c.split && !c.preview && c.screenWidth > c.screenHeight;
const groupHeight = (n: number) => DUO.control + (n - 1) * DUO.groupItem;

/** Safari's column buttons are an exclusion zone like the insets: native chrome always paints over the page, so
 *  nothing of ours shows over its back + reader rows or its +/tabs pill. `top`: the reader row's bottom plus
 *  DUO.gap, at its worst-case position (island-pushed, under a back + forward pill). `bottom`: DUO.gap above
 *  the pill. `reach`: how far the island can push the rows, so with a bare island the free band starts that much
 *  higher; Live Activities, which nothing tells the page, take it back. Column mode only; landscape rows are measured with a bare island. */
export function columnBand(c: Context): { top: number; bottom: number; reach: number } | undefined {
  if (c.mode !== "column") return undefined;
  const rows = SAFARI.rows * (DUO.control + DUO.gap) + SAFARI.forward, pill = c.screenHeight - DUO.bottom - SAFARI.pill - DUO.gap;
  // In-app preview: the gap in its column, from screen points to the page's (the page reaches the screen bottom).
  if (c.preview) {
    const y0 = DUO_SIZES[0][1] - c.height;
    return { top: PREVIEW.gap.top + DUO.gap - y0, bottom: PREVIEW.gap.bottom - DUO.gap - y0, reach: 0 };
  }
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

/** An island wider than the room between its button and the far screen edge (a merged tab menu on a busy page)
 *  would run off screen; that menu morphs instead. */
export function islandFits(c: Context, p: Plan, n: number, side: Side) {
  const w = 2 * ISLAND.pad + n * ISLAND.item, width = c.mode === "column" ? c.screenWidth : c.width;
  return side === "left" ? p.left + w <= width - MORPH.pad : p.left + DUO.control - w >= MORPH.pad;
}

export function plan(c: Context, s: Spec): Plan {
  // column: screen coordinates (the layer is in-document), in the band Safari's column never uses: below
  // its back + reader rows at their worst-case (island-pushed) position, above its +/tabs pill. strip and
  // inline: viewport coordinates.
  const col = columnBand(c);
  // The turned preview's strip is a page band below its native top bar, with the home indicator's inset below.
  const strip = c.mode === "strip" && !c.preview;
  const top = col ? col.top : strip ? DUO.top + DUO.island - c.offsetTop : c.insetTop + DUO.gap;
  const bottom = col ? col.bottom : strip ? c.height - DUO.bottom : c.height - Math.max(c.insetBottom, DUO.gap);
  const centerX = c.side === "left" ? DUO.centerFromEdge : (c.mode === "column" ? c.screenWidth : c.width) - DUO.centerFromEdge;
  const step = DUO.control + DUO.gap;

  // Safari's column band holds one button at worst (92pt, under a back + forward pill and Live Activities):
  // where "…" has no room beside the selected tab, the two share a rail, closer to Safari's buttons than the
  // usual gap (Plan.rail). Where even that has no room (closed landscape), the tab alone stays and its menu takes
  // everything else (Plan.tabs.merged).
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
  } else if ((p.tabs || p.searchButton) && (bottom - top + 2 * DUO.gap - groupHeight(2)) / 2 >= RAIL.gap) {
    const h = groupHeight(2), railTop = (top + bottom - h) / 2, low = { top: railTop + h / 2, height: h / 2 };
    p.rail = { top: railTop, height: h };
    if (col) Object.assign(p, { columnTop: railTop, columnBottom: railTop + h }); // menus may use the rail's reach too
    p.more = { top: railTop, height: h / 2 };
    if (p.tabs) p.tabs = { ...low, min: true }; else p.searchButton = low;
  } else if (p.tabs) {
    // One slot: the selected tab is the only button, and its menu lists the tabs, then what folded.
    p.tabs = { top: bottom - DUO.control, height: DUO.control, min: true, merged: true };
  } else if (p.searchButton) {
    // One slot without tabs: "…" takes the search button's place, search first in its menu.
    p.more = p.searchButton; delete p.searchButton; p.menu.search = true;
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
