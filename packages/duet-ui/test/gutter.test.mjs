// No dead gutter on the Duo's Home Screen in landscape (Gabriele, 2026-11-22): with the translucent status bar
// (duoStatusBar) the page has the whole window, the status column is its safe-area inset, and the controls dock in
// that inset (strip). Over every such window: the column inside the rail, the rail at least the column's width, the
// content's edge (the page inset on the controls' side) meeting it within RAIL.gutter. The "black" reading is kept as
// the bug it was: an 867 page in the 951 window, inline, 84 reserved inside an 84pt band iOS already took.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { DUO, INLINE_WIDTH, RAIL, detect, pageInsets } from "../src/geometry.ts";
import { frame, TEMPLATE } from "../src/template.ts";
import { WINDOWS, opts, sig } from "./arb.mjs";

const px = (v) => Number.parseFloat(v);
const insets = (c, s) => pageInsets({ mode: c.mode, side: c.side, split: !!c.split, screenWidth: c.screenWidth, width: c.width, hiddenPreview: false, inner: true, emulated: false, reserve: true, env: (side) => `${side === "left" ? s.insetLeft : s.insetRight}px` });
const landscape = fc.oneof(WINDOWS["home wide"], WINDOWS["home closed turned"]);

test("RAIL.gutter is the gap between two groups", () => assert.equal(RAIL.gutter, DUO.gap));

test("translucent Home Screen landscape: the column docks in the page's rail, the content meets it", () => {
  let shown = 0;
  fc.assert(fc.property(landscape, fc.constantFrom(undefined, "left", "right"), (s, side) => {
    const c = detect(s, side);
    if (c.hidden) return true;
    shown++;
    assert.equal(c.mode, "strip", JSON.stringify(s));
    const o = insets(c, s), rail = px(c.side === "right" ? o.right : o.left), W = s.innerWidth;
    const f = frame(c), half = TEMPLATE.control / 2;
    // A rail at least the column's width, the column inside it.
    assert.ok(rail >= TEMPLATE.control, `rail ${rail}`);
    const [lo, hi] = c.side === "right" ? [W - rail, W] : [0, rail];
    assert.ok(f.cx - half >= lo - 0.5 && f.cx + half <= hi + 0.5, `column ${f.cx - half}..${f.cx + half} outside ${lo}..${hi}`);
    // Content padded by exactly the rail ends at it: gap 0, within the rail gutter.
    const edge = c.side === "right" ? W - rail : rail;
    assert.ok(Math.abs((c.side === "right" ? lo : hi) - edge) <= RAIL.gutter);
    // No band: the page is the window.
    assert.ok(s.outerWidth - W <= 1);
  }), opts());
  assert.ok(shown > 50, `${shown} shown`);
});

test("the bug kept: a black status bar, open wide, leaves 168pt of dead room", () => {
  const s = sig(867, 669, 951, 669, { standalone: true });
  const c = detect(s);
  assert.equal(c.mode, "inline");
  const band = s.outerWidth - s.innerWidth, reserve = INLINE_WIDTH;
  assert.equal(band + reserve, 168);
  assert.ok(band > RAIL.gutter);
});
