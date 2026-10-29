// The templated column (#181): burger first, actions while they fit, "…" closing the group, the primary on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../src/geometry.ts";
import { TEMPLATE, allocate, frame, groupHeight, lead, menuBox, pillRect, spring, template } from "../src/template.ts";

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

test("pillRect: the armed primary grows toward the page", () => {
  const r = { x: 400, y: 0, w: 49, h: 49 };
  assert.deepEqual(pillRect(r, "right"), { x: 400 + 49 - 214, y: 0, w: 214, h: 49 });
  assert.deepEqual(pillRect(r, "left"), { ...r, w: 214 });
});

test("lead and spring: ends fixed, linear() easing settles at 1", () => {
  for (const k of [-1, 0, 1.5, 3]) assert.deepEqual([lead(0, k), lead(1, k)], [0, 1]);
  const s = spring(240, 26);
  assert.match(s.easing, /^linear\(0,.*\)$/);
  assert.ok(Math.abs(+s.easing.slice(0, -1).split(",").at(-1) - 1) < 0.01 && s.ms > 0);
});
