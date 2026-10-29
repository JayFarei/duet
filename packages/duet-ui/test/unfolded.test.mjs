// Unfolded geometry against Safari's own buttons, as the e2e harness measured them (tools/e2e, Duo Lab simulator,
// iOS 18.7 Safari, 2026-10-27): window signals from the page, native frames from the simulator helper's accessibility
// tree, both in window points (the pane in split view). Every control of every spec must stay clear of every native
// button, and inside the window.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, plan, previewReason, DUO } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const sig = (o) => ({
  insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3, touchPoints: 5, userAgent: UA,
  visualHeight: o.innerHeight, ...o,
});
const b = (label, x, y, w = 48, h = 48) => ({ label, x, y, w, h });

// Page origin in window points: a split pane's page sits beside Safari's column (left pane: column on the left, the
// document scrolled one column across; right pane: page at 0); the full-width window has Safari's bars above the page.
const STATES = [
  {
    name: "split view, left pane (Safari column on the left)",
    s: sig({ innerWidth: 385, innerHeight: 571, outerWidth: 469, outerHeight: 669, screenWidth: 466, screenHeight: 678, angle: 270 }),
    side: "left", origin: [84, 0],
    native: [b("Back", 24, 24), b("Show Bookmarks", 24, 84), b("New tab", 24, 533), b("Tabs", 24, 587), b("Page Menu", 108, 587)],
  },
  {
    name: "split view, right pane (Safari column on the right)",
    s: sig({ innerWidth: 385, innerHeight: 571, outerWidth: 469, outerHeight: 669, screenWidth: 466, screenHeight: 678, angle: 270 }),
    side: "right", origin: [0, 0],
    native: [b("Back", 397, 124), b("Show Bookmarks", 397, 184), b("New tab", 397, 533)],
  },
  {
    name: "full width, inline right (Safari's bars above the page)",
    s: sig({ innerWidth: 951, innerHeight: 543, outerWidth: 951, outerHeight: 669, screenWidth: 678, screenHeight: 466, angle: 270 }),
    side: "right", origin: [0, 126],
    native: [b("Back", 16, 26, 44, 44), b("Bookmarks", 72, 26, 44, 44), b("Address", 295.3, 26, 360, 44), b("New tab", 719, 26, 44, 44),
      b("Tabs", 763, 26, 44, 44), b("Close", 833, 82, 32, 32)],
  },
  // The in-app preview's sheet on the open screen (e2e pvu-wide, pvu-tall): a window centred on the screen, native
  // frames in screen points, the page under the sheet's top bar, its bottom bar below the page.
  {
    name: "preview sheet, wide posture (653x661 centred on 951x669)",
    s: sig({ innerWidth: 653, innerHeight: 515, outerWidth: 653, outerHeight: 661, screenWidth: 951, screenHeight: 669, angle: 270 }),
    side: "right", origin: [149, 78], bounds: [951, 669],
    native: [b("Close", 165, 24, 44, 44), b("Address", 439, 34, 73, 20), b("Page Menu", 742, 24, 44, 44), b("Back", 177, 593),
      b("Share", 615, 593, 49, 48), b("Reload", 670, 593), b("Open in Safari", 724, 593, 50, 48)],
  },
  {
    name: "preview sheet, tall posture (653x869 centred on 669x951)",
    s: sig({ innerWidth: 653, innerHeight: 710, outerWidth: 653, outerHeight: 869, screenWidth: 669, screenHeight: 951, angle: 180 }),
    side: "right", origin: [8, 165], bounds: [669, 951],
    native: [b("Close", 24, 111, 44, 44), b("Address", 298, 121, 73, 20), b("Page Menu", 601, 111, 44, 44), b("Back", 36, 875),
      b("Share", 474, 875, 49, 48), b("Reload", 529, 875), b("Open in Safari", 583, 875, 50, 48)],
  },
  // The in-app preview filling the open screen, default and full screen styles (e2e matrix 2026-10-27, j26 to j36):
  // page at window y 75. Wide: every button in the top bar, the status column (clock, island, Live Activities at their
  // worst: the closed strip's DUO.top + DUO.island) in the right inset, so the controls take the strip below it.
  {
    name: "preview wide (951x669, status column on the right)", mode: "strip",
    s: sig({ innerWidth: 951, innerHeight: 594, outerWidth: 951, outerHeight: 669, screenWidth: 678, screenHeight: 466, angle: 270, insetBottom: 34, insetRight: 84 }),
    side: "right", origin: [0, 75],
    native: [b("Close", 16, 24, 44, 44), b("Back", 66, 24, 44, 44), b("Page Menu", 116, 24, 44, 44), b("Address", 439, 34, 73, 20),
      b("Status column", 867, 0, 84, DUO.top + DUO.island)],
  },
  // Tall, turned right (page angle 180): the top bar floats over the page's first 54pt, its Page Menu at the controls' edge.
  {
    name: "preview tall, turned right (top bar over the page)",
    s: sig({ innerWidth: 669, innerHeight: 800, outerWidth: 669, outerHeight: 951, screenWidth: 466, screenHeight: 678, angle: 180, insetTop: 7 }),
    side: "right", origin: [0, 75],
    native: [b("Close", 16, 85, 44, 44), b("Address", 298, 95, 73, 20), b("Page Menu", 609, 85, 44, 44), b("Back", 28, 875),
      b("Share", 482, 875, 49, 48), b("Reload", 537, 875), b("Open in Safari", 591, 875, 50, 48), b("Island", 560, 0, 109, 68 + DUO.island)],
  },
  // Tall, turned left (page angle 0): the top bar above the page, the island in its row.
  {
    name: "preview tall, turned left (top bar above the page)",
    s: sig({ innerWidth: 669, innerHeight: 800, outerWidth: 669, outerHeight: 951, screenWidth: 466, screenHeight: 678, angle: 0, insetTop: 7 }),
    side: "right", origin: [0, 75],
    native: [b("Close", 16, 24, 44, 44), b("Address", 234, 34, 73, 20), b("Page Menu", 481, 24, 44, 44), b("Back", 28, 875),
      b("Share", 482, 875, 49, 48), b("Reload", 537, 875), b("Open in Safari", 591, 875, 50, 48), b("Island", 560, 0, 109, 68 + DUO.island)],
  },
];

const SPECS = [];
for (const back of [false, true]) for (const leading of [0, 3]) for (const actions of [0, 1, 4, 12]) for (const tabs of [0, 3, 9])
  for (const primary of [false, true]) SPECS.push({ back, leading, actions, tabs, primary, searchButton: !tabs, accessory: false, minimized: false, menuExtra: 0 });

const boxes = (pl) => ["back", "leading", "actions", "more", "primary", "tabs", "searchButton"]
  .filter((k) => pl[k]).map((k) => ({ slot: k, x: pl.left, y: pl[k].top, w: DUO.control, h: pl[k].height }));
const hit = (a, n) => a.x < n.x + n.w && a.x + a.w > n.x && a.y < n.y + n.h && a.y + a.h > n.y;

for (const st of STATES) {
  test(`unfolded, ${st.name}: clear of every native button, inside the window`, () => {
    const c = { ...detect(st.s), side: st.side };
    assert.equal(c.mode, st.mode ?? (st.s.innerWidth > 600 ? "inline" : "column"));
    if (c.mode === "column") assert.equal(c.split, true);
    for (const spec of SPECS) {
      const pl = plan(c, spec);
      for (const r of boxes(pl)) {
        const w = { ...r, x: r.x + st.origin[0], y: r.y + st.origin[1] };
        const [W, H] = st.bounds ?? [st.s.outerWidth, st.s.outerHeight];
        assert.ok(w.x >= 0 && w.x + w.w <= W && w.y >= 0 && w.y + w.h <= H, `${r.slot} at ${w.x},${w.y} outside the ${W}x${H} window (${JSON.stringify(spec)})`);
        for (const n of st.native) assert.ok(!hit(w, n), `${r.slot} at ${w.x},${w.y} ${w.w}x${w.h} over ${n.label} (${JSON.stringify(spec)})`);
      }
    }
  });
}

test("unfolded preview: told from a Safari tab by chrome and inset alone", () => {
  const wide = { innerWidth: 951, innerHeight: 594, outerWidth: 951, outerHeight: 669, screenWidth: 678, screenHeight: 466, angle: 270, insetBottom: 34, insetRight: 84 };
  const tall = { innerWidth: 669, innerHeight: 800, outerWidth: 669, outerHeight: 951, screenWidth: 466, screenHeight: 678, angle: 180, insetTop: 7 };
  assert.match(previewReason(sig(wide)), /unfolded wide/);
  assert.match(previewReason(sig(tall)), /unfolded tall/);
  assert.equal(detect(sig(tall)).preview, true);
  // A tab unfolded: 126pt of bars, inset 34, in both postures; the wide tab with bars at the top keeps 126 too.
  assert.equal(previewReason(sig({ ...wide, innerHeight: 543, insetRight: 0 })), undefined);
  assert.equal(previewReason(sig({ ...tall, innerHeight: 825, insetBottom: 34, insetTop: 0 })), undefined);
});
