// Scroll and keyboard signals around the measured values, with jitter: Safari's bar (real Duo collapsed 59, simulator
// 80, fresh 98, largest type 106, anything 50 to 110), the Shared with You banner, the keyboard (simulator: the visual
// viewport only; real Duo: the layout viewport too, 382x411 in 466x678), the visual viewport a fraction off the page,
// and the top inset. None of them moves the window, so a Safari tab in the column stays in the column (#132).
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { stable } from "../src/geometry.ts";
import { drive, expected, landed, runs } from "./arb-posture.mjs";

const COLUMN = ["P", "L90", "L270", "S"];
const frameArb = fc.record({
  chrome: fc.oneof(fc.constantFrom(59, 80, 98, 106), fc.integer({ min: 50, max: 110 })), banner: fc.boolean(),
  kb: fc.constantFrom("none", "sim", "real"), kbShrink: fc.oneof(fc.constant(267), fc.integer({ min: 155, max: 290 })),
  jitter: fc.constantFrom(0, 0.5, 1), insetTop: fc.constantFrom(0, 20, 24, 47, 54, 59), blur: fc.boolean(),
  gap: fc.integer({ min: 1, max: 40 }), settling: fc.boolean(),
});
const traceArb = fc.record({ p: fc.constantFrom(...COLUMN), frames: fc.array(frameArb, { minLength: 1, maxLength: 12 }) });

/** The frames: landed first, then each drift for `gap` x10ms. The real keyboard only upright (measured there); focus
 *  leaves ~40ms before the viewport grows (blur). */
function frames({ p, frames: fs }) {
  const out = [{ t: 0, s: landed(p), settling: false }];
  let t = 600, prev;
  for (const f of fs) {
    const dr = { chrome: f.chrome, banner: f.banner ? 40 : 0, kb: f.kb === "real" && p !== "P" ? "sim" : f.kb, kbShrink: f.kbShrink, insetTop: f.insetTop };
    if (f.blur && prev && prev.kb !== "none" && dr.kb === "none") { out.push({ t, s: { ...landed(p, prev), editing: false }, settling: f.settling }); t += 40; }
    let s = landed(p, dr);
    if (dr.kb === "none") s = { ...s, visualHeight: s.innerHeight - f.jitter };
    out.push({ t, s, settling: f.settling });
    t += 10 * f.gap; prev = dr;
  }
  return out;
}
const show = (r) => `${r.t}ms ${r.s.innerWidth}x${r.s.innerHeight} (visual ${r.s.visualHeight}${r.s.editing ? ", editing" : ""}) in ${r.s.outerWidth}x${r.s.outerHeight} a${r.s.angle} top ${r.s.insetTop}${r.settling ? " settling" : ""}: ${r.c.hidden ? `hidden ${r.c.hidden}` : `${r.c.mode} ${r.c.side}`}`;
/** The column band: every read in the column, on the posture's side, shown. */
function inColumn(p, reads) {
  const want = expected(p);
  for (const r of reads) if (r.c.hidden || `${r.c.mode} ${r.c.side}` !== want) return `${show(r)}, expected ${want}`;
}

test("scroll and keyboard signals never take a Safari tab out of the column (chrome.tsx's reads)", () => fc.assert(fc.property(traceArb, (tr) => {
  const tl = frames(tr).map((e) => ({ ...e, epoch: 0, posture: tr.p }));
  const err = inColumn(tr.p, drive(tl).reads);
  if (err) throw new Error(err);
}), runs(400)));

test("scroll and keyboard signals never take a Safari tab out of the column, settling or not", () => fc.assert(fc.property(traceArb, (tr) => {
  const d = { flips: [] }, reads = frames(tr).map((e) => ({ ...e, c: stable(d, e.s, undefined, e.t, e.settling) }));
  const err = inColumn(tr.p, reads);
  if (err) throw new Error(err);
}), runs(400)));

// A real Duo's bar and keyboard read outside every range measured on the simulator (#132): any bar up to the largest
// with a banner, once the tab landed in the column, keeps it there (column to inline is held; the window never
// changed). Taller is a stale layout handed a new window (inTransit), hidden by design.
test("a bar outside every measured range does not take a landed tab out of the column", () => fc.assert(fc.property(traceArb, fc.array(fc.integer({ min: 0, max: 150 }), { minLength: 12, maxLength: 12 }), (tr, bars) => {
  const t = { ...tr, frames: tr.frames.map((f, i) => ({ ...f, chrome: bars[i], banner: false })) };
  const err = inColumn(tr.p, drive(frames(t).map((e) => ({ ...e, epoch: 0, posture: tr.p }))).reads);
  if (err) throw new Error(err);
}), runs(300)));

// Pinned counterexamples, each found with its fix reverted (0b89ebb, #132).
const f = (o) => ({ chrome: 50, banner: false, kb: "none", kbShrink: 155, jitter: 0, insetTop: 0, blur: false, gap: 1, settling: false, ...o });
const replay = (p, fs, read = "drive") => {
  const tl = frames({ p, frames: fs }), d = { flips: [] };
  const reads = read === "drive" ? drive(tl.map((e) => ({ ...e, epoch: 0, posture: p }))).reads : tl.map((e) => ({ ...e, c: stable(d, e.s, undefined, e.t, e.settling) }));
  assert.equal(inColumn(p, reads), undefined);
};
test("pin: the real Duo's collapsed bar, 382x619 in 466x678, read settled (inline right before #132)", () => replay("P", [f({ chrome: 59 })], "direct"));
test("pin: the bar at the column range's floor, 382x628 (inline right before #132)", () => replay("P", [f({})]));
test("pin: the real keyboard, 382x411 in 466x678, then the bar alone (hidden moving without keyboardResized)", () =>
  replay("P", [f({ kb: "real", kbShrink: 267 }), f({ chrome: 59, kbShrink: 267 })]));
test("pin: focus leaves the real keyboard a frame before the viewport grows, settling (hidden moving without keyboardResized)", () =>
  replay("P", [f({ kb: "real" }), f({ blur: true, settling: true })], "direct"));
test("pin: no bar at all, 382x678, settled (inline right without the column hold)", () =>
  replay("P", [f({ chrome: 0 })]));
