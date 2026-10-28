// Unfold from the closed in-app preview (e2e RC run 2026-10-27, j27/j28/j29, real signals at ~44ms): the open window
// (669x951) arrives with the closed page's 84pt column still in it, 585x876, before the page fills it (669x800). No
// landed state has a column in the full open window, so that frame is a fold caught halfway, not a column. The
// controller often misses the frame before it (WebKit holds resize events back while the window animates), and
// committed Safari's column for ~90ms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, inTransit, LAND_HOLD, stable } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0,
  insetRight: 0, standalone: false, pixelRatio: 3, touchPoints: 5, userAgent: UA, screenWidth: 669, screenHeight: 951, angle: 0, ...o,
});

const STALE = [];
for (const angle of [0, 90, 270]) {
  STALE.push([`open tall at ${angle}, the closed page's column still in it`, sig(585, 876, 669, 951, { angle, insetTop: 7, insetBottom: 34 })]);
  STALE.push([`open tall at ${angle}, no insets yet`, sig(585, 876, 669, 951, { angle })]);
}
STALE.push(["open wide, the closed page's column still in it", sig(867, 595, 951, 669, { screenWidth: 951, screenHeight: 669, insetBottom: 34 })]);
for (const [name, s] of STALE) test(`in transit, never a column: ${name}`, () => {
  assert.equal(inTransit(s), true);
  assert.notEqual(detect(s).mode, "column");
});

test("unfold with the transit frame missed: hidden until the page fills the window, never the column", () => {
  const closed = sig(678, 391, 678, 466, { screenWidth: 678, screenHeight: 466, angle: 90, insetLeft: 84, insetBottom: 34 });
  const seq = [[0, closed], [4442, sig(585, 876, 669, 951, { angle: 90, insetTop: 7, insetBottom: 34 })], [4486, sig(669, 800, 669, 951, { angle: 90, insetTop: 7 })],
    [4574, sig(669, 800, 669, 951, { angle: 180, insetTop: 7 })]];
  const d = { flips: [] }, t0 = 4400;
  let i = 0, landed;
  for (let t = 0; t < 7000; t += 16) {
    while (i + 1 < seq.length && seq[i + 1][0] <= t) i++;
    const c = stable(d, seq[i][1], undefined, t, t >= t0 && t - t0 < 2000);
    if (t < t0) continue;
    assert.ok(c.hidden || c.mode !== "column", `column shown at +${t}`);
    if (t >= 4442 && !c.hidden && landed === undefined) landed = t;
  }
  assert.ok(landed >= 4574 + LAND_HOLD, `shown at +${landed}, before the landing held`);
});
