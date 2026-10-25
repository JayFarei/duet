// Mode transitions and the inline side drag, from signals recorded on device and simulator.
// Run: pnpm test (node --test; Node 23.6+ strips the types from geometry.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { browserOf, detect, isDuo, isIOS, magnet, MAGNET, PIN_TTL, stable } from "../src/geometry.ts";

const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});

// Device recording 2026-10-24 23:14: full-width open Safari into a split-view pane. The lab title showed
// these signals in turn: column 385x571 alternating with a zoomed-out pane (469 wide, height wobbling).
const CLOSED = sig(382, 580, 466, 678);
const OPEN_FULL = sig(951, 543, 466, 678); // outer lags after the unfold
const PANE = sig(385, 571, 469, 669);
const PANE_ZOOMED = [696, 679, 659, 674, 681].map((h) => sig(469, h, 469, 669));

test("closed Safari tab is column", () => assert.equal(detect(CLOSED).mode, "column"));
test("open posture, full width, is inline", () => assert.equal(detect(OPEN_FULL).mode, "inline"));
test("split-view pane is column; zoomed out (no shrink-to-fit=no) it is inline", () => {
  assert.equal(detect(PANE).mode, "column");
  for (const s of PANE_ZOOMED) assert.equal(detect(s).mode, "inline");
});
test("standalone, landscape and keyboard up never take the column", () => {
  assert.equal(detect({ ...CLOSED, standalone: true }).mode, "inline");
  assert.equal(detect(sig(594, 368, 678, 466)).mode, "inline");
  assert.equal(detect({ ...CLOSED, visualHeight: 300 }).mode, "inline");
});

// Model of the feedback loop seen on device: in column mode the layer's overflow makes Safari zoom the
// viewport out to the window width, which drops the column signature; inline restores it.
function loop(window, zoomed, steps = 40, dt = 50) {
  const d = { flips: [] }, modes = [];
  let s = window;
  for (let i = 0; i < steps; i++) {
    const c = stable(d, s, "right", i * dt);
    modes.push(c.mode);
    s = c.mode === "column" ? zoomed : window;
  }
  return modes;
}
const flips = (m) => m.slice(1).filter((x, i) => x !== m[i]).length;

test("a column/inline feedback loop settles on inline within 3 flips", () => {
  const m = loop(CLOSED, sig(466, 640, 466, 678));
  assert.ok(flips(m) <= 3, `flipped ${flips(m)} times: ${m.join(" ")}`);
  assert.equal(m.at(-1), "inline");
});
test("a split pane that Safari zooms out settles on inline within 3 flips", () => {
  const m = loop(PANE, PANE_ZOOMED[0]);
  assert.ok(flips(m) <= 3, `flipped ${flips(m)} times: ${m.join(" ")}`);
  assert.equal(m.at(-1), "inline");
});
test("a pin is released when the window changes size (fold, rotate, resize pane)", () => {
  const d = { flips: [] };
  for (let i = 0; i < 6; i++) stable(d, i % 2 ? sig(466, 640, 466, 678) : CLOSED, "right", i * 50);
  assert.equal(stable(d, CLOSED, "right", 400).mode, "inline"); // pinned
  stable(d, PANE, "right", 500); // pane resized: unpinned
  assert.equal(stable(d, CLOSED, "right", 5000).mode, "column");
});
test("ordinary transitions (closed -> open -> split -> closed) are not mistaken for a loop", () => {
  const d = { flips: [] };
  const seq = [CLOSED, OPEN_FULL, PANE, CLOSED];
  assert.deepEqual(seq.map((s, i) => stable(d, s, "right", i * 3000).mode), ["column", "inline", "column", "column"]);
});

// Magnet: controls on the right edge, finger pulling left (dx < 0).
test("magnet holds the controls near their edge until the release distance", () => {
  for (const dx of [-5, -20, -40, -MAGNET.release + 1]) {
    const m = magnet("right", dx);
    assert.equal(m.free, false);
    assert.ok(m.offset <= 0 && m.offset > -MAGNET.hold, `dx ${dx} -> ${m.offset}`);
  }
  // resistance grows with the pull, never jumps
  assert.ok(magnet("right", -40).offset < magnet("right", -20).offset);
});
test("magnet does not move the controls inside its dead zone", () => {
  for (const dx of [-1, -8, -MAGNET.dead, MAGNET.dead]) assert.equal(Math.abs(magnet("right", dx).offset), 0);
});
test("magnet lets go past the release distance and then tracks the finger", () => {
  const m = magnet("right", -MAGNET.release - 30);
  assert.equal(m.free, true);
  assert.equal(m.offset, -MAGNET.release - 30);
});
test("pulling toward the own edge only rubber-bands", () => {
  const m = magnet("right", 200);
  assert.equal(m.free, false);
  assert.ok(m.offset > 0 && m.offset < MAGNET.hold);
});
test("magnet is mirrored on the left", () => {
  assert.equal(magnet("left", MAGNET.release + 10).free, true);
  assert.equal(magnet("left", MAGNET.release - 10).free, false);
  assert.ok(magnet("left", 30).offset > 0);
});

test("an iframe never takes the column (it cannot paint there)", () => {
  assert.equal(detect(CLOSED).mode, "column");
  assert.equal(detect({ ...CLOSED, framed: true }).mode, "inline");
});

// Device 2026-10-25 17:31: Safari moved from the left split-view pane straight to the right one stayed inline.
// Both panes are 469x669, so the window never changes size: the move's transient signals pinned inline for good.
test("moving a split-view pane to the other side returns to column once the pin expires", () => {
  const d = { flips: [] };
  const move = [PANE, PANE_ZOOMED[0], PANE, PANE_ZOOMED[1], PANE];
  move.forEach((s, i) => stable(d, s, "right", i * 100));
  assert.equal(stable(d, PANE, "right", 600).mode, "inline"); // pinned by the move
  assert.equal(stable(d, PANE, "right", 600 + PIN_TTL).mode, "column");
});
// Both panes are 469x669, so the window key never changes between moves: each move used to double the wait,
// and after a few the right pane stayed inline for most of a minute.
test("repeated pane moves, each well after the last pin, keep the short wait", () => {
  const d = { flips: [] };
  const move = [PANE, PANE_ZOOMED[0], PANE, PANE_ZOOMED[1], PANE];
  for (let n = 0, t0 = 0; n < 4; n++, t0 += 20000) {
    move.forEach((s, i) => stable(d, s, "right", t0 + i * 100));
    assert.equal(d.until - (t0 + 300), PIN_TTL, `move ${n + 1}`);
    assert.equal(stable(d, PANE, "right", t0 + 400 + PIN_TTL).mode, "column");
  }
});
test("a real loop re-pins with a longer wait each time, so it does not flicker every few seconds", () => {
  const d = { flips: [] };
  let t = 0, s = PANE;
  const step = () => { const c = stable(d, s, "right", t); s = c.mode === "column" ? PANE_ZOOMED[0] : PANE; t += 50; return c.mode; };
  for (let i = 0; i < 10; i++) step();
  const first = d.until - t;
  t = d.until; for (let i = 0; i < 10; i++) step();
  assert.ok(d.until - t > first * 1.5, `second wait ${d.until - t} vs first ${first}`);
  assert.equal(step(), "inline");
});

// Simulator trace 2026-10-25 (Duo Lab, Safari tab): unfold, then fold. Folding passes a frame where Safari reports
// its column as an 84pt right inset with the outer size still open; a quick unfold + fold used to count 3 flips
// and pin the closed tab to inline until the pin timed out.
const FOLD = [
  sig(466, 498, 466, 678), // unfolding, outer stale
  sig(951, 543, 466, 678, { insetBottom: 34 }),
  sig(951, 543, 951, 669, { insetBottom: 34 }),
  sig(466, 498, 951, 669, { insetRight: 84 }), // folding, outer stale
  CLOSED,
];
test("a Safari tab never takes the strip, even with a column-wide inset", () =>
  assert.equal(detect(FOLD[3]).mode, "inline"));
test("unfold then fold within the flip window lands on column, not pinned", () => {
  const d = { flips: [] };
  stable(d, CLOSED, "right", 0);
  FOLD.forEach((s, i) => stable(d, s, "right", 100 + i * 100));
  assert.equal(stable(d, CLOSED, "right", 700).mode, "column");
  assert.equal(d.pinned, undefined);
});
test("repeated folding never pins: flips across window sizes do not count", () => {
  const d = { flips: [] };
  let t = 0;
  for (let n = 0; n < 4; n++) for (const s of [CLOSED, ...FOLD]) { stable(d, s, "right", t += 50); assert.equal(d.pinned, undefined); }
  assert.equal(stable(d, CLOSED, "right", t + 50).mode, "column");
});

// Device trace 2026-10-25 19:30: windowed Safari (floating, or beside the Home Screen) and a split pane with the
// compact URL bar stayed inline: the column check wanted the closed tab's window height and at least 76pt of chrome.
test("windowed Safari and a compact split pane take the column", () => {
  for (const s of [sig(369, 591, 453, 661, { insetBottom: 34 }), sig(369, 591, 450, 670), sig(366, 600, 450, 670)])
    assert.equal(detect({ ...s, screenWidth: 466, screenHeight: 678 }).mode, "column", JSON.stringify(s));
  const pane = detect({ ...sig(385, 594, 469, 669, { insetBottom: 34 }), screenWidth: 466, screenHeight: 678 });
  assert.equal(pane.mode, "column");
  assert.equal(pane.split, true);
});
test("an 84pt-wide chrome off the Duo is not taken for Safari's column", () =>
  assert.equal(detect(sig(369, 591, 453, 661, { screenWidth: 1440, screenHeight: 900 })).mode, "inline"));

// UAs from the Duo (iOS 27.1) and desktops. Sizes say Duo, the UA says iPhone and which browser.
const UA = {
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1",
  safariDesktopSite: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
  chrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1",
  firefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15",
  edge: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 EdgiOS/141.0.3537.71 Mobile/15E148 Safari/605.1.15",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0.0",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};
const on = (s, ua, touchPoints = 5) => ({ ...s, userAgent: UA[ua], touchPoints });

test("browserOf names every iOS browser", () => {
  for (const b of ["safari", "chrome", "firefox", "edge"]) assert.equal(browserOf(UA[b]), b);
  assert.equal(browserOf(UA.safariDesktopSite), "safari");
  assert.equal(browserOf(UA.instagram), "webview");
});
test("Safari on the Duo takes the column, also asking for the desktop site", () => {
  assert.equal(detect(on(CLOSED, "safari")).mode, "column");
  assert.equal(detect(on(CLOSED, "safariDesktopSite")).mode, "column");
  assert.equal(detect(on(PANE, "safari")).mode, "column");
  assert.equal(detect(on(CLOSED, "safari")).browser, "safari");
});
test("other iOS browsers and in-app web views stay inline, still on the Duo", () => {
  for (const b of ["chrome", "firefox", "edge", "instagram"]) {
    const c = detect(on(CLOSED, b));
    assert.equal(c.mode, "inline", b);
    assert.equal(c.duo, true, b);
  }
});
test("a desktop window at a Duo size is not a Duo", () => {
  for (const s of [CLOSED, PANE, sig(951, 600, 951, 669)]) {
    assert.equal(isDuo(on(s, "macChrome", 0)), false);
    assert.equal(isDuo(on(s, "safariDesktopSite", 0)), false); // Safari on a Mac: no touch
    assert.equal(detect(on(s, "safariDesktopSite", 0)).mode, "inline");
  }
  assert.equal(isIOS(on(CLOSED, "safariDesktopSite", 5)), true);
});
test("signals without a UA (an emulator) restrict nothing", () => {
  assert.equal(isIOS(CLOSED), undefined);
  assert.equal(isDuo(CLOSED), true);
  assert.equal(detect(CLOSED).browser, "safari");
});
