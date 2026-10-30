// The templated column (#181): burger first, actions while they fit, "…" closing the group, the primary on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../src/geometry.ts";
import { TEMPLATE, allocate, frame, groupHeight, lead, menuBox, confirmBox, primaryTap, slotRect, spring, template } from "../src/template.ts";

const kinds = (groups) => groups.map((g) => g.map((s) => s.kind === "action" ? s.index : s.kind));
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});

test("allocate: every action when they fit, burger first, primary on its own", () => {
  const a = allocate(1000, 3, { menu: true, primary: true });
  assert.deepEqual(kinds(a.groups), [["menu", 0, 1, 2], ["primary"]]);
  assert.deepEqual([a.shown, a.primary], [3, true]);
});

test("allocate: fewer actions with \"…\" closing the group as the room shrinks, never taller than the room", () => {
  let last = Infinity;
  for (let h = 400; h >= TEMPLATE.control; h -= 7) {
    const a = allocate(h, 6, { menu: true });
    const height = a.groups.reduce((s, g) => s + groupHeight(g.length), 0) + (a.groups.length - 1) * TEMPLATE.gap;
    assert.ok(height <= h + 0.01, `${h}: ${JSON.stringify(kinds(a.groups))}`);
    assert.ok(a.shown <= last, "more shown in less room");
    last = a.shown;
    if (a.shown < 6) assert.ok(a.groups.flat().some((s) => s.kind === "more"), `${h}: hidden actions with no "…"`);
  }
});

test("allocate: rest keeps \"…\", inline splits the burger off, nothing to show is nothing", () => {
  assert.deepEqual(kinds(allocate(1000, 2, { rest: true }).groups), [[0, 1, "more"]]);
  assert.deepEqual(kinds(allocate(1000, 2, { menu: true, split: true }).groups), [["menu"], [0, 1]]);
  assert.deepEqual(allocate(1000, 0).groups, []);
});

test("allocate: no room for the primary's own group, it takes the burger's slot above \"…\"", () => {
  // The closed Duo's column band (92pt, a lone group 12 more): [burger, …] + [primary] needs 160.7.
  const a = allocate(92, 3, { menu: true, primary: true, extra: 12 });
  assert.deepEqual(kinds(a.groups), [["primary", "more"]]);
  assert.deepEqual([a.shown, a.primary], [0, true]);
  assert.deepEqual(kinds(allocate(92, 3, { menu: true, primary: true, split: true, extra: 12 }).groups), [["primary", "more"]]);
  // Room for its own group still wins, and one button of room folds it into "…".
  assert.deepEqual(kinds(allocate(170, 0, { menu: true, primary: true }).groups), [["menu"], ["primary"]]);
  const one = allocate(60, 3, { menu: true, primary: true });
  assert.deepEqual([kinds(one.groups), one.primary], [[["more"]], false]);
});

test("place: controls stay in the column, the primary's slot is one button in the shared capsule", () => {
  const col = frame(detect(sig(382, 580, 466, 678)));
  const t = template(col, { menu: true, actions: 3, primary: true }).placed;
  assert.deepEqual([t.length, t[0].rect.w, t[0].primary], [1, TEMPLATE.control, false]);
  assert.deepEqual(slotRect(t[0], "primary"), { ...t[0].rect, h: TEMPLATE.control });
  assert.equal(slotRect(t[0], "more").y, t[0].rect.y + TEMPLATE.item);
});

test("template: a sheet's close alone, the open sidebar's burger alone, the preview's \"…\" alone", () => {
  const tab = frame(detect(sig(382, 580, 466, 678)));
  assert.deepEqual(kinds(template(tab, { close: true, menu: true, actions: 3 }).groups), [["close"]]);
  assert.deepEqual(kinds(template(tab, { sidebar: true, menu: true, actions: 3 }).groups), [["menu"]]);
  assert.deepEqual(kinds(template({ ...tab, preview: true }, { menu: true, actions: 3, primary: true }).groups), [["more"]]);
  assert.deepEqual(template({ ...tab, preview: true }, { actions: 0 }).groups, []);
});

test("place: the column centres the stack in its band; inline puts the primary at the foot", () => {
  const col = frame(detect(sig(382, 580, 466, 678)));
  const t = template(col, { menu: true, actions: 1 }).placed;
  const top = t[0].rect.y, bottom = t.at(-1).rect.y + t.at(-1).rect.h;
  assert.ok(Math.abs(top - col.top - (col.bottom - bottom)) < 0.01, `${top - col.top} above, ${col.bottom - bottom} below`);
  const inl = frame(detect(sig(951, 543, 951, 669)));
  const p = template(inl, { menu: true, actions: 2, primary: true }).placed.find((g) => g.primary);
  assert.equal(p.rect.y, inl.bottom - TEMPLATE.control);
});

test("menuBox: beside the strip toward the page, inside the page, top or bottom aligned to \"…\"", () => {
  const f = frame(detect(sig(382, 580, 466, 678)));
  const hi = { x: f.cx - 24.5, y: 100, w: 49, h: 49 }, lo = { ...hi, y: 500 };
  const a = menuBox(f, hi, 4), b = menuBox(f, lo, 4);
  assert.equal(a.x + a.w, f.edge - 10);
  assert.equal(a.y, 100);
  assert.equal(b.y + b.h, 549);
  assert.equal(a.h, 2 * TEMPLATE.pad + TEMPLATE.head + 4 * TEMPLATE.row);
  assert.ok(menuBox(f, hi, 40).h <= f.ph - 24);
});

test("confirmBox: the primary's box beside the strip toward the page, a label row over its confirm button", () => {
  const f = frame(detect(sig(382, 580, 466, 678)));
  const r = { x: f.cx - 24.5, y: 100, w: 49, h: 49 }, b = confirmBox(f, r);
  assert.deepEqual([b.x + b.w, b.y, b.h], [f.edge - 10, 100, 2 * TEMPLATE.pad + 2 * TEMPLATE.row]);
});

test("lead and spring: ends fixed, linear() easing settles at 1", () => {
  for (const k of [-1, 0, 1.5, 3]) assert.deepEqual([lead(0, k), lead(1, k)], [0, 1]);
  const s = spring(240, 26);
  assert.match(s.easing, /^linear\(0,.*\)$/);
  assert.ok(Math.abs(+s.easing.slice(0, -1).split(",").at(-1) - 1) < 0.01 && s.ms > 0);
});

test("the primary arms on the first tap and runs on the second, capsule or folded row alike (#191)", () => {
  assert.equal(primaryTap(false, undefined), "arm");
  assert.equal(primaryTap(false, "Refresh dashboard"), "arm");
  assert.equal(primaryTap(true, "Refresh dashboard"), "run");
  assert.equal(primaryTap(false, false), "run");
});
