// The capsule under a finger (#251): its open shape stays in the band, and the lens names the right item.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESS, lensAt, pressShape } from "../src/press.ts";
import { TEMPLATE } from "../src/template.ts";

const rest = { x: 400, y: 400, w: 46, h: 104 };

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

test("lens: held to the first and last item, and names the nearest", () => {
  const pitch = PRESS.pitch, first = PRESS.pad / 2 + TEMPLATE.control / 2;
  assert.deepEqual(lensAt(-100, 3, pitch), { y: first, index: 0 });
  assert.deepEqual(lensAt(1000, 3, pitch), { y: first + 2 * pitch, index: 2 });
  assert.equal(lensAt(first + pitch * 0.6, 3, pitch).index, 1);
  assert.equal(lensAt(first + pitch * 0.4, 3, pitch).index, 0);
});

test("lens: one item has no pitch to divide by", () => {
  assert.equal(lensAt(50, 1, 0).index, 0);
});
