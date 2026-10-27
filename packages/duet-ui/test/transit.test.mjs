// Fold and turn transit (#e2e round 2): the intermediate viewport and window pairs Safari reports on a Duo while a turn
// or fold is under way, measured in the simulator at ~40ms. Each must read as in transit (controls hidden, nothing
// committed); each landed state must not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect, inTransit, isPreview, LAND_HOLD, stable } from "../src/geometry.ts";

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
test("full screen preview turned: read as the preview, controls hidden, never in transit", () => {
  for (const s of PREVIEW_FULL_TURNED) {
    assert.equal(isPreview(s), true);
    assert.equal(inTransit(s), false);
    const c = stable({ flips: [] }, s, undefined, 0);
    assert.deepEqual([c.mode, c.preview, c.hidden], ["inline", true, "preview"]);
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
