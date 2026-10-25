// Placement: every slot inside its band, nothing overlapping, overflow folds into "…".
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, plan, DUO } from "../src/geometry.ts";

const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});
const STRIP = sig(466 - 84, 657, 466, 678, { insetRight: 84, standalone: true, screenWidth: 466, screenHeight: 678 });
const COLUMN = sig(382, 580, 466, 678);
const INLINE = sig(951, 543, 951, 669);
const spec = (o = {}) => ({ back: false, leading: 0, actions: 0, tabs: 0, searchButton: false, accessory: false, minimized: false, ...o });

function boxes(p) {
  return [p.back, p.primary, p.leading, p.actions, p.more, p.tabs, p.searchButton].filter(Boolean).sort((a, b) => a.top - b.top);
}
function assertNoOverlap(p) {
  const b = boxes(p);
  for (let i = 1; i < b.length; i++) assert.ok(b[i].top >= b[i - 1].top + b[i - 1].height - 0.01, `slot ${i} overlaps the one above`);
}

test("strip mode hugs iOS's strip; column mode Safari's; inline the chosen side", () => {
  assert.equal(detect(STRIP).mode, "strip");
  assert.equal(detect(COLUMN).mode, "column");
  assert.equal(detect(INLINE, "left").side, "left");
  assert.equal(plan(detect(INLINE, "left"), spec({ back: true })).centerX, DUO.centerFromEdge);
  assert.equal(plan(detect(COLUMN), spec({ back: true })).centerX, 466 - DUO.centerFromEdge);
});

for (const [name, s] of [["strip", STRIP], ["column", COLUMN], ["inline", INLINE]]) {
  test(`${name}: the busiest page fits without overlap, extras fold into "…"`, () => {
    const p = plan(detect(s), spec({ back: true, leading: 2, actions: 5, tabs: 5, accessory: true, menuExtra: name === "inline" ? 1 : 0 }));
    assertNoOverlap(p);
    const folded = p.menu.leading + p.menu.actions + (p.menu.back ? 1 : 0);
    assert.equal((p.actions?.visible ?? 0) + (p.leading?.visible ?? 0) + (p.back ? 1 : 0) + folded, 8);
    if (folded) assert.ok(p.more, "overflow needs a … button");
  });
}

test("Safari's column cannot hold a 5-tab pill: it minimizes to the selected tab", () => {
  assert.equal(plan(detect(COLUMN), spec({ tabs: 5 })).tabs.min, true);
  assert.equal(plan(detect(STRIP), spec({ tabs: 5 })).tabs.min, false);
});

test("minimizeOnScroll shrinks the pill to one button", () => {
  assert.equal(plan(detect(STRIP), spec({ tabs: 4, minimized: true })).tabs.height, DUO.control);
});

test("in-app Safari preview: inline, left by default, never the iPhone SE's 2x window", () => {
  const PREVIEW = sig(375, 521, 375, 667, { pixelRatio: 3 });
  const c = detect(PREVIEW);
  assert.equal(c.mode, "inline");
  assert.equal(c.preview, true);
  assert.equal(c.side, "left");
  assert.equal(detect(PREVIEW, "right").side, "right");
  const se = detect(sig(375, 548, 375, 667, { pixelRatio: 2 }));
  assert.equal(se.preview, undefined);
  assert.equal(se.side, "right");
});

test("primary: by the thumb above the tabs where one pane shows, under back where two do", () => {
  for (const s of [STRIP, COLUMN]) {
    const p = plan(detect(s), spec({ back: true, actions: 3, tabs: 4, primary: true }));
    assertNoOverlap(p);
    assert.ok(p.primary.top + p.primary.height <= p.tabs.top && p.tabs.top - p.primary.top - p.primary.height <= DUO.gap + 0.01, "sits right above the tabs");
  }
  const wide = plan(detect(INLINE), spec({ back: true, actions: 2, tabs: 4, primary: true }));
  assertNoOverlap(wide);
  assert.equal(wide.primary.top, wide.back.top + DUO.control + DUO.gap);
});
test("destructive items count towards the … menu, so it shows even when everything else fits", () => {
  const p = plan(detect(INLINE), spec({ actions: 1, menuExtra: 1 }));
  assert.ok(p.more);
});
