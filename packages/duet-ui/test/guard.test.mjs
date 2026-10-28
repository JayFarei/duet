// #79: a page's full-screen fixed overlay hides the column layer, because Safari 26 hit-tests the middle of each
// viewport edge, 4px in, for a fixed box and paints that box over the column. The guard must win that hit test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");
const rule = (sel) => {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`));
  assert.ok(m, `${sel} rule`);
  return Object.fromEntries(m[1].split(";").map((d) => d.split(":").map((x) => x.trim())).filter(([k]) => k));
};
const px = (v) => Number(v.replace("px", ""));

test("guard is a fixed box above every page layer that takes no taps", () => {
  const g = rule(".duet-guard");
  // Only fixed or sticky layers are hit-tested for edge sampling.
  assert.equal(g.position, "fixed");
  assert.equal(g["z-index"], "2147483647");
  assert.equal(g["pointer-events"], "none");
  // Without a background (and no children) the box counts as transparent and the hit test retries past it.
  assert.ok(g["background-image"] || g.background, "has a background");
  // Small, so Safari does not treat it as an edge container itself (under 0.9 of the viewport either way, less
  // the sampler's 4px margins: 366 the narrowest, the closed screen upright, 388 the shortest, turned sideways in
  // the in-app preview).
  for (const side of ["left", "right"]) {
    const w = px(rule(`.duet-guard[data-side="${side}"]`).width ?? g.width);
    assert.ok(w < 0.9 * (366 - 8) && px(g.height) < 0.9 * (388 - 8), `${side} ${w}`);
  }
  // Tall enough that, laid out in the 600-tall upright preview, it still covers the midpoint of the 388-tall
  // landscape viewport WebKit samples against after a turn back upright with an overlay open (#142).
  assert.ok(300 - px(g.height) / 2 < 388 / 2 - 4 && 300 + px(g.height) / 2 > 300 + 4, `${g.height}`);
  assert.equal(g.top, "50%");
  assert.equal(px(g["margin-top"]), -px(g.height) / 2);
});

for (const side of ["left", "right"]) {
  test(`${side} guard straddles the sample point 4px in from the edge`, () => {
    const r = rule(`.duet-guard[data-side="${side}"]`), off = px(r[side]), w = px(r.width ?? rule(".duet-guard").width);
    // Covers [off, width + off] measured inward from the edge, with margin around 4px.
    assert.ok(off < 4 - 2 && w + off > 4 + 2, `${off}`);
  });
}

// Not only in column mode: a turn or fold passes through transit, and a guard that unmounts there leaves Safari's column
// filled with the page's overlay once the column is back (#119, e2e mod01-04).
test("guard renders on both edges whenever the page is in Safari on a Duo, whatever the mode, outside the layer", () => {
  assert.match(chrome, /ctx\.duo && ctx\.browser === "safari" && !emulatedSignals\(\) && \(\["left", "right"\] as const\)\.map\(\(side\) => <span key=\{side\} className="duet-guard" data-side=\{side\} aria-hidden \/>\)/);
  assert.doesNotMatch(chrome, /ctx\.mode === "column" && !emulatedSignals\(\) && sides\.map/);
});

// After a turn back upright WebKit sometimes keeps laying fixed boxes out against the 578-wide landscape window (right
// guard at x 570 in the 366-wide one) while it samples 4px in from that rect clipped to the document, 450 wide with
// the column layer: a 16px right guard missed, and the column filled with the overlay (#147, e2e mod04-06, mod05).
test("right guard covers the right sample point whether laid out in the window or the stale landscape one", () => {
  const r = rule('.duet-guard[data-side="right"]'), w = px(r.width), off = px(r.right);
  for (const [box, doc] of [[366, 450], [578, 450], [366, 366], [578, 578]]) {
    const at = Math.min(box, doc) - 4, x = box - off - w;
    assert.ok(x < at - 2 && x + w > at + 2, `box ${box}, document ${doc}: guard ${x}..${x + w}, sample ${at}`);
  }
});
