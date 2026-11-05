// fast-check arbitraries for property tests: windows as the device reports them (measured on the Duo simulator, iOS
// 27.1, and real iPhones, iPads and desktops, see the other tests and docs/research-notes.md), with jitter, and apps
// as <Duet> props. `layout` runs the template as chrome.tsx does for one side, so properties see what is drawn.
import fc from "fast-check";
import { detect } from "../src/geometry.ts";
import { canMoveControls, confirmBox, frame, landingRoom, menuBox, placeTabs, template } from "../src/template.ts";

/** Runs per property: modest by default so the suite stays fast, DUET_PBT_RUNS for a deeper search. */
export const RUNS = +(process.env.DUET_PBT_RUNS ?? 300);
/** fc.assert options; DUET_PBT_SEED (and DUET_PBT_PATH) replay a failure fast-check printed. */
export const opts = (o = {}) => ({ numRuns: RUNS, ...(process.env.DUET_PBT_SEED && { seed: +process.env.DUET_PBT_SEED, path: process.env.DUET_PBT_PATH }), ...o });

export const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
export const IPAD = "Mozilla/5.0 (iPad; CPU OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
export const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15";

/** Signals for a window: inner and outer size, Duo closed screen and iPhone UA unless `o` says otherwise. */
export const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0,
  screenWidth: 466, screenHeight: 678, userAgent: IPHONE, touchPoints: 5, pixelRatio: 3, standalone: false, ...o,
});

const int = (a, b) => fc.integer({ min: a, max: b });
const screen = fc.constantFrom({ screenWidth: 466, screenHeight: 678 }, { screenWidth: 678, screenHeight: 466 });
const strip = (side) => side === "left" ? { insetLeft: 84 } : { insetRight: 84 };

/** Every posture a page lands in, by name. Heights span the URL bar's states (full, compact, collapsed on a scroll)
 *  and the Shared with You banner where the device shows one. */
export const WINDOWS = {
  // Safari closed upright: 382 of 466 beside the column, chrome 80 to 98, plus a 40pt banner.
  closed: int(540, 598).map((ih) => sig(382, ih, 466, 678)),
  // Closed turned: the column on the side it is turned to.
  "closed turned": fc.tuple(int(328, 372), fc.constantFrom(90, 270), screen).map(([ih, angle, s]) => sig(594, ih, 678, 466, { angle, ...s })),
  // Closed turned with no column (a page Safari lays out full width, inset 34).
  "closed turned inline": fc.tuple(int(370, 400), fc.constantFrom(0, 34)).map(([ih, b]) => sig(678, ih, 678, 466, { angle: 90, insetBottom: b })),
  // Split View pane with its column, and a pane laid out without one.
  split: fc.tuple(int(531, 571), fc.constantFrom(0, 270)).map(([ih, angle]) => sig(385, ih, 469, 669, { angle })),
  "split inline": int(449, 571).map((ih) => sig(469, ih, 469, 669)),
  // Open: wide Safari (chrome 126, up to 172 under the banner), tall Safari.
  wide: fc.tuple(int(497, 615), fc.constantFrom(0, 34), screen).map(([ih, b, s]) => sig(951, ih, 951, 669, { angle: 270, insetBottom: b, ...s })),
  tall: fc.tuple(int(800, 871), fc.constantFrom(0, 34)).map(([ih, b]) => sig(669, ih, 669, 951, { insetBottom: b })),
  // Home Screen: the strip closed upright, closed turned, open wide; inline open tall.
  "home closed": fc.tuple(int(640, 657), fc.constantFrom("left", "right"), fc.constantFrom(0, 21, 34)).map(([ih, side, b]) => sig(466, ih, 466, 678, { standalone: true, insetBottom: b, ...strip(side) })),
  "home closed turned": fc.tuple(int(430, 445), fc.constantFrom("left", "right"), screen).map(([ih, side, s]) => sig(678, ih, 466, 678, { standalone: true, insetBottom: 34, ...strip(side), ...s })),
  "home wide": fc.tuple(int(587, 648), fc.constantFrom("left", "right")).map(([ih, side]) => sig(951, ih, 951, 669, { standalone: true, ...strip(side) })),
  "home tall": int(840, 869).map((ih) => sig(669, ih, 669, 951, { standalone: true, insetBottom: 34 })),
  // The in-app Safari preview (inset 34, a top bar of 44 to 77): full screen, scrolled or not, the page sheet, and
  // turned, where its 84pt inset is the strip.
  preview: fc.oneof(int(601, 634).map((ih) => sig(382, ih, 466, 678, { insetBottom: 34 })), int(593, 626).map((ih) => sig(366, ih, 450, 670, { insetBottom: 34 })),
    fc.tuple(int(391, 400), fc.constantFrom(90, 270)).map(([ih, angle]) => sig(678, ih, 678, 466, { angle, insetBottom: 34, ...strip(angle === 90 ? "left" : "right") }))),
  // Other devices: iPhones by their screens, an iPad, a desktop browser.
  iphone: fc.tuple(fc.constantFrom([375, 812], [390, 844], [393, 852], [430, 932]), int(80, 200), fc.constantFrom(0, 34)).map(([[w, h], chrome, b]) => sig(w, h - chrome, w, h, { screenWidth: w, screenHeight: h, insetTop: b ? 47 : 0, insetBottom: b })),
  ipad: fc.tuple(fc.constantFrom([820, 1180], [1024, 1366]), int(60, 140)).map(([[w, h], chrome]) => sig(w, h - chrome, w, h, { screenWidth: w, screenHeight: h, userAgent: IPAD, insetBottom: 20 })),
  desktop: fc.tuple(int(800, 1600), int(500, 1000)).map(([w, h]) => sig(w, h, w, h + 80, { screenWidth: 1728, screenHeight: 1117, userAgent: MAC, touchPoints: 0, pixelRatio: 2 })),
};

/** One window from any posture, and a preferred side where the controls may move. A keyboard or short visual viewport
 *  sometimes, as Safari reports them (shortView, visualBottom). */
const short = fc.option(fc.tuple(int(20, 200), fc.boolean()), { freq: 4 });
export const signals = fc.tuple(fc.oneof(...Object.entries(WINDOWS).map(([name, a]) => a.map((s) => ({ name, s })))), short)
  .map(([{ name, s }, v]) => v ? { name, s: { ...s, visualHeight: s.innerHeight - v[0], editing: v[1] } } : { name, s });
export const context = fc.tuple(signals, fc.constantFrom(undefined, "left", "right")).map(([{ name, s }, side]) => ({ name, s, c: detect(s, side) }));
/** A context the controls show in, settled: not hidden, no keyboard. */
export const shown = context.filter(({ c }) => !c.hidden && !c.keyboard);

/** An app: places (menu items) with icons or not, menu.tabs, actions, folded and destructive actions, a primary. */
export const app = fc.record({
  places: int(0, 16), icons: fc.boolean(), tabs: fc.boolean(), actions: int(0, 8), folded: int(0, 2), destructive: int(0, 2),
  primary: fc.boolean(), move: fc.boolean(), close: fc.constantFrom(false, false, false, false, true),
}).map((p) => ({ ...p, menu: p.places > 0 }));

/** What chrome.tsx draws for one side (layout() there): the frame, the placed groups and the "…" list and confirm boxes. */
export function layout(c, p) {
  const f = frame(c), move = p.move && canMoveControls(c);
  const hasRest = p.actions > 0 || p.primary || p.folded + p.destructive > 0 || move;
  const tabbed = p.menu && p.tabs && p.icons ? placeTabs(c, p.places, hasRest) : undefined, overflow = !!tabbed && tabbed.shown < p.places;
  const burger = p.menu && !tabbed;
  const always = p.folded + p.destructive + (move ? 1 : 0) + (p.menu && !burger && !tabbed ? 1 : 0) + (overflow ? 1 : 0);
  const a = template(f, { room: p.menu && p.tabs ? landingRoom(c) : undefined, close: p.close, menu: burger, places: tabbed?.shown ?? 0, actions: p.actions, primary: p.primary, rest: always > 0, sidebar: false, tabPitch: tabbed?.pitch, overflow });
  const places = !p.menu ? 0 : tabbed ? p.places - tabbed.shown : a.placed.some((g) => g.group.some((s) => s.kind === "menu")) ? 0 : p.places;
  const askAt = a.placed.find((g) => g.group.some((s) => s.kind === "primary")), moreAt = a.placed.find((g) => g.group.some((s) => s.kind === "more"));
  const list = (askAt && askAt === moreAt ? 1 : 0) + p.actions - a.shown + (p.primary && !a.primary ? 1 : 0) + p.folded + (move ? 1 : 0) + p.destructive;
  const heads = (places ? 1 : 0) + (list > 0 || !(p.menu && p.tabs) ? 1 : 0);
  return { f, a, tabbed, overflow, burger, moreAt, askAt, fit: !!(p.menu && p.tabs),
    menu: moreAt && menuBox(f, moreAt.rect, places + list, heads), confirm: askAt && confirmBox(f, askAt.rect) };
}
