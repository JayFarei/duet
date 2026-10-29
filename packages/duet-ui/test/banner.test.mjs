// Shared with You (#112): a page opened from a link a contact sent in Messages heads the tab with a "From <name>"
// bar, 40pt above the page (real Duo, iOS 27, getduet.dev/probe 2026-10-27: closed tab 382x580 then 382x540 in 466x678,
// closed landscape 594x328 in 678x466, split panes 385x531 in 469x669, open tab 951x497 in 951x669; Safari's column
// buttons and URL bar where they were). Before, the 138pt chrome failed the column and the controls fell inline at
// +0.9s. The column holds, and every control lands where it does without the bar, in screen points.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { columnBand, detect, inTransit, isPreview, plan } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0,
  insetRight: 0, standalone: false, pixelRatio: 3, touchPoints: 5, userAgent: UA, screenWidth: 466, screenHeight: 678, angle: 0, ...o,
});
const BANNER = 40;
const L = { screenWidth: 678, screenHeight: 466, angle: 90 }, S = { screenWidth: 469, screenHeight: 669, angle: 270 };
const O = { screenWidth: 951, screenHeight: 669, angle: 270 };

// Bar heights a closed tab has: 98, 80 compact, 106 at the largest Dynamic Type.
for (const bar of [98, 80, 106]) {
  test(`closed tab, ${bar}pt URL bar under the Shared with You bar: column right, page ${BANNER}pt down`, () => {
    const s = sig(382, 678 - bar - BANNER, 466, 678), c = detect(s);
    assert.equal(c.mode, "column");
    assert.equal(c.side, "right");
    assert.equal(c.offsetTop, BANNER);
    assert.equal(isPreview(s), false);
    assert.equal(inTransit(s), false);
  });
}

const PAIRS = [
  ["closed tab", sig(382, 580, 466, 678), sig(382, 540, 466, 678)],
  ["closed landscape", sig(594, 368, 678, 466, L), sig(594, 328, 678, 466, L)],
  ["split pane", sig(385, 571, 469, 669, S), sig(385, 531, 469, 669, S)],
];
for (const [name, plainS, sharedS] of PAIRS) test(`${name}: the column holds, every control where it is without the bar, in screen points`, () => {
  const plain = detect(plainS), shared = detect(sharedS);
  assert.equal(plain.mode, "column");
  assert.equal(shared.mode, "column");
  assert.equal(shared.side, plain.side);
  assert.equal(plain.offsetTop, 0);
  assert.equal(shared.offsetTop, BANNER);
  assert.equal(inTransit(sharedS), false);
  const a = columnBand(plain), b = columnBand(shared);
  assert.equal(b.top + BANNER, a.top);
  assert.equal(b.bottom + BANNER, a.bottom);
  for (const tabs of [0, 3, 9]) for (const actions of [0, 1, 4]) for (const back of [false, true]) {
    const spec = { back, leading: 0, actions, tabs, primary: true, searchButton: !tabs, accessory: false, minimized: false };
    const p = plan(plain, spec), q = plan(shared, spec), at = JSON.stringify(spec);
    assert.equal(q.columnTop + BANNER, p.columnTop, at);
    assert.equal(q.columnBottom + BANNER, p.columnBottom, at);
    assert.equal(q.left, p.left, at);
    for (const k of ["back", "primary", "actions", "leading", "more", "tabs", "searchButton", "rail"]) {
      assert.equal(!!q[k], !!p[k], `${k}, ${at}`);
      if (!p[k]) continue;
      assert.equal(q[k].top + BANNER, p[k].top, `${k}, ${at}`);
      assert.ok(q[k].top >= 0 && q[k].top + q[k].height <= shared.height, `${k} inside the page, ${at}`);
    }
  }
});

// What the bar's band must not swallow.
const STILL_TRANSIT = [
  ["unfold: page landed, window not (466x498 page)", sig(466, 498, 466, 678)],
  ["turn to portrait: column open, URL bar not resized (382x498)", sig(382, 498, 466, 678)],
  ["split entry: the full window's column layout handed the open window", sig(867, 543, 951, 669, O)],
  // Under the bar (the probe's log, real Duo): the open window's stale column, the pane's and the closed tab's first frames.
  ["unfold under the bar: stale column in the open window, inset 34", sig(867, 497, 951, 669, { ...O, insetBottom: 34 })],
  ["split entry under the bar: pane at 220pt chrome, no column", sig(469, 449, 469, 669, S)],
  ["split entry under the bar: pane at 220pt chrome, column", sig(385, 449, 469, 669, S)],
  ["fold under the bar: closed window at 220pt chrome", sig(466, 458, 466, 678)],
];
for (const [name, s] of STILL_TRANSIT) test(`still in transit: ${name}`, () => {
  assert.equal(inTransit(s), true);
  assert.notEqual(detect(s).mode, "column");
});

test("an open tab with its tab bar under the bar (951x497, chrome 172): inline, landed, no offset", () => {
  const s = sig(951, 497, 951, 669, { ...O, insetBottom: 34 }), c = detect(s);
  assert.equal(c.mode, "inline");
  assert.equal(c.offsetTop, 0);
  assert.equal(inTransit(s), false);
});

test("pre-paint boot: the scroller's bottom inset is the URL bar alone", async () => {
  const code = await (await import("../scripts/boot.mjs")).bundle();
  const vars = new Map(), attrs = new Map();
  const html = { dataset: new Proxy({}, { set: (_, k, v) => (attrs.set(k, v), true) }), toggleAttribute: () => true, style: { setProperty: (k, v) => vars.set(k, v) } };
  const g = {
    innerWidth: 382, innerHeight: 540, outerWidth: 466, outerHeight: 678, devicePixelRatio: 3,
    screen: { width: 466, height: 678, orientation: { angle: 0 } }, navigator: { userAgent: UA, maxTouchPoints: 5, standalone: false },
    matchMedia: () => ({ matches: false }), document: { documentElement: html }, visualViewport: { height: 540, scale: 1 },
  };
  g.window = g; g.top = g;
  vm.runInNewContext(code, g);
  assert.equal(attrs.get("duetMode"), "column");
  assert.equal(vars.get("--duet-inset-bottom"), "98px");
});
