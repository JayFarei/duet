// Fold and turn transit (#e2e round 2): the intermediate viewport and window pairs Safari reports on a Duo while a turn
// or fold is under way, measured in the simulator at ~40ms. Each must read as in transit (controls hidden, nothing
// committed); each landed state must not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DUO, detect, inTransit, isPreview, LAND_HOLD, plan, stable } from "../src/geometry.ts";

const F = JSON.parse(readFileSync(new URL("./fixtures/states.json", import.meta.url), "utf8"));
const full = (s) => ({
  insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3, userAgent: F.ua,
  screenWidth: 466, screenHeight: 678, visualHeight: s.innerHeight, angle: 0, ...s,
});
const at = (name) => full(F.states.find((x) => x.name.startsWith(name)).s);
const P = { outerWidth: 466, outerHeight: 678 }, L = { outerWidth: 678, outerHeight: 466, screenWidth: 678, screenHeight: 466 };

// Turn from landscape (angle 90) back to portrait: viewport first, window later.
const TURN_90_TO_0 = [
  full({ ...L, innerWidth: 678, innerHeight: 340, angle: 0 }), // angle flipped, sizes still landscape
  full({ ...P, innerWidth: 466, innerHeight: 498 }),          // page full width, short: column not opened yet
  full({ ...P, innerWidth: 382, innerHeight: 498 }),          // column open, URL bar not resized yet
];
// Unfold from a portrait tab: the page grows before the window does.
const UNFOLD = [
  full({ ...P, innerWidth: 466, innerHeight: 498 }),
  full({ ...P, innerWidth: 951, innerHeight: 543 }),
  full({ outerWidth: 466, outerHeight: 678, innerWidth: 951, innerHeight: 543, screenWidth: 466, screenHeight: 678 }),
];
const LANDED = [
  ...F.states.map((x) => [x.name, full(x.s)]),
  ["fresh tab opened in landscape (no column)", full({ ...L, innerWidth: 678, innerHeight: 340, angle: 90 })],
  ["unfolded, screen.* stale at the folded size", full({ outerWidth: 951, outerHeight: 669, innerWidth: 951, innerHeight: 543 })],
];

// Split entry from full width (e2e round 3, split-left): Safari comes back from the home screen still laid out with its
// 84pt column against the full open window, then gets the 469x669 pane ~200ms later.
// Going home from a split pane (split-swap-left), the pane's page is handed the closed screen's window for ~50ms.
const SPLIT_ENTRY = [
  full({ outerWidth: 951, outerHeight: 669, innerWidth: 867, innerHeight: 543, screenWidth: 951, screenHeight: 669, angle: 270 }),
  full({ outerWidth: 466, outerHeight: 678, innerWidth: 385, innerHeight: 571, angle: 0 }),
  full({ outerWidth: 466, outerHeight: 678, innerWidth: 385, innerHeight: 571, angle: 270 }),
];
LANDED.push(["split pane, Safari column beside the page", full({ outerWidth: 469, outerHeight: 669, innerWidth: 385, innerHeight: 571, screenWidth: 951, screenHeight: 669, angle: 270 })]);
// Largest Dynamic Type (accessibility-extra-extra-extra-large, e2e round 3): Safari's bottom bar grows 98 -> 106.
const DYNAMIC_TYPE_TAB = full({ ...P, innerWidth: 382, innerHeight: 572 });
LANDED.push(["tab at the largest Dynamic Type, bottom bar 106pt", DYNAMIC_TYPE_TAB]);
test("tab at the largest Dynamic Type: column, right", () => {
  const c = detect(DYNAMIC_TYPE_TAB);
  assert.deepEqual([c.mode, c.side], ["column", "right"]);
});
// The preview's sheet on the open screen (e2e round 3, preview-unfolded): landed wide and tall, with and without the
// 34pt bottom inset; a column-narrow page in that window is the turn caught halfway.
const O = { screenWidth: 951, screenHeight: 669 };
LANDED.push(["unfolded preview sheet, wide", full({ ...O, outerWidth: 653, outerHeight: 661, innerWidth: 653, innerHeight: 515, angle: 270 })]);
LANDED.push(["unfolded preview sheet, wide, inset 34", full({ ...O, outerWidth: 653, outerHeight: 661, innerWidth: 653, innerHeight: 591, insetBottom: 34, angle: 270 })]);
LANDED.push(["unfolded preview sheet, tall", full({ ...O, outerWidth: 653, outerHeight: 869, innerWidth: 653, innerHeight: 710, angle: 180 })]);
test("unfolded preview sheet, turn caught halfway (569x786 in 653x869): in transit", () =>
  assert.equal(inTransit(full({ ...O, outerWidth: 653, outerHeight: 869, innerWidth: 569, innerHeight: 786, angle: 270 })), true));
test("unfolded preview sheet: read as the preview, inline right, never hidden", () => {
  for (const s of [
    full({ ...O, outerWidth: 653, outerHeight: 661, innerWidth: 653, innerHeight: 515, angle: 270 }),
    full({ ...O, outerWidth: 653, outerHeight: 661, innerWidth: 653, innerHeight: 591, insetBottom: 34, angle: 270 }),
    full({ ...O, outerWidth: 653, outerHeight: 869, innerWidth: 653, innerHeight: 710, angle: 180 }),
  ]) {
    assert.equal(isPreview(s), true);
    const c = stable({ flips: [] }, s, undefined, 0);
    assert.deepEqual([c.mode, c.side, c.preview, c.hidden], ["inline", "right", true, undefined]);
  }
  // A full-width open tab is not the preview.
  assert.equal(isPreview(full({ ...O, outerWidth: 951, outerHeight: 669, innerWidth: 951, innerHeight: 543 })), false);
});
test("a negative visual viewport (sheet folded from the open screen) is not a keyboard", () => {
  const c = detect({ ...at("in-app preview, page sheet (real"), visualHeight: -78 });
  assert.deepEqual([c.mode, c.keyboard], ["column", undefined]);
});
for (const [i, s] of SPLIT_ENTRY.entries()) test(`split entry, step ${i}: in transit`, () => assert.equal(inTransit(s), true));
for (const [i, s] of TURN_90_TO_0.entries()) test(`turn 90 to 0, step ${i}: in transit`, () => assert.equal(inTransit(s), true));
for (const [i, s] of UNFOLD.entries()) test(`unfold, step ${i}: in transit`, () => assert.equal(inTransit(s), true));
for (const [name, s] of LANDED) test(`landed: ${name}`, () => assert.equal(inTransit(s), false));

test("a whole 90 to 0 turn: hidden through the steps, the old placement kept, column right once landed", () => {
  const d = { flips: [] };
  const start = stable(d, at("tab, landscape turned left"), undefined, 0);
  assert.deepEqual([start.mode, start.side, start.hidden], ["column", "left", undefined]);
  TURN_90_TO_0.forEach((s, i) => {
    const c = stable(d, s, undefined, 100 + 40 * i, true);
    assert.deepEqual([c.hidden, c.side, c.mode], ["moving", "left", "column"], `step ${i}`);
  });
  const early = stable(d, at("tab, fresh load"), undefined, 300, true);
  assert.deepEqual([early.hidden, early.side], ["moving", "left"], "the landing must hold LAND_HOLD first");
  const end = stable(d, at("tab, fresh load"), undefined, 300 + LAND_HOLD, true);
  assert.deepEqual([end.mode, end.side, end.hidden], ["column", "right", undefined]);
});
// Unfold from closed landscape (angle 90, the 678x340 window Safari keeps after a fold, inset 34): the window passes
// through closed portrait for ~90ms before the open one (simulator, e2e round 2, fold-unfold-from-90b).
const UNFOLD_FROM_90 = [
  [4004, full({ ...L, innerWidth: 678, innerHeight: 340, insetBottom: 34, angle: 0 })],
  [4047, full({ ...P, innerWidth: 466, innerHeight: 498 })],
  [4443, full({ ...P, innerWidth: 382, innerHeight: 580 })], // reads as landed: closed portrait, column right
  [4488, full({ ...P, innerWidth: 382, innerHeight: 580 })],
  [4531, full({ ...P, innerWidth: 466, innerHeight: 498 })],
  [4664, full({ outerWidth: 951, outerHeight: 669, innerWidth: 951, innerHeight: 543, insetBottom: 34, angle: 270 })],
];
test("unfold from closed landscape: the brief closed portrait window never shows the column", () => {
  const d = { flips: [] };
  stable(d, full({ ...L, innerWidth: 678, innerHeight: 340, insetBottom: 34, angle: 90 }), undefined, 0);
  for (const [t, s] of UNFOLD_FROM_90) {
    const c = stable(d, s, undefined, t, true);
    assert.equal(c.hidden, "moving", `+${t}ms`);
  }
  assert.equal(d.landUntil, 4664 + LAND_HOLD, "the caller re-reads when the landing has held");
  const end = stable(d, UNFOLD_FROM_90.at(-1)[1], undefined, 4664 + LAND_HOLD, true);
  assert.deepEqual([end.mode, end.hidden, end.confidence], ["inline", undefined, "settling"]);
});
test("a landing commits at once when the window has settled (no hold outside a settle)", () => {
  const d = { flips: [] };
  stable(d, TURN_90_TO_0[1], undefined, 0, true);
  const c = stable(d, at("tab, fresh load"), undefined, 10, false);
  assert.deepEqual([c.mode, c.hidden], ["column", undefined]);
});
// Full screen preview turned (iOS 27.1 simulator, e2e round 2, preview-full and preview-default 0to90/90to270):
// the whole window, no page column, the preview's buttons in a safe-area inset.
const PREVIEW_FULL_TURNED = [
  full({ ...L, innerWidth: 678, innerHeight: 391, insetBottom: 34, insetLeft: 84, angle: 90 }),
  full({ ...L, innerWidth: 678, innerHeight: 391, insetBottom: 34, insetRight: 84, angle: 270 }),
];
// Its native buttons (Close, Back, Page Menu, Address, Share, Reload, Open in Safari) are all in a 44pt bar at window
// y 24, x 84..661 at angle 90 (e2e round 4, XCUITest frames); the page starts at window y 75, below it.
test("full screen preview turned: read as the preview, controls in the 84pt safe-area band, never in transit", () => {
  for (const s of PREVIEW_FULL_TURNED) {
    assert.equal(isPreview(s), true);
    assert.equal(inTransit(s), false);
    const c = stable({ flips: [] }, s, undefined, 0);
    const side = s.insetLeft ? "left" : "right";
    assert.deepEqual([c.mode, c.side, c.preview, c.hidden], ["strip", side, true, undefined]);
    const p = plan(c, { back: false, leading: 0, actions: 2, tabs: 3, searchButton: false, accessory: false, minimized: false });
    const x0 = p.left, x1 = p.left + DUO.control, band = side === "left" ? [0, 84] : [678 - 84, 678];
    assert.ok(x0 >= band[0] && x1 <= band[1], `inside the band: ${x0}..${x1}`);
    const boxes = [p.actions, p.more, p.tabs].filter(Boolean);
    for (const b of boxes) assert.ok(b.top >= DUO.gap && b.top + b.height <= 391 - 34, `below the bar, above the home indicator: ${b.top}+${b.height}`);
    assert.equal(p.tabs?.min, false);
  }
  // A turned tab is never taken for it: fresh (126pt chrome, inset 34 after a fold) or with its column (98).
  assert.equal(isPreview(full({ ...L, innerWidth: 678, innerHeight: 340, insetBottom: 34, angle: 90 })), false);
  assert.equal(isPreview(full({ ...L, innerWidth: 594, innerHeight: 368, angle: 90 })), false);
});
test("transit is a Duo Safari tab thing: other browsers, frames and Home Screen apps never hide", () => {
  const s = TURN_90_TO_0[1];
  assert.equal(inTransit({ ...s, standalone: true }), false);
  assert.equal(inTransit({ ...s, framed: true }), false);
  const chrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1";
  assert.equal(inTransit({ ...s, userAgent: chrome }), false);
});
test("in-app preview in landscape: the controls hide, the page keeps its full width", () => {
  for (const name of ["in-app preview, page sheet, turned left", "in-app preview, page sheet, turned right"]) {
    const c = detect(at(name), undefined, true, true);
    assert.equal(c.hidden, "preview", name);
  }
  assert.equal(detect(at("in-app preview, page sheet (real Duo"), undefined, true, true).hidden, undefined);
  assert.equal(detect(at("tab, landscape turned left")).hidden, undefined);
});

// Fold the open preview sheet (e2e round 4, pvu-open-unfolded-fold): the closed sheet's page comes back with a stale
// visualViewport.scale (1.0152, the open page's 935 scroll width briefly). That is WebKit's, not a pinch: the hold must
// not keep the open screen's inline placement in the closed window.
test("fold the open preview sheet with a stale scale: not held, column right in the closed sheet", () => {
  const d = { flips: [] };
  const open = stable(d, full({ ...O, outerWidth: 653, outerHeight: 661, innerWidth: 653, innerHeight: 515, angle: 270 }), undefined, 0);
  assert.equal(open.mode, "inline");
  const sheet = { outerWidth: 450, outerHeight: 670, innerWidth: 366, innerHeight: 600, insetBottom: 34, scale: 1.0152 };
  const mid = stable(d, full({ ...sheet, angle: 270 }), undefined, 100, true);
  assert.notEqual(mid.confidence, "held");
  const c = stable(d, full({ ...sheet, angle: 0 }), undefined, 3000, false);
  assert.deepEqual([c.mode, c.side, c.hidden, c.preview], ["column", "right", undefined, true]);
});
test("a pinch in the same window still holds the committed context", () => {
  const d = { flips: [] };
  const s = at("tab, fresh load");
  const a = stable(d, s, undefined, 0);
  const z = stable(d, { ...s, scale: 1.6, innerWidth: 240 }, undefined, 1000);
  assert.deepEqual([z.mode, z.side, z.confidence], [a.mode, a.side, "held"]);
});
