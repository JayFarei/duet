// Shared arbitraries and a chrome.tsx-shaped driver for the property and model tests (props-*.test.mjs). Signals are
// built around the measured windows (test/fixtures/states.json, docs/research-notes.md) with jitter; the driver feeds
// stable() the way chrome.tsx does: on each event, on the settle poll (signals.ts SETTLE), and at the damper's timers.
import fc from "fast-check";
import { detect, inTransit, stable } from "../src/geometry.ts";
import { SETTLE } from "../src/signals.ts";

/** fast-check options: `n` runs unless DUET_PBT_RUNS says otherwise. */
export const runs = (n, o = {}) => ({ numRuns: Number(process.env.DUET_PBT_RUNS) || n, ...o });

export const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
export const sig = (o) => ({
  insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3, touchPoints: 5, userAgent: UA, angle: 0,
  editing: false, ...o, visualHeight: o.visualHeight ?? o.innerHeight,
});

/** Landed windows. `chrome`: the default bar (outer height less page height); tabs drift it (bar), the rest keep it. */
export const POSTURES = {
  P: { kind: "tab", outer: [466, 678], screen: [466, 678], iw: 382, chrome: 98, column: true },
  L90: { kind: "tab", outer: [678, 466], screen: [678, 466], iw: 594, chrome: 98, angle: 90, column: true },
  L270: { kind: "tab", outer: [678, 466], screen: [678, 466], iw: 594, chrome: 98, angle: 270, column: true },
  S: { kind: "tab", outer: [469, 669], screen: [951, 669], iw: 385, chrome: 98, column: true },
  U: { kind: "tab", outer: [951, 669], screen: [951, 669], iw: 951, chrome: 126, insetBottom: 34 },
  T: { kind: "tab", outer: [669, 951], screen: [669, 951], iw: 669, chrome: 80 },
  V: { kind: "preview", outer: [466, 678], screen: [466, 678], iw: 382, chrome: 75, insetBottom: 34 },
  VS: { kind: "preview", outer: [450, 670], screen: [466, 678], iw: 366, chrome: 70, insetBottom: 34 },
  VS90: { kind: "preview", outer: [662, 458], screen: [678, 466], iw: 578, chrome: 70, insetBottom: 34, angle: 90 },
  VS270: { kind: "preview", outer: [662, 458], screen: [678, 466], iw: 578, chrome: 70, insetBottom: 34, angle: 270 },
  HC: { kind: "home", outer: [466, 678], screen: [466, 678], iw: 382, chrome: 21, insetBottom: 21, insetRight: 84 },
  HW: { kind: "home", outer: [951, 669], screen: [466, 678], iw: 951, chrome: 21, insetBottom: 34, insetRight: 84 },
  HT: { kind: "home", outer: [669, 951], screen: [466, 678], iw: 669, chrome: 82, insetBottom: 34 },
};

/** Drift: Safari's bar (chrome 50 to 110: real collapsed 59, simulator compact 80, fresh 98, largest type 106), a
 *  Shared with You banner (40), the keyboard (simulator: visual viewport only; real Duo: the layout viewport too,
 *  382x411 in 466x678) and the top inset (Live Activities, the status bar). */
export const NO_DRIFT = { chrome: undefined, banner: 0, kb: "none", kbShrink: 267, insetTop: 0 };

export function landed(p, dr = NO_DRIFT) {
  const P = POSTURES[p], [ow, oh] = P.outer, [sw, sh] = P.screen;
  const bar = P.column && dr.chrome !== undefined ? dr.chrome : P.chrome, banner = P.column ? dr.banner : 0;
  let ih = oh - bar - banner, vh = ih, editing = false;
  if (dr.kb === "real" && P.column) [ih, vh, editing] = [oh - dr.kbShrink, oh - dr.kbShrink, true];
  else if (dr.kb !== "none") [vh, editing] = [Math.round(ih * 0.45), true];
  return sig({
    innerWidth: P.iw, innerHeight: ih, visualHeight: vh, outerWidth: ow, outerHeight: oh, screenWidth: sw, screenHeight: sh, angle: P.angle ?? 0,
    insetBottom: P.insetBottom ?? 0, insetRight: P.insetRight ?? 0, insetTop: dr.insetTop, standalone: P.kind === "home", editing,
  });
}

// Transitions: the frames a fold, unfold, turn or split passes through before landing, after the measured paths
// (transit.test.mjs, first-paint.test.mjs, docs/research-notes.md). Each is a list of signal overrides on the source
// posture's window; the destination's landed frame follows.
export const at = (p, o) => ({ ...landed(p), ...o });
const PATHS = {
  "P>L90": [at("P", { angle: 90 }), at("L90", { innerWidth: 678, innerHeight: 340 }), at("L90", { innerHeight: 340 })],
  "P>L270": [at("P", { angle: 270 }), at("L270", { innerWidth: 678, innerHeight: 340 }), at("L270", { innerHeight: 340 })],
  "L90>P": [at("L90", { innerWidth: 678, innerHeight: 340, angle: 0 }), at("P", { innerWidth: 466, innerHeight: 498 }), at("P", { innerHeight: 498 })],
  "L270>P": [at("L270", { innerWidth: 678, innerHeight: 340, angle: 0 }), at("P", { innerWidth: 466, innerHeight: 498 }), at("P", { innerHeight: 498 })],
  "L90>L270": [at("L90", { angle: 270, innerWidth: 678 })],
  "L270>L90": [at("L270", { angle: 90, innerWidth: 678 })],
  "P>U": [at("P", { innerWidth: 466, innerHeight: 498 }), at("P", { innerWidth: 951, innerHeight: 543 })],
  "L90>U": [at("L90", { innerWidth: 678, innerHeight: 340, insetBottom: 34, angle: 0 }), at("P", { innerWidth: 466, innerHeight: 498 }), at("P", {}), at("P", { innerWidth: 466, innerHeight: 498 })],
  "L270>U": [at("L270", { innerWidth: 678, innerHeight: 340, insetBottom: 34, angle: 0 }), at("P", { innerWidth: 466, innerHeight: 498 })],
  "U>P": [at("U", { innerWidth: 466, innerHeight: 498 }), at("P", { innerWidth: 466, innerHeight: 498 }), at("P", { innerHeight: 498 })],
  "S>P": [at("P", { innerWidth: 385, innerHeight: 571 }), at("P", { innerHeight: 571 })],
  "T>P": [at("T", { innerWidth: 466, innerHeight: 498 }), at("P", { innerWidth: 466, innerHeight: 498 })],
  "U>S": [at("U", { innerWidth: 867, innerHeight: 543, insetBottom: 0 })],
  "S>U": [at("U", { innerWidth: 385, innerHeight: 571, insetBottom: 0 })],
  "U>T": [at("U", { innerWidth: 669, innerHeight: 871 }), at("T", { innerWidth: 951, innerHeight: 543 })],
  "T>U": [at("T", { innerWidth: 951, innerHeight: 543 }), at("U", { innerWidth: 669, innerHeight: 871 })],
  "VS>VS90": [at("VS", { angle: 90 }), at("VS90", { innerWidth: 366, innerHeight: 600 })],
  "VS>VS270": [at("VS", { angle: 270 }), at("VS270", { innerWidth: 366, innerHeight: 600 })],
  "VS90>VS": [at("VS90", { angle: 0 }), at("VS", { innerWidth: 578, innerHeight: 388 })],
  "VS270>VS": [at("VS270", { angle: 0 }), at("VS", { innerWidth: 578, innerHeight: 388 })],
  // No Home Screen unfold is measured: the window, then the inset (as the wide turn, 89466d1).
  "HC>HW": [at("HW", { insetRight: 0 })],
  "HW>HC": [at("HW", { outerWidth: 466, outerHeight: 678, insetRight: 0 }), at("HC", { innerWidth: 466, innerHeight: 657, insetRight: 0 })],
  "HT>HC": [at("HT", { outerWidth: 466, outerHeight: 678 }), at("HC", { innerWidth: 466, innerHeight: 657, insetRight: 0 })],
  "HT>HW": [at("HW", { innerHeight: 587, insetRight: 0 }), at("HW", { innerHeight: 648, insetTop: 61, insetRight: 0 }), at("HW", { innerHeight: 648, insetRight: 0 })],
  "HW>HT": [at("HT", { innerWidth: 951, innerHeight: 587, insetRight: 0 }), at("HT", { innerHeight: 869 })],
};
/** Leaving the in-app preview for a tab (Open in Safari): the same page, a new container, the epoch bumped. */
const HANDOFF = { V: "P", VS: "P" };
/** Launching a Home Screen app on the inner screen: the closed width inside the open window first, both ways up
 *  (first-paint.test.mjs, iOS 27.1 Duo simulator), and a wide launch's 867 window (cover or not) before the 951 one. */
export const LAUNCHES = {
  "launch wide": [at("HW", { innerWidth: 466, innerHeight: 678, insetRight: 0, insetBottom: 0 }), at("HW", { innerWidth: 466, innerHeight: 669, scale: 2.04 }), at("HW", { innerHeight: 669, insetRight: 0, insetBottom: 0 })],
  "launch wide 867": [at("HW", { innerWidth: 867, insetRight: 0 }), at("HW", { innerWidth: 867 })],
  "launch tall": [at("HT", { innerWidth: 466, innerHeight: 678, insetBottom: 0 })],
  "launch tall, cold": [at("HT", { innerWidth: 980, innerHeight: 1424, insetBottom: 0 }), at("HT", { innerWidth: 466, innerHeight: 678 })],
};
/** The in-app preview loading: the whole closed screen first, inset 0 (the sheet's inside its 450x670 window, ~70ms,
 *  e2e pvl01; the full screen's ~200ms, j37), then its own size before the bottom inset lands (~100ms, #143). */
export const LOADS = {
  V: [at("V", { innerWidth: 466, innerHeight: 678, visualHeight: 678, insetBottom: 0 }), at("V", { insetBottom: 0 })],
  VS: [at("VS", { innerWidth: 466, innerHeight: 678, visualHeight: 678, insetBottom: 0 }), at("VS", { insetBottom: 0 })],
};

/** What may happen next in posture `p`: [name, destination or undefined for drift]. */
export function moves(p) {
  const out = Object.keys(PATHS).filter((k) => k.startsWith(`${p}>`)).map((k) => [k, k.split(">")[1]]);
  if (HANDOFF[p]) out.push(["open in safari", HANDOFF[p]]);
  const P = POSTURES[p];
  if (P.column) out.push(["bar", undefined], ["banner", undefined], ["keyboard real", undefined]);
  if (P.kind !== "home" || p !== "HW") out.push(["keyboard", undefined]);
  out.push(["keyboard down", undefined]);
  if (p === "P") out.push(["loop", undefined]);
  return out;
}

/** One step of a trace: which move (index into moves()), frame gaps (x10ms), how many frames run before the next
 *  step cuts in (mid-transition when short), the dwell after, and the drift values it may set. */
export const stepArb = fc.record({
  move: fc.nat(), gaps: fc.array(fc.integer({ min: 1, max: 25 }), { minLength: 6, maxLength: 6 }), cut: fc.option(fc.integer({ min: 1, max: 4 }), { freq: 3 }),
  dwell: fc.integer({ min: 0, max: 120 }), chrome: fc.integer({ min: 50, max: 110 }), kbShrink: fc.integer({ min: 155, max: 290 }),
  banner: fc.boolean(), loop: fc.integer({ min: 4, max: 40 }),
});
export const traceArb = (starts, n = 10) => fc.record({ start: fc.constantFrom(...starts), steps: fc.array(stepArb, { maxLength: n }) });

/** A trace's timeline: [{ t, s, epoch, posture, allowed }], `allowed` the placements a read may show: each posture's
 *  landed placement (detect()) and each landed-looking frame's (not inTransit) since the last landing held. Ends with
 *  the final posture landed with no drift, and a rest. */
export function timeline({ start, steps, launch }) {
  let t = 0, p = start, dr = { ...NO_DRIFT }, epoch = 0, heldSince = 0, allowed = new Set([expected(p)]);
  const out = [];
  const push = (s) => {
    if (!inTransit(s)) allowed.add(place(detect(s)));
    out.push({ t, s, epoch, posture: p, allowed: [...allowed] });
  };
  for (const s of launch === "load" ? LOADS[start] : launch ? LAUNCHES[launch] : []) { push(s); t += 60; }
  // The page boots landed: the first step comes after its settle.
  push(landed(p, dr)); t += SETTLE.quiet + SETTLE.poll;
  for (const st of steps) {
    const options = moves(p), [name, to] = options[st.move % options.length];
    let frames;
    if (to) {
      frames = name === "open in safari" ? [] : PATHS[name];
      if (name === "open in safari") epoch++;
      if (t - heldSince > 2 * SETTLE.cap) allowed = new Set([expected(p)]);
      p = to; allowed.add(expected(p)); dr = { ...NO_DRIFT };
    } else if (name === "bar") dr = { ...dr, chrome: st.chrome };
    else if (name === "banner") dr = { ...dr, banner: st.banner ? 40 : 0 };
    else if (name === "keyboard") dr = { ...dr, kb: "sim" };
    else if (name === "keyboard real") dr = { ...dr, kb: "real", kbShrink: st.kbShrink };
    else if (name === "keyboard down") {
      // Focus leaves first, the viewport grows ~40ms later (e2e kb02-03).
      if (dr.kb !== "none") { push({ ...landed(p, dr), editing: false }); t += 40; }
      dr = { ...dr, kb: "none" };
    } else if (name === "loop") {
      // The column layer's overflow resizing Safari's viewport: the page flips between the column and full width.
      for (let i = 0; i < st.loop; i++) { push(at("P", i % 2 ? {} : { innerWidth: 466 })); t += 10 * st.gaps[i % 6] + 40; }
    }
    frames ??= [];
    const cut = st.cut ?? Infinity;
    frames.slice(0, cut).forEach((s, i) => { push(s); t += 10 * st.gaps[i % 6]; });
    if (cut >= frames.length) { push(landed(p, dr)); heldSince = t; t += 10 * st.dwell + 10; }
  }
  push(landed(p));
  return out;
}

/** chrome.tsx's refresh loop around stable(): a read on each event (a change of size, turn or focus; insets alone fire
 *  none), on the settle poll while sizes move (signals.ts), and at the damper's timers (land, keyboard, pending, pin).
 *  Returns every read: { t, s, c, settling, pinned, entry }, and `spin`, the most timer reads in any 100ms. */
export function drive(tl, { rest = 4000, stable: st = stable } = {}) {
  const d = { flips: [] }, reads = [];
  const sizes = (s) => `${s.outerWidth}x${s.outerHeight} ${s.innerWidth}x${s.innerHeight} ${s.visualHeight} ${s.insetBottom} ${s.insetLeft} ${s.insetRight}`;
  const event = (a, b) => !a || a.outerWidth !== b.outerWidth || a.outerHeight !== b.outerHeight || a.innerWidth !== b.innerWidth
    || a.innerHeight !== b.innerHeight || a.visualHeight !== b.visualHeight || a.angle !== b.angle || a.editing !== b.editing;
  let cur, entry, settle, i = 0, t = 0, fired = [], spin = 0;
  const timers = {};
  const win = (s) => `${s.outerWidth}x${s.outerHeight} ${s.angle}`;
  // signals.ts renew(): the cap counts from the last window change (the poll keeps its phase).
  const renew = () => { if (settle.win !== win(cur)) Object.assign(settle, { start: t, win: win(cur), capped: false }); };
  const read = () => {
    const settling = !!settle && t - settle.start < SETTLE.cap;
    const c = st(d, cur, undefined, t, settling, entry.epoch);
    reads.push({ t, s: cur, c, settling, pinned: !!d.pinned, entry });
    // setTimeout with a delay already past still waits a tick (4ms, nested timers).
    const arm = (k, at) => { if (timers[k] === undefined) timers[k] = Math.max(t + 4, at); };
    if (d.pinned) arm("pin", d.until + 20);
    if (d.landUntil !== undefined) arm("land", d.landUntil + 10);
    if (d.kbUntil !== undefined && d.kbUntil > t) arm("kb", d.kbUntil + 10);
    if (d.pendingUntil !== undefined) arm("pending", d.pendingUntil + 10);
  };
  const end = tl.at(-1).t + rest;
  for (let guard = 0; guard < 100000; guard++) {
    const next = [i < tl.length ? tl[i].t : Infinity, settle ? settle.phase + SETTLE.poll * (Math.floor((t - settle.phase) / SETTLE.poll) + 1) : Infinity, ...Object.values(timers)];
    const tn = Math.min(...next);
    if (tn === Infinity || (tn > end && i >= tl.length && !settle && !Object.keys(timers).length)) break;
    t = Math.max(t, tn);
    let fire = false;
    while (i < tl.length && tl[i].t <= t) {
      const e = tl[i++], ev = event(cur, e.s) || (entry && e.epoch !== entry.epoch);
      cur = e.s; entry = e;
      if (ev) { fire = true; if (settle) { settle.since = t; renew(); } else settle = { start: t, phase: t, since: t, last: sizes(cur), win: win(cur), capped: false }; }
    }
    if (fire) read();
    if (settle && t > settle.phase && (t - settle.phase) % SETTLE.poll === 0) {
      renew();
      const k = sizes(cur), capped = t - settle.start >= SETTLE.cap, changed = k !== settle.last, lagging = Math.abs(cur.outerWidth - cur.innerWidth) > SETTLE.lag;
      if (changed) [settle.last, settle.since] = [k, t];
      if (t - settle.since >= SETTLE.quiet && (!lagging || capped)) { settle = undefined; read(); }
      else { if (changed || (capped && !settle.capped)) read(); settle.capped = capped; }
    }
    for (const [k, at] of Object.entries(timers)) if (at <= t) {
      delete timers[k]; read();
      // A timer that re-arms itself in the past spins the refresh loop (a stale damper deadline).
      fired = [...fired.filter((x) => t - x < 100), t];
      spin = Math.max(spin, fired.length);
    }
  }
  return { reads, d, final: cur, spin };
}

/** The placement a landed posture shows, by detect(), the oracle for landed windows. */
export const expected = (p) => { const c = detect(landed(p)); return place(c); };
export const place = (c) => c.hidden ? `hidden ${c.hidden}` : `${c.mode} ${c.side}`;
