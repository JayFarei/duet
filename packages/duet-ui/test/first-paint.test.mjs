// A Home Screen launch on the Duo's inner screen, before the page has settled. iOS first
// reports the closed screen's window inside the open screen's outer size, in both orientations, with insets 0, then
// lands (measured on the Duo simulator, iOS 27.1). Everything here is the window before the landing.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { stable, PREVIEW_RISE } from "../src/geometry.ts";

const bootScript = await (await import("../scripts/boot.mjs")).bundle();
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0,
  screenWidth: 466, screenHeight: 678, userAgent: IPHONE, touchPoints: 5, pixelRatio: 3, standalone: true, ...o,
});
const LAUNCH_WIDE = sig(466, 678, 951, 669), LAUNCH_TALL = sig(466, 678, 669, 951);

function boot(s) {
  const attrs = new Map();
  const html = {
    dataset: new Proxy({}, { set: (_, k, v) => (attrs.set(`data-${String(k)}`, v), true) }),
    toggleAttribute: (k, on) => (on ? attrs.set(k, "") : attrs.delete(k), on),
    style: { setProperty() {} },
  };
  const g = {
    innerWidth: s.innerWidth, innerHeight: s.innerHeight, outerWidth: s.outerWidth, outerHeight: s.outerHeight, devicePixelRatio: 3,
    screen: { width: s.screenWidth, height: s.screenHeight, orientation: { angle: 0 } },
    navigator: { userAgent: s.userAgent, maxTouchPoints: s.touchPoints, standalone: s.standalone }, matchMedia: () => ({ matches: false }),
    document: { documentElement: html, querySelector: () => null }, visualViewport: { height: s.innerHeight, scale: 1 },
  };
  g.window = g; g.top = g;
  vm.runInNewContext(bootScript, g);
  return Object.fromEntries(attrs);
}

test("web app launch, both ways up: the controls waiting from the first paint", () => {
  for (const s of [LAUNCH_WIDE, LAUNCH_TALL, sig(466, 669, 951, 669), sig(867, 648, 951, 669)]) {
    const a = boot(s);
    assert.ok("data-duet-pending" in a, JSON.stringify(a));
    assert.ok(!("data-duet-mode" in a));
  }
});

test("not a launch: the first paint is what it was", () => {
  const untouched = {
    "closed web app": sig(466, 678, 466, 678),
    "closed Safari tab": sig(382, 580, 466, 678, { standalone: false }),
    "open Safari tab at the closed width": sig(466, 678, 951, 669, { standalone: false }),
    "narrow window inside the open screen": sig(480, 800, 480, 951),
    "ipad at the closed width": sig(466, 678, 951, 669, { userAgent: MAC, screenWidth: 820, screenHeight: 1180 }),
    desktop: sig(466, 678, 951, 669, { userAgent: MAC, touchPoints: 0, screenWidth: 1512, screenHeight: 982 }),
  };
  for (const [name, s] of Object.entries(untouched)) {
    assert.ok(!("data-duet-pending" in boot(s)) || name === "closed Safari tab", name);
  }
});

test("a launch hides the controls until the window lands, then shows them", () => {
  const d = {};
  assert.equal(stable(d, LAUNCH_WIDE, undefined, 0).hidden, "pending");
  assert.equal(stable(d, sig(466, 669, 951, 669, { insetRight: 84 }), undefined, 100).hidden, "pending");
  assert.equal(stable(d, sig(951, 669, 951, 669), undefined, 150).hidden, "pending", "the wide window before its band");
  const landed = stable(d, sig(951, 669, 951, 669, { insetRight: 84, insetBottom: 34 }), undefined, 200);
  assert.equal(landed.hidden, undefined);
  assert.equal(landed.mode, "strip");
  const t = {};
  assert.equal(stable(t, LAUNCH_TALL, undefined, 0).hidden, "pending");
  assert.equal(stable(t, sig(669, 869, 669, 951, { insetBottom: 34 }), undefined, 200).hidden, undefined, "portrait has no band to wait for");
});

test("the launch's mid-way scale (2.04, closed width scaled up to the open screen) keeps the controls hidden, up to the cap", () => {
  const d = {}, zoomed = sig(466, 669, 951, 669, { insetRight: 84, insetBottom: 34, scale: 2.04 });
  assert.equal(stable(d, LAUNCH_WIDE, undefined, 0).hidden, "pending");
  assert.equal(stable(d, zoomed, undefined, 100).hidden, "pending");
  assert.notEqual(stable(d, zoomed, undefined, PREVIEW_RISE + 1).hidden, "pending");
  assert.equal(d.pendingUntil, undefined, "no timer left re-reading");
});

test("a launch that never lands shows the controls after the cap", () => {
  const d = {};
  assert.equal(stable(d, LAUNCH_WIDE, undefined, 0).hidden, "pending");
  assert.notEqual(stable(d, LAUNCH_WIDE, undefined, PREVIEW_RISE + 1).hidden, "pending");
});

test("only the first reading counts: a running app whose inset goes away is not a launch", () => {
  const d = {};
  stable(d, sig(951, 669, 951, 669, { insetRight: 84 }), undefined, 0);
  assert.notEqual(stable(d, sig(951, 669, 951, 669), undefined, 5000).hidden, "pending");
  assert.notEqual(stable(d, LAUNCH_WIDE, undefined, 9000).hidden, "pending");
});

test("a page that opts out of viewport-fit=cover keeps inner 867 inside outer 951: not a launch", () => {
  assert.notEqual(stable({}, sig(867, 669, 951, 669, { uncovered: true }), undefined, 0).hidden, "pending");
});

// A wide launch of a page with cover, or that Duet will give cover (Duo simulator, 30fps, 9 of 9 launches): 867 with insets
// 0 or 84, then 951 with 84. Shown at 867, the controls hop 84pt in the launch fade, and 4 of 9 showed the inline burger first.
test("a wide launch waits out the 867 window, whichever way its inset reads", () => {
  for (const first of [{}, { insetRight: 84, insetBottom: 34 }]) {
    const d = {};
    assert.equal(stable(d, sig(867, 648, 951, 669, first), undefined, 0).hidden, "pending");
    assert.equal(stable(d, sig(867, 648, 951, 669, { insetRight: 84, insetBottom: 34 }), undefined, 60).hidden, "pending");
    const landed = stable(d, sig(951, 648, 951, 669, { insetRight: 84, insetBottom: 34 }), undefined, 110);
    assert.equal(landed.hidden, undefined);
    assert.equal(landed.mode, "strip");
    assert.equal(landed.width, 951);
  }
});

test("a wide launch stuck at 867 shows the controls after the cap", () => {
  const d = {}, stuck = sig(867, 648, 951, 669, { insetRight: 84, insetBottom: 34 });
  assert.equal(stable(d, stuck, undefined, 0).hidden, "pending");
  assert.notEqual(stable(d, stuck, undefined, PREVIEW_RISE + 1).hidden, "pending");
});

test("a running app is not held at 867: the launch wait reads only the first window", () => {
  const d = {};
  stable(d, sig(951, 648, 951, 669, { insetRight: 84, insetBottom: 34 }), undefined, 0);
  assert.notEqual(stable(d, sig(867, 648, 951, 669), undefined, 5000).hidden, "pending");
});

// A live turn of an open Duo's Home Screen app from tall to wide (Duo simulator, 30fps): the wide window comes ~30ms in,
// its strip inset ~370ms later. Until then the page reads inline, whose burger sits at the top, over the status bar.
const TALL = sig(669, 869, 669, 951, { insetBottom: 34 });
const TURN_TO_WIDE = [sig(951, 587, 951, 669, { insetBottom: 34 }), sig(951, 648, 951, 669, { insetTop: 61, insetBottom: 34 }), sig(951, 648, 951, 669, { insetBottom: 34 })];
const WIDE_LANDED = sig(951, 648, 951, 669, { insetRight: 84, insetBottom: 34 });

test("turning an open Home Screen app to wide: no inline controls before the strip, which lands in place while settling", () => {
  const d = {};
  stable(d, TALL, undefined, 0);
  TURN_TO_WIDE.forEach((s, i) => {
    const c = stable(d, s, undefined, 100 + i * 100, true);
    assert.equal(c.hidden, "moving", `reading ${i}`);
    assert.equal(c.width, 669, "the last context stays whole");
  });
  const landed = stable(d, WIDE_LANDED, undefined, 400, true);
  assert.equal(landed.mode, "strip", "not held back to the settle, or it glides from the inline top");
  assert.equal(landed.hidden, undefined);
  assert.equal(landed.confidence, "settling", "no transition");
  const sure = stable(d, WIDE_LANDED, undefined, 1400);
  assert.equal(sure.mode, "strip");
  assert.equal(sure.confidence, "sure");
});

test("a wide Home Screen window whose strip never lands shows inline at the settle, and stays shown", () => {
  const d = {};
  stable(d, TALL, undefined, 0);
  assert.equal(stable(d, TURN_TO_WIDE[2], undefined, 100, true).hidden, "moving");
  const settled = stable(d, TURN_TO_WIDE[2], undefined, 2100);
  assert.equal(settled.mode, "inline");
  assert.equal(settled.hidden, undefined);
  assert.equal(stable(d, TURN_TO_WIDE[2], undefined, 2200, true).hidden, undefined, "a later event does not hide it again");
});

// viewport-fit=auto or contain: no inset ever comes. iOS narrows the page to 867 inside 951 ~380ms into the turn (Duo simulator).
test("a page that opts out of cover turns to wide: inline commits in place at 867, not at the settle where it glides", () => {
  const d = {}, opts = { uncovered: true };
  stable(d, sig(669, 930, 669, 951, opts), undefined, 0);
  assert.equal(stable(d, sig(951, 648, 951, 669, opts), undefined, 100, true).hidden, "moving", "before the page narrows, it would stand 84pt off");
  const c = stable(d, sig(867, 648, 951, 669, opts), undefined, 480, true);
  assert.equal(c.mode, "inline");
  assert.equal(c.hidden, undefined);
  assert.equal(c.width, 867);
  assert.equal(c.confidence, "settling", "no transition");
  const sure = stable(d, sig(867, 648, 951, 669, opts), undefined, 1100);
  assert.equal(sure.width, 867);
  assert.equal(sure.confidence, "sure");
});

test("turning back to tall does not hide: the inline place is taken at once", () => {
  const d = {};
  stable(d, TALL, undefined, 0);
  stable(d, WIDE_LANDED, undefined, 100);
  const c = stable(d, sig(669, 930, 669, 951, { insetTop: 61, insetBottom: 34 }), undefined, 200, true);
  assert.equal(c.mode, "inline");
  assert.equal(c.hidden, undefined);
});

test("the wait for the strip is the open Duo's Home Screen app only", () => {
  for (const [name, s] of Object.entries({
    "Safari tab": sig(951, 543, 951, 669, { standalone: false }),
    iPad: sig(1366, 1024, 1366, 1024, { userAgent: MAC, screenWidth: 1024, screenHeight: 1366 }),
    phone: sig(852, 393, 852, 393, { screenWidth: 393, screenHeight: 852 }),
    desktop: sig(1512, 900, 1512, 982, { userAgent: MAC, touchPoints: 0, standalone: false, screenWidth: 1512, screenHeight: 982 }),
  })) {
    const d = {};
    stable(d, sig(s.innerHeight, s.innerWidth, s.outerHeight, s.outerWidth, s), undefined, 0);
    assert.notEqual(stable(d, s, undefined, 100, true).hidden, "moving", name);
  }
});
