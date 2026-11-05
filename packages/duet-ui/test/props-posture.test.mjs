// Posture traces (model-based): random folds, unfolds, turns, split view, the keyboard, Safari's bar, the in-app preview
// handed to a tab and Home Screen launches, with random timing and events cutting into a transition, fed to stable()
// read by read as chrome.tsx reads it (arb-posture.mjs drive()). Every read must hold the invariants below.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { detect, inTransit, pageInsets, stable, LAND_HOLD, WIDE } from "../src/geometry.ts";
import { placeTabs } from "../src/template.ts";
import { settling, watchSignals } from "../src/signals.ts";
import { LAUNCHES, LOADS, POSTURES, at, drive, expected, landed, place, runs, timeline, traceArb } from "./arb-posture.mjs";

const FLIP_WINDOW = 2000;
const px = (v) => Number.parseFloat(v);
const stableKey = (e) => `${e.s.outerWidth}x${e.s.outerHeight} ${e.s.innerWidth} ${e.s.angle} ${e.s.standalone} ${e.epoch}`;
const windowKey = (s) => `${s.outerWidth}x${s.outerHeight}`;
const show = (r) => `${r.t}ms ${r.entry.posture} ${r.s.innerWidth}x${r.s.innerHeight} in ${r.s.outerWidth}x${r.s.outerHeight} a${r.s.angle}${r.s.insetRight ? ` r${r.s.insetRight}` : ""}: ${place(r.c)}${r.settling ? " settling" : ""}`;

/** Every invariant over one driven trace; the first broken one, or undefined. */
export function check(tl, { reads, final, spin }) {
  // The damper's timers fire once each: a deadline left in the past re-arms every tick, refreshing for nothing.
  if (spin > 8) return `timers spin: ${spin} reads in 100ms`;
  let lastShown, transit = false;
  const flips = new Map();
  for (const [i, r] of reads.entries()) {
    const c = r.c, shown = !c.hidden;
    // Placed in a valid band: hidden, or a placement this stretch of the trace landed in (a mid-transition frame
    // flashing a placement that belongs to no landing is the bug class), or inline under the pin.
    if (shown) {
      const ok = [...r.entry.allowed];
      if (r.pinned) ok.push(`inline ${c.side}`);
      if (!ok.includes(place(c))) return `placed: ${show(r)}, expected one of ${ok.join(", ")}`;
    }
    // Insets bounded, hidden frames too: the page keeps the last insets mid-turn (once 296px and -485px).
    for (const reserve of [true, false]) for (const inner of [true, false]) {
      const o = pageInsets({ mode: c.mode, side: c.side, split: !!c.split, screenWidth: c.screenWidth, width: c.width, hiddenPreview: c.hidden === "preview", inner, emulated: false, reserve, env: () => "84px" });
      for (const v of [px(o.left), px(o.right), o.shift]) if (!(v >= 0 && v <= 88)) return `insets: ${JSON.stringify(o)} at ${show(r)}`;
    }
    if (c.mode === "column") {
      const bottom = Math.max(0, c.screenHeight - c.height - c.offsetTop);
      if (bottom > 300) return `bottom inset ${bottom} at ${show(r)}`;
    }
    // Never over the status area: an open Home Screen app wide has its clock over the right edge, only the strip
    // starts below it (the inline burger sat on the clock).
    if (shown && c.standalone && c.device === "duo" && r.s.outerWidth >= WIDE && r.s.outerWidth > r.s.outerHeight && c.mode !== "strip")
      return `over the clock: ${show(r)}`;
    // No controls at the closed screen's places on the open screen while a Home Screen app lands.
    if (shown && r.s.standalone && Math.max(r.s.outerWidth, r.s.outerHeight) >= 950 && (Math.abs(r.s.innerWidth - 466) <= 1 || Math.abs(r.s.innerWidth - 867) <= 1))
      return `closed screen's places: ${show(r)}`;
    // Never a tab's controls over the in-app preview's own buttons, as it loads (#143) or after.
    if (shown && POSTURES[r.entry.posture].kind === "preview" && !c.preview) return `a tab's controls on the preview: ${show(r)}`;
    // No tabs then a burger: a Home Screen app allocates its tabs the same in a window from its first shown read.
    if (shown && r.s.standalone && !c.keyboard && windowKey(r.s) === windowKey(landed(r.entry.posture))) {
      const want = placeTabs(detect(landed(r.entry.posture)), 7, false), got = placeTabs(c, 7, false);
      if (JSON.stringify(want) !== JSON.stringify(got)) return `tabs ${JSON.stringify(got)} then ${JSON.stringify(want)}: ${show(r)}`;
    }
    // A landing after a transit (a read caught halfway, inTransit) shows only once its stable signals held LAND_HOLD
    // (no one-frame flash of a posture passed through).
    if (c.hidden === "moving" && r.settling && inTransit(r.s)) transit = true;
    if (shown && transit && r.settling) {
      let j = tl.findLastIndex((e) => e.t <= r.t);
      const k = stableKey(tl[j]);
      while (j > 0 && stableKey(tl[j - 1]) === k) j--;
      if (r.t - tl[j].t < LAND_HOLD) return `flash: shown ${r.t - tl[j].t}ms after its landing: ${show(r)}`;
    }
    if (c.hidden !== "moving") transit = false;
    // Mode flips bounded: in one window, at most 3 visible changes per FLIP_WINDOW made settled (the oscillation
    // guard; a change while settling is the transition, and does not count, as in stable()).
    if (shown) {
      const key = windowKey(r.s), f = flips.get(key) ?? { last: undefined, at: [] };
      if (f.last !== undefined && f.last !== place(c) && !r.settling) {
        f.at = [...f.at.filter((t) => r.t - t < FLIP_WINDOW), r.t];
        if (f.at.length > 3) return `oscillating: ${f.at.length} flips in ${FLIP_WINDOW}ms, ${show(r)}`;
      }
      f.last = place(c); flips.set(key, f);
    }
    if (shown) lastShown = i;
  }
  // Settled, the trace ends on what detect() says of the final signals.
  const end = reads.at(-1), want = detect(final);
  if (place(end.c) !== place(want) || end.settling) return `final: ${show(end)}, detect says ${place(want)}`;
  return lastShown === undefined && !want.hidden ? "never shown" : undefined;
}

const property = (starts, extra = {}) => fc.property(traceArb(starts), fc.option(fc.constantFrom("launch wide", "launch wide 867", "launch tall", "launch tall, cold"), { nil: undefined }), (tr, launch) => {
  const t = { ...tr, ...(tr.start.startsWith("H") && extra.launch && launch ? { launch, start: launch.includes("wide") ? "HW" : "HT" } : {}),
    ...(LOADS[tr.start] && extra.load && launch ? { launch: "load" } : {}) };
  const tl = timeline(t), err = check(tl, drive(tl));
  if (err) throw new Error(err);
});

const TABS = ["P", "L90", "L270", "S", "U", "T"];
test("posture traces, Safari tab: every read holds the invariants", () => fc.assert(property(TABS), runs(500)));
test("posture traces, in-app preview and Open in Safari", () => fc.assert(property(["V", "VS", "VS90", "VS270"], { load: true }), runs(300)));
test("posture traces, Home Screen app, launched on the inner screen or running", () => fc.assert(property(["HC", "HW", "HT"], { launch: true }), runs(300)));

// Pinned counterexamples.

const step = (o) => ({ move: 0, gaps: [1, 1, 1, 1, 1, 1], cut: null, dwell: 0, chrome: 50, kbShrink: 155, banner: false, loop: 4, ...o });
const replay = (tr, launch) => {
  const t = { ...tr, ...(launch === "load" ? { launch } : launch ? { launch, start: launch.includes("wide") ? "HW" : "HT" } : {}) }, tl = timeline(t);
  assert.equal(check(tl, drive(tl)), undefined);
};

// Each failed with drive() not renewing the cap on a window change (signals.ts before c8d751c).
test("trace: the column loop runs past the cap, then the Duo turns (oscillating mid-turn)", () => replay({ start: "P", steps: [
  step({ move: 1009083104, gaps: [1, 21, 1, 8, 10, 2], loop: 19 }), step(), step()] }));

test("trace: the in-app preview turned and unfolded over a long settle (296px insets while hidden)", () => replay({ start: "VS", steps: [
  step({ dwell: 29 }), step({ gaps: [17, 13, 1, 1, 1, 1], dwell: 20 }), step({ gaps: [3, 19, 1, 1, 1, 1], dwell: 8 }),
  step({ gaps: [22, 13, 1, 1, 1, 1], dwell: 30 }), step({ gaps: [6, 15, 1, 1, 1, 1] })] }));

test("trace: a wide launch folded and unfolded over a long settle (inline over the clock)", () => replay({ start: "HC", steps: [
  step({ gaps: [10, 16, 1, 1, 1, 1], dwell: 35 }), step({ gaps: [9, 1, 1, 1, 1, 1], dwell: 54 }),
  step({ gaps: [24, 17, 1, 1, 1, 1], dwell: 23 }), step({ gaps: [10, 1, 1, 1, 1, 1] })] }, "launch wide"));

test("trace: a tall launch, folded and unfolded twice, the last unfold at the settle's end (inline over the clock)", () => replay({ start: "HC", steps: [
  step({ move: 173857037, gaps: [8, 19, 21, 1, 1, 1], dwell: 27 }), step({ gaps: [15, 9, 1, 1, 1, 1], dwell: 29 }), step(),
  step({ gaps: [14, 21, 1, 1, 1, 1], dwell: 28 }), step({ gaps: [5, 1, 1, 1, 1, 1] })] }, "launch tall"));

test("a launch's pending deadline does not outlive a read that returns early (timers spin)", () => {
  // Shrunk from the Home Screen trace: launched wide, the window turning before the strip's inset lands. The read at
  // the deadline returns early (the wide turn hides), and a pendingUntil left in the past re-armed chrome.tsx's timer
  // at 0ms on every refresh until the settle ended.
  const d = {};
  assert.equal(stable(d, LAUNCHES["launch wide"][0], undefined, 0, true).hidden, "pending");
  assert.equal(d.pendingUntil, 1000);
  const c = stable(d, at("HW", { insetRight: 0 }), undefined, 1010, true);
  assert.equal(c.hidden, "moving");
  assert.ok(d.pendingUntil === undefined || d.pendingUntil > 1010, `pendingUntil ${d.pendingUntil} at 1010`);
});

test("a turn while a feedback loop polls past the cap still settles (its transit hides)", () => {
  // Shrunk from the Safari tab trace: the column loop runs past SETTLE.cap, then the Duo turns. The turn's events only
  // bumped the capped settle, so settling() stayed false: the half-turned frames read as settled and flipped the
  // controls inline, column, inline, column within 80ms (and counted toward the pin).
  const win = new EventTarget(), orientation = Object.assign(new EventTarget(), { angle: 0 });
  Object.assign(globalThis, {
    window: globalThis, visualViewport: undefined, innerWidth: 382, innerHeight: 580, outerWidth: 466, outerHeight: 678,
    document: Object.assign(new EventTarget(), { body: { appendChild() {} }, createElement: () => ({ style: {} }) }),
    addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win),
    getComputedStyle: () => ({ paddingBottom: "0px", paddingLeft: "0px", paddingRight: "0px" }),
  });
  Object.defineProperty(globalThis, "screen", { value: { width: 466, height: 678, orientation }, configurable: true });
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const off = watchSignals(() => {});
  for (let t = 0; t < 2400; t += 100) {
    globalThis.innerWidth = globalThis.innerWidth === 382 ? 466 : 382;
    win.dispatchEvent(new Event("resize"));
    mock.timers.tick(100);
  }
  assert.equal(settling(), false, "the loop alone is capped");
  Object.assign(globalThis, { innerWidth: 678, innerHeight: 340, outerWidth: 678, outerHeight: 466 });
  orientation.angle = 90;
  win.dispatchEvent(new Event("resize"));
  assert.equal(settling(), true, "the turn settles");
  off();
  mock.timers.reset();
});

// Each found with its fix reverted in stable().
test("trace: the column loop flips 35 times in one window (oscillating without the pin, ae590b2)", () => replay({ start: "P", steps: [
  step({ move: 605134466, gaps: [1, 1, 1, 1, 9, 1], loop: 35 })] }));
test("trace: upright to turned left, shown the frame it lands (flash without LAND_HOLD, 5d9b39a)", () => replay({ start: "P", steps: [step()] }));
test("trace: the sheet preview turned, its insets mid-turn (296px without the last geometry kept, 5d9b39a)", () => replay({ start: "VS", steps: [step()] }));
test("trace: a wide launch, nothing else (over the clock without launching, 503ad1e)", () => replay({ start: "HC", steps: [] }, "launch wide"));
test("trace: the open Home Screen app turned wide, its strip late (over the clock without toWide, 89466d1)", () => replay({ start: "HC", steps: [
  step(), step({ gaps: [22, 3, 1, 1, 1, 1], dwell: 72 }), step()] }));
test("trace: the full screen preview loading (a tab's controls on it without previewPending, 9d37db9, 12abe27)", () => replay({ start: "V", steps: [] }, "load"));
