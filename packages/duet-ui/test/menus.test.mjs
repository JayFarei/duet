// Safari's column buttons are an exclusion zone: native chrome paints over the page, so menus keep clear of its
// back + reader rows and its +/tabs pill wherever they cross the column (RegTail #6), and leading items use the
// free middle of the column before folding into "…" (RegTail #4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnBand, detect, plan, islandBox, morphBox, DUO, MORPH, RAIL, SAFARI } from "../src/geometry.ts";

const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});
const COLUMNS = {
  "closed tab": detect(sig(382, 580, 466, 678)),
  "split left": { ...detect(sig(385, 571, 469, 669)), side: "left" },
  "split right": { ...detect(sig(385, 571, 469, 669)), side: "right" },
  "landscape left": detect(sig(594, 368, 678, 466, { angle: 90 })),
  "landscape right": detect(sig(594, 368, 678, 466, { angle: 270 })),
};
// RegTail's page: back, a credits button (leading), three actions, four tabs minimized on scroll.
const REGTAIL = { back: true, leading: 1, actions: 3, tabs: 4, searchButton: false, accessory: false, minimized: true, primary: false };

test("columnTop is the reader row's bottom plus a gap, or the rail's top where one is used, in every column state", () => {
  const c = COLUMNS["closed tab"], p = plan(c, { ...REGTAIL, minimized: false, tabs: 0 });
  assert.equal(p.columnTop, DUO.top + DUO.island + 2 * DUO.control + 2 * DUO.gap + SAFARI.forward);
  for (const [name, c] of Object.entries(COLUMNS)) {
    const p = plan(c, REGTAIL);
    assert.equal(p.columnTop, p.rail ? p.rail.top : columnBand(c).top, name);
  }
  assert.equal(plan(detect(sig(951, 543, 951, 669)), REGTAIL).columnTop, undefined);
});

for (const [name, c] of Object.entries(COLUMNS)) {
  test(`${name}: morph and island menus never reach over Safari's column buttons`, () => {
    const page = c.side === "right" ? [0, c.width] : [c.screenWidth - c.width, c.screenWidth];
    for (const spec of [REGTAIL, { ...REGTAIL, minimized: false, tabs: 2 }, { ...REGTAIL, tabs: 0, searchButton: true }]) {
      const p = plan(c, spec);
      for (const anchor of [p.more, p.tabs?.min && p.tabs].filter(Boolean)) {
        for (let n = 1; n <= 14; n++) {
          const m = morphBox(c, p, anchor, n), why = `${JSON.stringify(spec)} n=${n} -> ${JSON.stringify(m)}`;
          const overColumn = m.left < page[0] - 0.01 || m.left + m.width > page[1] + 0.01;
          if (overColumn) assert.ok(m.top >= p.columnTop - 0.01 && m.top + m.height <= p.columnBottom + 0.01, `over the column outside its band: ${why}`);
          assert.ok(m.top >= MORPH.pad - 0.01 && m.top + m.height <= c.height - MORPH.pad + 0.01, `off the page: ${why}`);
          assert.equal(m.scroll, m.height < 2 * MORPH.pad + n * MORPH.row - 0.01, `scrolls only when capped: ${why}`);
          const isl = islandBox(p, anchor, n, c.side);
          assert.ok(isl.top >= p.columnTop - 0.01, `island above columnTop: ${why}`);
          assert.ok(isl.top + isl.height <= p.columnBottom + 0.01, `island below columnBottom: ${why}`);
        }
      }
    }
  });
}

test("closed tab: a one-row menu opens upward flush with the column, top under the reader row (native)", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), m = morphBox(c, p, p.tabs, 1);
  assert.equal(m.left + m.width, p.left + DUO.control); // outer edge on the button's
  const y0 = p.tabs.top + p.tabs.height / 2 - DUO.control / 2;
  assert.ok(Math.abs(m.top + m.height - (y0 + DUO.control)) < 0.01); // grows up from the button's bottom
  assert.ok(m.top >= p.columnTop);
});

test("closed tab: a list too tall for the column band opens beside the column, over the page, and may rise", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), m = morphBox(c, p, p.tabs, 5);
  assert.ok(m.left + m.width <= c.width);
  assert.ok(m.top < p.columnTop);
  assert.equal(m.scroll, false);
  const long = morphBox(c, p, p.tabs, 20);
  assert.equal(long.scroll, true);
  assert.equal(long.height, c.height - 2 * MORPH.pad);
});

test(`closed tab, worst case (#97): one slot, so "…" and RegTail's selected tab share a rail between Safari's buttons`, () => {
  // Two Live Activities push Safari's back to 265 and forward history grows it into a 102.7pt pill: the reader
  // ends at 427.7, the +/tabs pill starts at 541.6, so the band holds one button. A two-item rail (100.7) fits
  // between the reader and the pill, RAIL.gap clear of each.
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), band = columnBand(c);
  assert.ok(Math.abs(band.bottom - band.top - 91.9) < 0.1);
  assert.ok(p.rail && p.more && p.tabs.min && !p.tabs.merged);
  assert.equal(p.more.top, p.rail.top);
  assert.ok(Math.abs(p.tabs.top + p.tabs.height - (p.rail.top + p.rail.height)) < 0.01);
  assert.ok(p.rail.top >= band.top - DUO.gap + RAIL.gap - 0.01 && p.rail.top + p.rail.height <= band.bottom + DUO.gap - RAIL.gap + 0.01);
  assert.ok(!p.back && !p.leading && !p.actions && !p.primary);
  assert.deepEqual(p.menu, { primary: false, back: true, leading: 1, actions: 3 });
  // Without tabs, the rail holds "…" and search.
  const search = plan(c, { ...REGTAIL, tabs: 0, searchButton: true });
  assert.ok(search.rail && search.more && search.searchButton && !search.menu.search);
  // Where even the rail has no room (closed landscape), the selected tab alone holds the merged menu.
  const land = plan(COLUMNS["landscape left"], REGTAIL);
  if (!land.more) assert.ok(land.tabs.merged && !land.rail);
  // With room for "…" beside the tab (the left split pane), nothing merges.
  const left = plan(COLUMNS["split left"], REGTAIL);
  assert.ok(left.more && !left.tabs.merged);
});

test("no reach where the island cannot push Safari's rows: landscape and the left split pane fold as before", () => {
  for (const name of ["landscape left", "landscape right", "split left"]) {
    const c = COLUMNS[name], p = plan(c, REGTAIL);
    for (const b of [p.leading, p.more, p.back].filter(Boolean)) assert.ok(b.top >= p.columnTop - 0.01, name);
  }
});

// #133: the closed preview without forward history keeps a Live Activities allowance, so its band (~32pt) is shorter
// than a control. plan() centres the lone button on it; the island pill stays on that button instead of being pushed
// down to columnTop, which put its bottom over the preview's Back (native Back top 428, screen points).
test("closed preview, short band: the island pill opens on its button, never onto the preview's Back", () => {
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
  const spec = { back: true, leading: 0, actions: 0, tabs: 3, primary: true, searchButton: false, accessory: false, minimized: false };
  let n = 0;
  for (let ih = 560; ih <= 660; ih++) {
    const c = detect(sig(382, ih, 466, 678, { insetBottom: 34, pixelRatio: 3, userAgent: UA, angle: 0 }));
    if (c.mode !== "column" || !c.preview) continue;
    const p = plan(c, spec), b = p.tabs, y0 = 678 - c.height;
    assert.ok(b, `382x${ih}`); n++;
    const isl = islandBox(p, b, 3, c.side), y = b.top + b.height / 2 - DUO.control / 2;
    if (p.columnBottom - p.columnTop < DUO.control) assert.equal(isl.top, y, `382x${ih} pill on its button`);
    assert.ok(y0 + isl.top + isl.height <= 428 + 0.5, `382x${ih} pill bottom ${y0 + isl.top + isl.height} over Back`);
  }
  assert.ok(n > 20);
});

// #135: a sheet hides its own X while Duet's close is on screen (<html data-duet-close>), in every mode, so the open
// screen shows one X too. With the keyboard up only strip controls stay, and the landscape closed preview hides them.
test("controls shown for data-duet-close", async () => {
  const { controlsShown } = await import("../src/geometry.ts");
  for (const mode of ["strip", "column", "inline"]) assert.equal(controlsShown({ mode }), true, mode);
  assert.equal(controlsShown({ mode: "strip", keyboard: true }), true);
  assert.equal(controlsShown({ mode: "column", keyboard: true }), false);
  assert.equal(controlsShown({ mode: "inline", keyboard: true }), false);
  assert.equal(controlsShown({ mode: "inline", hidden: "preview" }), false);
  assert.equal(controlsShown({ mode: "column", hidden: "moving" }), true);
});
