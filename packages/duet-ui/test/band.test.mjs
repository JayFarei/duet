// The claimable band: in every mode, every control sits between the top limit (status bar, Dynamic Island,
// Safari's own back and bookmarks rows) and the bottom limit (Safari's +/tabs pill, the home indicator),
// nothing overlaps, and whatever does not fit folds into "…", which is always reachable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnBand, detect, DUO, RAIL, SAFARI } from "../src/geometry.ts";
import { TEMPLATE, frame, template } from "../src/template.ts";

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
for (const menu of [false, true]) for (const actions of [0, 1, 4, 12]) for (const primary of [false, true]) for (const rest of [false, true])
  SPECS.push({ menu, actions, primary, rest });
const bottomOf = (r) => r.y + r.h;

for (const [name, c] of Object.entries(CONTEXTS)) {
  test(`${name}: every group inside the claimable band, overflow in "…"`, () => {
    const [top, bottom] = band(c), f = frame(c);
    for (const s of SPECS) {
      const t = template(f, s), why = `${JSON.stringify(s)} -> ${JSON.stringify(t.groups)}`;
      const rects = t.placed.map((g) => g.rect).sort((a, b) => a.y - b.y);
      // A lone group may reach closer to Safari's buttons than the band's gap, never closer than RAIL.gap.
      const slack = rects.length === 1 && f.kind === "column" ? DUO.gap - RAIL.gap : 0;
      for (const r of rects) assert.ok(r.y >= top - slack - 0.01 && bottomOf(r) <= bottom + slack + 0.01, `outside [${top}, ${bottom}]: ${why}`);
      for (let i = 1; i < rects.length; i++) assert.ok(rects[i].y >= bottomOf(rects[i - 1]) - 0.01, `overlap: ${why}`);
      const slots = t.groups.flat(), has = (k) => slots.some((x) => x.kind === k);
      assert.equal(slots.filter((x) => x.kind === "action").length, t.shown, why);
      // Whatever is not on screen is behind "…".
      if (t.shown < s.actions || (s.primary && !t.primary) || s.rest) assert.ok(has("more"), `hidden items with no "…": ${why}`);
      // One button of room keeps "…", which then lists the menu's places too.
      if (s.menu && bottom - top + 2 * slack >= TEMPLATE.control + TEMPLATE.item) assert.ok(has("menu"), `no burger: ${why}`);
      // The primary folds only when no arrangement keeps it.
      if (s.primary && !t.primary) assert.ok(bottom - top < 2 * TEMPLATE.control + DUO.gap + (s.menu ? TEMPLATE.item : 0), `primary folded needlessly: ${why}`);
    }
  });
}

// A turn can leave Safari with a short visual viewport and no keyboard (466 for a 580pt page, #122), its minimized bar
// drawn at the visual viewport's bottom and taking touches there: the band moves up clear of it, so a page dialog's
// Close is not half under Safari's bar (#140).
test("short visual viewport with no keyboard: the band ends above it, Close stays", () => {
  const c = detect(sig(382, 580, 466, 678, { visualHeight: 466, editing: false }));
  assert.equal(c.mode, "column");
  assert.equal(c.keyboard, undefined);
  assert.equal(c.visualBottom, 466);
  const full = columnBand(detect(sig(382, 580, 466, 678))), col = columnBand(c);
  assert.ok(col.bottom <= 466 - DUO.gap + 0.01, `band ends at ${col.bottom}`);
  assert.ok(Math.abs((col.bottom - col.top) - (full.bottom - full.top)) < 0.01, "band height changed");
  const [close] = template(frame(c), { close: true, actions: 0 }).placed;
  assert.ok(close, "Close dropped");
  assert.ok(close.rect.y >= col.top - 0.01 && bottomOf(close.rect) <= 466 - DUO.gap + 0.01, `Close at ${close.rect.y}`);
  // A visual viewport short by less than the band's margin to the pill (the bar collapsing mid-scroll) moves nothing.
  assert.deepEqual(columnBand(detect(sig(382, 580, 466, 678, { visualHeight: 550, editing: false }))), full);
  // The keyboard: the controls hide, the band is left alone.
  const kb = detect(sig(382, 580, 466, 678, { visualHeight: 300, editing: true }));
  assert.equal(kb.keyboard, true);
  assert.equal(kb.visualBottom, undefined);
});
