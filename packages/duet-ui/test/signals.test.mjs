// readSignals/watchSignals against a stubbed browser: every trigger re-reads, geometry is polled until it holds, unsubscribing stops it all.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const observers = new Set();
const win = new EventTarget(), doc = new EventTarget(), orientation = new EventTarget(), viewport = new EventTarget();
Object.assign(orientation, { angle: 90 });
Object.assign(viewport, { height: 368 });
Object.assign(doc, { visibilityState: "visible", body: { appendChild() {} }, createElement: () => ({ style: {} }) });
Object.assign(globalThis, {
  window: globalThis, top: globalThis, document: doc, visualViewport: viewport, devicePixelRatio: 3,
  innerWidth: 594, innerHeight: 368, outerWidth: 678, outerHeight: 466,
  addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win),
  getComputedStyle: () => ({ paddingTop: "0px", paddingBottom: "0px", paddingRight: "0px", paddingLeft: "0px" }),
  matchMedia: () => ({ matches: false }),
  ResizeObserver: class { constructor(f) { this.f = f; this.on = new Set(); observers.add(this); } observe(el) { this.on.add(el); } disconnect() { this.on.clear(); } },
});
Object.defineProperty(globalThis, "screen", { value: { width: 466, height: 678, orientation }, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "iPhone Version/27.1 Safari/605.1.15", maxTouchPoints: 5 }, configurable: true });

const { readSignals, watchSignals, settling, SETTLE } = await import("../src/signals.ts");
const { detect } = await import("../src/geometry.ts");

test("readSignals carries the turn, so closed landscape reads as Safari's column on the camera's side", () => {
  const s = readSignals();
  assert.equal(s.angle, 90);
  assert.equal(s.screenWidth, 678);
  assert.equal(s.standalone, false);
  const c = detect(s);
  assert.equal(c.mode, "column");
  assert.equal(c.side, "left");
});

test("watchSignals fires on every trigger, re-reads once geometry holds, and unsubscribes cleanly", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let n = 0;
  const off = watchSignals(() => n++);
  mock.timers.tick(1000);
  assert.equal(n, 2, "a read at 0 and one when the sizes have held for SETTLE.quiet");
  const fire = (target, type) => { n = 0; target.dispatchEvent(new Event(type)); mock.timers.tick(1000); return n; };
  for (const type of ["resize", "orientationchange", "pageshow"]) assert.equal(fire(win, type), 2, type);
  assert.equal(fire(orientation, "change"), 2, "screen.orientation change");
  assert.equal(fire(viewport, "resize"), 2, "visualViewport resize");
  assert.equal(fire(doc, "visibilitychange"), 2, "visibilitychange to visible");
  doc.visibilityState = "hidden";
  assert.equal(fire(doc, "visibilitychange"), 0, "hidden: nothing to re-read");
  doc.visibilityState = "visible";
  off();
  for (const [t, type] of [[win, "resize"], [win, "pageshow"], [orientation, "change"], [viewport, "resize"], [doc, "visibilitychange"]]) assert.equal(fire(t, type), 0, `${type} after unsubscribe`);
  mock.timers.reset();
});

test("a fold's late outerWidth is read when it lands, with no event for it, and settling() covers the wait", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  Object.assign(globalThis, { innerWidth: 951, innerHeight: 543, outerWidth: 951, outerHeight: 678 });
  const reads = [];
  const off = watchSignals(() => reads.push(`${innerWidth}x${innerHeight}/${outerWidth}x${outerHeight}`));
  mock.timers.tick(1000);
  reads.length = 0;
  // Open to closed: the viewport lands with a resize, the window ~1.2s later and silently.
  Object.assign(globalThis, { innerWidth: 382, innerHeight: 580 });
  win.dispatchEvent(new Event("resize"));
  assert.equal(settling(), true);
  mock.timers.tick(1200);
  assert.equal(settling(), true, "still polling: the sizes have not held yet");
  Object.assign(globalThis, { outerWidth: 466, outerHeight: 678 });
  mock.timers.tick(100);
  assert.equal(reads.at(-1), "382x580/466x678", "read on the poll that sees the window land");
  mock.timers.tick(SETTLE.quiet);
  assert.equal(settling(), false);
  assert.equal(reads.at(-1), "382x580/466x678");
  off();
  mock.timers.reset();
});

test("settling() ends at SETTLE.cap even while sizes keep moving, so a feedback loop still reaches the damper", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const off = watchSignals(() => {});
  mock.timers.tick(1000);
  for (let t = 0; t < 3000; t += 100) {
    globalThis.innerHeight = globalThis.innerHeight === 580 ? 590 : 580;
    win.dispatchEvent(new Event("resize"));
    if (t === 1500) assert.equal(settling(), true);
    mock.timers.tick(100);
  }
  assert.equal(settling(), false, "a loop's own resizes do not restart the settle");
  off();
  mock.timers.reset();
});

test("a layout with no resize event is still read: WebKit holds resize back while the window animates", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let n = 0;
  const off = watchSignals(() => n++);
  mock.timers.tick(1000);
  const watching = () => [...observers].filter((o) => o.on.size);
  assert.equal(watching().length, 1, "the viewport-sized probe is observed");
  n = 0;
  Object.assign(globalThis, { innerWidth: 585, innerHeight: 876, outerWidth: 669, outerHeight: 951 });
  watching()[0].f([]);
  assert.equal(settling(), true);
  assert.equal(n, 1, "read at once");
  mock.timers.tick(SETTLE.cap + SETTLE.quiet);
  off();
  assert.equal(watching().length, 0, "unsubscribing disconnects");
  mock.timers.reset();
});
