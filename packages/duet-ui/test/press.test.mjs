// The capsule under a finger (#251): its open shape stays in the band, and the lens names the right item.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HOP, LENS, PRESS, lensAt, lensStep, pressShape, refractMap, swellShape } from "../src/press.ts";
import { TEMPLATE, spring } from "../src/template.ts";

const rest = { x: 400, y: 400, w: 46, h: 104 };

test("springs: valid easings either side of critical damping", () => {
  for (const s of [PRESS.rise, PRESS.fall, spring(100, 20)]) {
    const stops = s.easing.slice(7, -1).split(",").map(Number);
    assert.ok(stops.every(Number.isFinite), s.easing);
    assert.equal(stops[0], 0); assert.ok(Math.abs(stops.at(-1) - 1) < 0.01); assert.ok(s.ms > 0);
  }
  const fall = PRESS.fall.easing.slice(7, -1).split(",").map(Number);
  const rise = PRESS.rise.easing.slice(7, -1).split(",").map(Number);
  assert.ok(Math.max(...rise) > 1.1, "rise overshoots by more than 10%");
  assert.ok(Math.max(...fall) > 1 && Math.max(...fall) < 1.05, "fall undershoots rest by under 5%");
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

test("open: five items match native's width and height", () => {
  assert.equal(pressShape(rest, 5).w, PRESS.width);
  assert.ok(Math.abs(pressShape(rest, 5).h - 301) < 1, "native measures 302, ours adds a 1pt rim");
});

test("swell: scales about the capsule's centre, its items spreading with it", () => {
  for (const r of [rest, { x: 400, y: 200, w: 46, h: 262 }]) {
    const s = swellShape(r);
    assert.ok(Math.abs(s.w - r.w * PRESS.swell) < 1e-9); assert.ok(Math.abs(s.h - r.h * PRESS.swell) < 1e-9);
    assert.ok(Math.abs(s.x + s.w / 2 - (r.x + r.w / 2)) < 1e-9); assert.ok(Math.abs(s.y + s.h / 2 - (r.y + r.h / 2)) < 1e-9);
    assert.ok(Math.abs(s.pitch - TEMPLATE.item * PRESS.swell) < 1e-9);
    assert.equal(s.labels, false);
    assert.ok(Math.abs(s.top - (PRESS.swell - 1) * TEMPLATE.control / 2) < 1e-9, "the first item stays centred in its scaled slot");
  }
  assert.ok(swellShape({ ...rest, h: 262 }).h - 262 > swellShape(rest).h - rest.h, "a tall capsule grows more");
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

test("hop: the lens reaches the tapped item in about the same time from one item or three", () => {
  const settle = (d) => { let s = { y: 0, vy: 0, w: HOP.end.w, vw: 0, h: HOP.end.h, vh: 0, q: 0, vq: 0 }, f = 0; while (Math.abs(s.y - d) > 2 && f < 200) { s = lensStep(s, { y: d, ...HOP.size }, HOP.grow, 1 / 60, HOP.travel); f++; } return f; };
  assert.ok(settle(147) >= 15 && settle(147) <= 30, String(settle(147)));
  assert.ok(settle(147) - settle(49) <= 8, "a spring, so a longer trip barely takes longer");
});

test("hop: no overshoot past the tapped item, and it ends bubble sized", () => {
  let s = { y: 0, vy: 0, w: HOP.end.w, vw: 0, h: HOP.end.h, vh: 0, q: 0, vq: 0 }, most = 0;
  for (let i = 0; i < 120; i++) { s = lensStep(s, { y: 100, ...HOP.end }, HOP.fall, 1 / 60, HOP.travel); most = Math.max(most, s.y); }
  assert.ok(most <= 100.5); assert.ok(Math.abs(s.w - HOP.end.w) < 0.01 && Math.abs(s.h - HOP.end.h) < 0.01);
});

test("open: a still finger keeps naming the item it pressed, for any length and window", () => {
  for (const [top, bottom, control] of [[16, 653, 49], [16, 853, 49], [16, 429, 49], [16, 555, 49], [40, 500, 49]]) {
    for (const n of [2, 3, 5, 6, 8, 9, 10, 12, 17]) {
      for (const pitch of [51.7, 48.6, 44]) {
        const h = control + (n - 1) * pitch, y = Math.max(top, bottom - h);
        if (y + h > bottom + 1) continue;
        for (let k = 0; k < n; k++) {
          const at = y + control / 2 + k * pitch, s = pressShape({ x: 300, y, w: control, h }, n, { top, bottom }, { index: k, y: at });
          assert.equal(lensAt(at - s.y, n, s.pitch).index, k, `n ${n} pitch ${pitch} item ${k} in ${top}..${bottom}`);
          assert.ok(s.h >= h - 0.01, "never below rest");
        }
      }
    }
  }
});

test("open: a press whose item is already under the finger keeps the native shape", () => {
  const r = { x: 300, y: 400, w: 49, h: 49 + 51.7 };
  const free = pressShape(r, 2), held = pressShape(r, 2, undefined, { index: 0, y: free.y + PRESS.inset + LENS.centre });
  assert.deepEqual(held, free);
});
