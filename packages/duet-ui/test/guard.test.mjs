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
  // Small, so Safari does not treat it as an edge container itself (under 0.9 of the viewport either way,
  // 388 being the shortest: the closed screen turned sideways in the in-app preview).
  assert.ok(px(g.width) <= 32 && px(g.height) < 0.9 * 388);
  // Tall enough that, laid out in the 600-tall upright preview, it still covers the midpoint of the 388-tall
  // landscape viewport WebKit samples against after a turn back upright with an overlay open (#142).
  assert.ok(300 - px(g.height) / 2 < 388 / 2 - 4 && 300 + px(g.height) / 2 > 300 + 4, `${g.height}`);
  assert.equal(g.top, "50%");
  assert.equal(px(g["margin-top"]), -px(g.height) / 2);
});

for (const side of ["left", "right"]) {
  test(`${side} guard straddles the sample point 4px in from the edge`, () => {
    const g = rule(".duet-guard");
    const off = px(rule(`.duet-guard[data-side="${side}"]`)[side]);
    // Covers [off, width + off] measured inward from the edge, with margin around 4px.
    assert.ok(off < 4 - 2 && px(g.width) + off > 4 + 2, `${off}`);
  });
}

// Not only in column mode: a turn or fold passes through transit, and a guard that unmounts there leaves Safari's column
// filled with the page's overlay once the column is back (#119, e2e mod01-04).
test("guard renders on both edges whenever the page is in Safari on a Duo, whatever the mode, outside the layer", () => {
  assert.match(chrome, /ctx\.duo && ctx\.browser === "safari" && !emulatedSignals\(\) && \(\["left", "right"\] as const\)\.map\(\(side\) => <span key=\{side\} className="duet-guard" data-side=\{side\} aria-hidden \/>\)/);
  assert.doesNotMatch(chrome, /ctx\.mode === "column" && !emulatedSignals\(\) && sides\.map/);
});
