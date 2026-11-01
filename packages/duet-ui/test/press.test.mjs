// The capsule under a finger (#251): its open shape stays in the band, and the lens names the right item.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LENS, PRESS, lensAt, lensStep, pressShape, refractMap } from "../src/press.ts";
import { TEMPLATE, spring } from "../src/template.ts";

const rest = { x: 400, y: 400, w: 46, h: 104 };

test("springs: valid easings either side of critical damping", () => {
  for (const s of [PRESS.rise, PRESS.fall, spring(100, 20)]) {
    const stops = s.easing.slice(7, -1).split(",").map(Number);
    assert.ok(stops.every(Number.isFinite), s.easing);
    assert.equal(stops[0], 0); assert.ok(Math.abs(stops.at(-1) - 1) < 0.01); assert.ok(s.ms > 0);
  }
  const fall = PRESS.fall.easing.slice(7, -1).split(",").map(Number);
  assert.ok(fall.every((v, i) => !i || v >= fall[i - 1]), "fall does not overshoot");
});

test("open: wider, centred on rest, rising more than it falls", () => {
  const s = pressShape(rest, 2);
  assert.equal(s.w, PRESS.width);
  assert.equal(s.x + s.w / 2, rest.x + rest.w / 2);
  const up = rest.y - s.y, down = s.y + s.h - (rest.y + rest.h);
  assert.ok(up > down && down > 0);
});

test("open: stays in the band, plus its small overflow", () => {
  const band = { top: 390, bottom: 560 };
  const s = pressShape(rest, 3, band);
  assert.ok(s.y >= band.top - PRESS.overflow);
  assert.ok(s.y + s.h <= band.bottom + PRESS.overflow);
});

test("open: a short band gives up pitch, never below the resting height", () => {
  const s = pressShape(rest, 3, { top: 400, bottom: 504 });
  assert.ok(s.pitch < PRESS.pitch);
  assert.ok(s.h >= rest.h);
});

test("open: five items match native's 78 by 303", () => {
  assert.equal(pressShape(rest, 5).w, 78);
  assert.ok(Math.abs(pressShape(rest, 5).h - 303) < 1);
});

test("open: labels only where they clear the next icon", () => {
  assert.equal(pressShape(rest, 2).labels, true);
  assert.equal(pressShape(rest, 2, { top: 400, bottom: 480 }).labels, false);
});

test("lens: names the nearest item, and gives way a little past the ends", () => {
  const pitch = PRESS.pitch, first = PRESS.inset + LENS.centre, last = first + 2 * pitch;
  assert.deepEqual(lensAt(first, 3, pitch), { y: first, index: 0 });
  assert.equal(lensAt(first + pitch * 0.6, 3, pitch).index, 1);
  assert.equal(lensAt(first + pitch * 0.4, 3, pitch).index, 0);
  const up = lensAt(-1000, 3, pitch), down = lensAt(1000, 3, pitch);
  assert.equal(up.index, 0); assert.equal(down.index, 2);
  assert.ok(Math.abs(first - LENS.past - up.y) < 0.01); assert.ok(Math.abs(last + LENS.past - down.y) < 0.01);
  assert.ok(lensAt(last + 5, 3, pitch).y > last && lensAt(last + 5, 3, pitch).y < last + 5);
});

const run = (s, goal, frames, size = LENS.grow) => { for (let i = 0; i < frames; i++) s = lensStep(s, goal, size, 1 / 60); return s; };
const still = { y: 0, vy: 0, w: 90, vw: 0, h: 88, vh: 0, q: 0, vq: 0 };

test("lens: settles on its goal, and a long frame stays stable", () => {
  const s = run(still, { y: 100, w: 66, h: 82 }, 120);
  assert.ok(Math.abs(s.y - 100) < 0.01 && Math.abs(s.w - 66) < 0.01 && Math.abs(s.h - 82) < 0.01);
  assert.ok(Number.isFinite(lensStep(still, { y: 500, w: 90, h: 88 }, LENS.grow, 0.033).y));
});

test("lens: narrows as it speeds up, widens as it slows, and rests at no stretch", () => {
  const goal = { w: 90, h: 88 };
  let s = still, least = 0, most = 0;
  for (let i = 0; i < 40; i++) { s = lensStep(s, { y: i * 3.3, ...goal }, LENS.grow, 1 / 60); least = Math.min(least, s.q); }
  assert.ok(least < -0.03 && least >= -LENS.maxStretch);
  for (let i = 0; i < 30; i++) { s = lensStep(s, { y: 40 * 3.3, ...goal }, LENS.grow, 1 / 60); most = Math.max(most, s.q); }
  assert.ok(most > 0.03);
  assert.ok(Math.abs(run(s, { y: 40 * 3.3, ...goal }, 240).q) < 0.005);
});

test("refraction map: neutral inside the band, pointing inward at the rim", () => {
  const w = 90, h = 88, m = refractMap(w, h, LENS.radius, LENS.band), at = (x, y) => [...m.slice((x + y * w) * 4, (x + y * w) * 4 + 3)];
  assert.deepEqual(at(45, 44), [128, 128, 128]);
  assert.ok(at(1, 44)[0] > 200 && at(88, 44)[0] < 56);
  assert.ok(at(45, 1)[1] > 200 && at(45, 86)[1] < 56);
  assert.equal(at(45, 44)[3], undefined);
  assert.equal(m[(45 + 44 * w) * 4 + 3], 255);
  assert.ok(at(3, 3)[0] > 128 && at(3, 3)[1] > 128);
});

test("lens: one item has no pitch to divide by", () => {
  assert.equal(lensAt(50, 1, 0).index, 0);
});
