// The claimable band: in every mode, every control sits between the top limit (status bar, Dynamic Island,
// Safari's own back and bookmarks rows) and the bottom limit (Safari's +/tabs pill, the home indicator),
// nothing overlaps, and whatever does not fit folds into "…", which is always reachable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnBand, detect, plan, DUO, RAIL, SAFARI } from "../src/geometry.ts";

const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});
const CONTEXTS = {
  strip: detect(sig(382, 657, 466, 678, { insetRight: 84, standalone: true, screenWidth: 466, screenHeight: 678 })),
  "column, closed tab": detect(sig(382, 580, 466, 678)),
  "column, split left": { ...detect(sig(385, 571, 469, 669)), side: "left" },
  "column, split right": { ...detect(sig(385, 571, 469, 669)), side: "right" },
  "inline, unfolded": detect(sig(951, 543, 951, 669)),
  "column, landscape left": detect(sig(594, 368, 678, 466, { angle: 90 })),
  "column, landscape right": detect(sig(594, 368, 678, 466, { angle: 270 })),
  "inline, landscape": detect(sig(594, 368, 678, 466)),
};
// Safari's rows above, its pill below (simulator measurements, see plan.test.mjs); the strip and inline
// bands are the viewport less the island and home indicator.
function band(c) {
  if (c.mode === "column" && !c.split && c.screenWidth > c.screenHeight) return [
    SAFARI.landscape[c.side].top + (SAFARI.rows * (DUO.control + DUO.gap) + SAFARI.forward), SAFARI.landscape[c.side].pill - DUO.gap];
  if (c.mode === "column") return [
    c.split ? SAFARI.splitTop[c.side] + (SAFARI.rows * (DUO.control + DUO.gap) + SAFARI.forward) : DUO.top + DUO.island + (SAFARI.rows * (DUO.control + DUO.gap) + SAFARI.forward),
    c.screenHeight - DUO.bottom - SAFARI.pill - DUO.gap];
  if (c.mode === "strip") return [DUO.top + DUO.island - c.offsetTop, c.height - DUO.bottom];
  return [c.insetTop + DUO.gap, c.height - Math.max(c.insetBottom, DUO.gap)];
}
const SPECS = [];
for (const back of [false, true]) for (const leading of [0, 3]) for (const actions of [0, 1, 4, 12]) for (const tabs of [0, 3, 9])
  for (const primary of [false, true]) SPECS.push({ back, leading, actions, tabs, primary, searchButton: !tabs, accessory: false, minimized: false });

for (const [name, c] of Object.entries(CONTEXTS)) {
  test(`${name}: every control inside the claimable band, overflow in "…"`, () => {
    const [top, bottom] = band(c);
    for (const s of SPECS) {
      const p = plan(c, s), why = `${JSON.stringify(s)} -> ${JSON.stringify(p)}`;
      const boxes = [p.back, p.primary, p.leading, p.actions, p.more, p.tabs, p.searchButton].filter(Boolean).sort((a, b) => a.top - b.top);
      // Leading items and the primary action may rise into the island's reach (the free middle of Safari's column
      // with a bare island); everything else, "…" included, stays under Safari's reader row.
      const reach = columnBand(c)?.reach ?? 0;
      // A rail may reach closer to Safari's buttons than the band's gap, never closer than RAIL.gap.
      const slack = p.rail ? DUO.gap - RAIL.gap : 0;
      for (const b of boxes) {
        const lo = b === p.leading || b === p.primary ? top - reach : top - slack;
        assert.ok(b.top >= lo - 0.01 && b.top + b.height <= bottom + slack + 0.01, `outside [${lo}, ${bottom}]: ${why}`);
      }
      if (p.rail) assert.ok(p.more && (p.tabs || p.searchButton) && p.more.top === p.rail.top, `rail without its slots: ${why}`);
      for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].top >= boxes[i - 1].top + boxes[i - 1].height - 0.01, `overlap: ${why}`);
      const shown = (p.back ? 1 : 0) + (p.leading?.visible ?? 0) + (p.actions?.visible ?? 0);
      const folded = (p.menu.primary ? 1 : 0) + (p.menu.back ? 1 : 0) + p.menu.leading + p.menu.actions;
      assert.equal(shown + (p.primary ? 1 : 0) + folded, (s.primary ? 1 : 0) + (s.back ? 1 : 0) + s.leading + s.actions, `lost items: ${why}`);
      // Folded items sit behind "…", or behind the selected tab where the band holds that one button.
      if (folded) assert.ok(p.more || p.tabs?.merged, `folded items with no "…": ${why}`);
      // The primary action folds only when "…" is needed and there is no room for both.
      if (p.menu.primary) assert.ok(folded + (p.menu.search || p.tabs?.merged || p.rail ? 1 : 0) > 1 && bottom - top < 3 * DUO.control + 2 * DUO.gap, `primary folded needlessly: ${why}`);
    }
  });
}
