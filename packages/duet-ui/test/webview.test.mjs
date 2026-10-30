// An app's own web view over the whole closed screen (X's link preview, #194): a WKWebView edge to edge, no Safari
// token, chrome 0. Measured on the Duo Lab sim, iOS 27.1, e2e host style "webview" (2026-10-29): inner = outer =
// screen = 466x678, inset top 0, inset bottom 34. The status column (clock, island, Live Activities at their worst)
// covers the page's right edge down to DUO.top + DUO.island, so no control may start above it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, DUO } from "../src/geometry.ts";
import { frame, template } from "../src/template.ts";

const X = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/11.0";
const sig = (o = {}) => ({
  innerWidth: 466, innerHeight: 678, outerWidth: 466, outerHeight: 678, visualHeight: 678, insetTop: 0, insetBottom: 34,
  screenWidth: 466, screenHeight: 678, insetRight: 0, insetLeft: 0, standalone: false, pixelRatio: 3, userAgent: X, angle: 0, ...o,
});
const STATUS = { x: 466 - 84, y: 0, w: 84, h: DUO.top + DUO.island };
const hit = (a, n) => a.x < n.x + n.w && a.x + a.w > n.x && a.y < n.y + n.h && a.y + a.h > n.y;
const SPECS = [];
for (const close of [false, true]) for (const menu of [false, true]) for (const actions of [0, 1, 4]) for (const primary of [false, true])
  SPECS.push({ close, menu, actions, primary });

test("web view, closed, upright: inline right, clear of the status column", () => {
  const c = detect(sig());
  assert.deepEqual([c.mode, c.side, c.browser, c.clearTop], ["inline", "right", "webview", DUO.top + DUO.island]);
  for (const spec of SPECS) for (const g of template(frame(c), spec).placed)
    assert.ok(!hit(g.rect, STATUS), `${g.group.map((x) => x.kind).join("+")} at ${g.rect.x},${g.rect.y} under the status column (${JSON.stringify(spec)})`);
});

test("web view, closed, upright, controls on the left: nothing to clear", () => {
  assert.equal(detect(sig(), "left").clearTop, undefined);
});

// X's in-app browser early in 2026-10 (user's report on #194; since measured at 382pt wide, #243): the web view is full width on the
// screen's top 61%, X's bar and the tweet card below it, so the page reads 466x413 and landscape.
// Measured (e2e xsheet, 2026-10-30): closed upright inner = outer = 466x414, screen 678x466, inset right 84, bottom 0;
// open wide 951x408, screen still 678x466, angle 270.
test("X sheet, closed, upright: full width, short, still clear of the status column", () => {
  const c = detect(sig({ innerHeight: 414, outerHeight: 414, visualHeight: 414, screenWidth: 678, screenHeight: 466, insetRight: 84, insetBottom: 0 }));
  assert.deepEqual([c.mode, c.side, c.clearTop], ["inline", "right", DUO.top + DUO.island]);
  for (const spec of SPECS) for (const g of template(frame(c), spec).placed)
    assert.ok(!hit(g.rect, STATUS), `${g.group.map((x) => x.kind).join("+")} at ${g.rect.x},${g.rect.y} under the status column (${JSON.stringify(spec)})`);
});

test("X sheet, open wide: clear of the status column", () => {
  const c = detect(open({ innerHeight: 408, outerHeight: 408, visualHeight: 408, screenWidth: 678, screenHeight: 466, insetRight: 84, insetBottom: 0 }));
  assert.equal(c.clearTop, DUO.top + DUO.island);
  const column = { ...STATUS, x: 951 - 84 };
  for (const spec of SPECS) for (const g of template(frame(c), spec).placed)
    assert.ok(!hit(g.rect, column), `${g.group.map((x) => x.kind).join("+")} at ${g.rect.x},${g.rect.y} under the status column (${JSON.stringify(spec)})`);
});

// X's sheet on a real Duo, closed upright (#243): the web view stops at the status column, so the page is not a Duo's.
test("web view that stops at the status column: not a Duo", () => {
  for (const [innerHeight, outerHeight] of [[422, 477], [541, 587]]) {
    const c = detect(sig({ innerWidth: 382, outerWidth: 382, innerHeight, outerHeight, visualHeight: innerHeight, insetBottom: 0 }));
    assert.deepEqual([c.duo, c.device, c.mode, c.clearTop], [false, "iphone", "inline", undefined]);
  }
  assert.equal(detect(sig()).duo, true);
  const safari = sig({ innerWidth: 382, outerWidth: 466, userAgent: X.replace("Mobile/15E148 Twitter for iPhone/11.0", "Version/27.1 Mobile/15E148 Safari/604.1") });
  assert.equal(detect(safari).duo, true);
});

test("Home Screen app and turned web view: unchanged", () => {
  assert.equal(detect(sig({ standalone: true })).clearTop, undefined);
  assert.equal(detect(sig({ innerWidth: 678, innerHeight: 466, outerWidth: 678, outerHeight: 466, screenWidth: 678, screenHeight: 466, angle: 90 })).clearTop, undefined);
});

// Unfolded, measured the same way (2026-10-30): wide, inner = outer = 951x669 at angle 270, inset bottom 34, no side
// inset, the status column heading the right edge; tall, 669x951 with the status row above the controls.
const open = (o = {}) => sig({ innerWidth: 951, innerHeight: 669, outerWidth: 951, outerHeight: 669, visualHeight: 669, screenWidth: 951, screenHeight: 669, angle: 270, ...o });

test("web view, open wide: inline right, clear of the status column", () => {
  const c = detect(open());
  assert.deepEqual([c.mode, c.side, c.clearTop], ["inline", "right", DUO.top + DUO.island]);
  const column = { ...STATUS, x: 951 - 84 };
  for (const spec of SPECS) for (const g of template(frame(c), spec).placed)
    assert.ok(!hit(g.rect, column), `${g.group.map((x) => x.kind).join("+")} at ${g.rect.x},${g.rect.y} under the status column (${JSON.stringify(spec)})`);
});

test("open: a Safari tab (chrome 126) and the tall web view are unchanged", () => {
  assert.equal(detect(open({ userAgent: X + " Safari/604.1", innerHeight: 543, visualHeight: 543 })).clearTop, undefined);
  assert.equal(detect(open({ innerWidth: 669, innerHeight: 951, outerWidth: 669, outerHeight: 951, visualHeight: 951, screenWidth: 669, screenHeight: 951, angle: 0 })).clearTop, undefined);
});
