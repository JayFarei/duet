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
    document: { documentElement: html }, visualViewport: { height: s.innerHeight, scale: 1 },
  };
  g.window = g; g.top = g;
  vm.runInNewContext(bootScript, g);
  return Object.fromEntries(attrs);
}

test("web app launch, both ways up: the controls waiting from the first paint", () => {
  for (const s of [LAUNCH_WIDE, LAUNCH_TALL, sig(466, 669, 951, 669)]) {
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

test("full screen fit none keeps inner 867 inside outer 951: not a launch", () => {
  assert.notEqual(stable({}, sig(867, 669, 951, 669), undefined, 0).hidden, "pending");
});
