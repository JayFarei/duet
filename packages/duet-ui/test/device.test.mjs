// Real Duo signals the simulator never produces (#132): replayed through stable() frame by frame, each frame both while
// the window settles and after. Real Duo, iOS 27, Safari tab on the closed screen, getduet.dev /scroll and /probe,
// 2026-10-28 (screen recordings and the probe log). Safari's bottom bar collapses to 59pt while the page scrolls
// (382x619 in 466x678; the simulator's compact bar is 80), and the keyboard shrinks the layout viewport with the visual
// one (382x411, visual 411; the simulator shrinks only the visual viewport). Both fell outside the simulator's ranges,
// so the controls went inline the moment the scroll settled, off Safari's column for good.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, inTransit, isPreview, stable } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const tab = (ih, o = {}) => ({
  innerWidth: 382, innerHeight: ih, outerWidth: 466, outerHeight: 678, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0,
  insetRight: 0, standalone: false, pixelRatio: 3, touchPoints: 5, userAgent: UA, screenWidth: 466, screenHeight: 678, angle: 0, editing: false, ...o,
});

// Load, then the bar collapsing as the page scrolls down, as the probe logged it.
const SCROLL_DOWN = [549, 580, 590, 608, 617, 618, 619];
// Scrolling fast up and down: the bar grows and collapses mid-gesture, any height in between.
const FAST = [619, 600, 580, 598, 619, 619, 585, 580, 612, 619, 580, 619];

test("the collapsed bar (59pt) is Safari's column, not a preview, not in transit", () => {
  const s = tab(619), c = detect(s);
  assert.deepEqual([c.mode, c.side, c.offsetTop], ["column", "right", 0]);
  assert.equal(isPreview(s), false);
  assert.equal(inTransit(s), false);
});

for (const settle of [true, false]) test(`fast scroll up and down, ${settle ? "settling" : "settled"}: every frame on the rail`, () => {
  const d = { flips: [] };
  let t = 0;
  for (const ih of [...SCROLL_DOWN, ...FAST, ...FAST]) {
    const c = stable(d, tab(ih), undefined, t += 40, settle);
    assert.equal(c.mode, "column", `382x${ih} at ${t}ms`);
    assert.equal(c.height, ih);
    assert.equal(c.keyboard, undefined);
  }
});

test("the keyboard shrinks the layout viewport: column with the keyboard up, back on the rail when it goes down", () => {
  const d = { flips: [] };
  let t = 0;
  const frames = [
    // Scroll, tap the field (the keyboard comes up), type, scroll with it up, dismiss, scroll again; twice.
    [tab(580), false], [tab(619), false],
    [tab(619, { editing: true }), false], [tab(411, { editing: true }), true], [tab(411, { editing: true }), true],
    [tab(411, { editing: false }), true], // focus left first, the viewport grows back a moment later (KEYBOARD_DOWN)
    [tab(580), false], [tab(619), false], [tab(590), false],
    [tab(590, { editing: true }), false], [tab(411, { editing: true }), true],
    [tab(411, { editing: false }), true], [tab(619), false],
  ];
  for (const settle of [true, false]) for (const [s, kb] of frames) {
    const c = stable(d, s, undefined, t += 120, settle);
    const at = `382x${s.innerHeight} editing ${s.editing} ${settle ? "settling" : "settled"}`;
    assert.equal(c.mode, "column", at);
    assert.equal(c.hidden, undefined, at);
    assert.equal(!!c.keyboard, kb, at);
  }
});

test("the shrunk page is a keyboard only with a field focused: otherwise a stale layout (in transit, no column)", () => {
  const s = tab(411);
  assert.equal(inTransit(s), true);
  assert.notEqual(detect(s).mode, "column");
  assert.equal(inTransit({ ...s, editing: true }), false);
  assert.deepEqual([detect({ ...s, editing: true }).mode, detect({ ...s, editing: true }).keyboard], ["column", true]);
});
