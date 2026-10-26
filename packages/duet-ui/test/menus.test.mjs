// Safari's column buttons are an exclusion zone: native chrome paints over the page, so menus keep clear of its
// back + reader rows and its +/tabs pill wherever they cross the column (RegTail #6), and leading items use the
// free middle of the column before folding into "…" (RegTail #4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnBand, detect, plan, islandBox, morphBox, DUO, MORPH } from "../src/geometry.ts";

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

test("columnTop is the reader row's bottom plus a gap, in every column state", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL);
  assert.equal(p.columnTop, DUO.top + DUO.island + 2 * DUO.control + 2 * DUO.gap);
  for (const [name, c] of Object.entries(COLUMNS)) assert.equal(plan(c, REGTAIL).columnTop, columnBand(c).top, name);
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
        }
      }
    }
  });
}

test("closed tab: a short tab menu opens upward flush with the column, top under the reader row (native)", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), m = morphBox(c, p, p.tabs, 3);
  assert.equal(m.left + m.width, p.left + DUO.control); // outer edge on the button's
  assert.ok(Math.abs(m.top + m.height - (p.tabs.top + DUO.control)) < 0.01); // grows up from the button's bottom
  assert.ok(m.top >= p.columnTop);
});

test("closed tab: a list too tall for the column band opens beside the column, over the page, and may rise", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), m = morphBox(c, p, p.more, 5);
  assert.ok(m.left + m.width <= c.width);
  assert.ok(m.top < p.columnTop);
  assert.equal(m.scroll, false);
  const long = morphBox(c, p, p.more, 20);
  assert.equal(long.scroll, true);
  assert.equal(long.height, c.height - 2 * MORPH.pad);
});

test("closed tab: RegTail's credits button uses the free middle instead of folding into …", () => {
  const c = COLUMNS["closed tab"], p = plan(c, REGTAIL), band = columnBand(c);
  assert.equal(p.leading?.visible, 1);
  assert.equal(p.menu.leading, 0);
  assert.equal(p.menu.back, true); // back still folds: it never rises over Safari's own
  assert.ok(p.leading.top >= band.top - band.reach);
  assert.ok(p.more.top >= band.top, "… stays under the reader row");
  // Packed down onto the tabs: leading, …, tabs one step apart.
  assert.ok(Math.abs(p.more.top - (p.leading.top + DUO.control + DUO.gap)) < 0.01);
  assert.ok(Math.abs(p.tabs.top - (p.more.top + DUO.control + DUO.gap)) < 0.01);
});

test("no reach where the island cannot push Safari's rows: landscape and the left split pane fold as before", () => {
  for (const name of ["landscape left", "landscape right", "split left"]) {
    const c = COLUMNS[name], p = plan(c, REGTAIL);
    for (const b of [p.leading, p.more, p.back].filter(Boolean)) assert.ok(b.top >= p.columnTop - 0.01, name);
  }
});
