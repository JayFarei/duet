// The capsule under a finger (#251): its open shape stays in the band, and the lens names the right item.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOP, LENS, PRESS, lensAt, lensStep, pressShape, refractMap, swellShape } from "../src/press.ts";
import { TEMPLATE, frame, landingRoom, placeTabs, spring, template } from "../src/template.ts";
import { columnBand, detect } from "../src/geometry.ts";

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

// The overflow rule (placeTabs) must leave a layout where every place fits as it was, press lens included: a drag from
// the first tab to the last names the last. Windows measured on the Duo simulator (iOS 27.1).
test("lens: a drag from the first tab to the last names the last, where every place fits at the normal pitch", () => {
  const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
  const sig = (iw, ih, ow, oh, o = {}) => ({ innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, screenWidth: 466, screenHeight: 678, userAgent: ua, touchPoints: 5, pixelRatio: 3, standalone: false, ...o });
  const windows = { "tall Safari": sig(669, 871, 669, 951), "tall Home Screen": sig(669, 869, 669, 951, { standalone: true, insetBottom: 34 }), "wide Safari": sig(951, 543, 951, 669), "wide Home Screen": sig(951, 648, 951, 669, { standalone: true, insetRight: 84 }), "Split left": sig(385, 571, 469, 669) };
  let checked = 0;
  for (const [name, s] of Object.entries(windows)) {
    const c = detect(s), f = frame(c), band = c.mode === "column" ? columnBand(c) : undefined;
    for (const [actions, primary] of [[0, false], [2, true]]) for (let n = 2; n <= 20; n++) {
      const tabs = placeTabs(c, n, actions > 0 || primary);
      if (tabs?.shown !== n || tabs.pitch !== TEMPLATE.item) continue;
      const g = template(f, { room: landingRoom(c), places: n, actions, primary, tabPitch: tabs.pitch }).placed.find((p) => p.group[0].kind === "place");
      const at = (k) => g.rect.y + TEMPLATE.control / 2 + k * g.pitch, shape = pressShape(g.rect, g.group.length, band);
      assert.equal(lensAt(at(n - 1) - shape.y, g.group.length, shape.pitch).index, n - 1, `${name} ${n}${primary ? " with actions and a primary" : ""} last`);
      checked++;
    }
  }
  assert.ok(checked > 30, "covers the long capsules, 12 places with actions and a primary in tall Safari among them");
  // and the press opens exactly this shape, from the rest, the count and the band alone
  const src = readFileSync(new URL("../src/press.ts", import.meta.url), "utf8");
  assert.match(src, /shape: pressShape\(rest, n, band\(h\.nav\)\)/);
});
