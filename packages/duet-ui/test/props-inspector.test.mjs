// Model test of the card inspector (inspector.ts): random taps (open, step, toggle, back, close), window changes and the
// browser's own Back and Forward through the real reducer, with the harness playing the app and a model browser
// history: "push" and "replace" write the entry, `{ go }` moves through the entries and delivers the landing entry as a
// "pop", as popstate does. DUET_PBT_RUNS overrides the run count, DUET_PBT_SEED replays a failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { inspector, initialInspector, paneCommands } from "../src/inspector.ts";
import { opts } from "./arb.mjs";

const IDS = ["a", "b", "c", "d", "e"];

const event = (n) => fc.oneof(
  fc.record({ type: fc.constant("open"), id: fc.constantFrom(...IDS.slice(0, n), "zz") }),
  fc.constant({ type: "toggle" }), fc.constant({ type: "back" }), fc.constant({ type: "close" }),
  fc.record({ type: fc.constant("step"), delta: fc.constantFrom(1, -1) }),
  fc.record({ type: fc.constant("resize"), canSplit: fc.boolean() }),
  // The browser's own buttons, not the app's: they move through history and the app hears a popstate.
  fc.constant({ type: "browser", go: -1 }), fc.constant({ type: "browser", go: 1 }),
);
const scenario = fc.integer({ min: 1, max: 5 }).chain((n) => fc.record({
  n: fc.constant(n), wrap: fc.boolean(), canSplit: fc.boolean(), events: fc.array(event(n), { maxLength: 60 }),
}));

function play({ n, wrap, canSplit, events }) {
  const ids = IDS.slice(0, n);
  // The browser: entry 0 is the overview's, from before the inspector (no inspector state).
  const h = { entries: [null], at: 0 };
  let s = initialInspector, room = canSplit;
  const ctx = () => ({ ids, canSplit: room, wrap });
  const pop = () => {
    const before = s, r = inspector(s, { type: "pop", state: h.entries[h.at] }, ctx());
    assert.equal(r.history, null, "a pop never writes history");
    if (before.selected === null && h.entries[h.at] === null) assert.equal(r.state, before, "pop of the overview while on it: a no-op");
    s = r.state;
  };
  const go = (d) => {
    const to = Math.max(0, Math.min(h.entries.length - 1, h.at + d));
    if (to === h.at) return false;
    h.at = to; pop(); return true;
  };
  const commands = () => paneCommands({ canSplit: room, full: s.full, count: n, wrap, index: ids.indexOf(s.selected) }).length;
  for (const e of events) {
    const was = s, open = s.selected !== null, shown = open ? commands() : 0;
    if (e.type === "browser") go(e.go);
    else {
      if (e.type === "resize") room = e.canSplit;
      const r = inspector(s, e, ctx());
      s = r.state;
      if (r.history === null) assert.equal(r.state, was, `${e.type}: no history, so nothing changed`);
      else if (r.history === "push") { h.entries = [...h.entries.slice(0, h.at + 1), s]; h.at++; }
      else if (r.history === "replace") h.entries[h.at] = s;
      else {
        const predicted = s;
        assert.ok(r.history.go < 0 && h.at + r.history.go >= 0, `go ${r.history.go} from entry ${h.at}`);
        go(r.history.go);
        // Where the browser lands is the level the reducer said: the card may differ (steps replace only the top entry).
        assert.equal(s.depth, predicted.depth, `${e.type}: landed depth`);
        assert.equal(s.full, predicted.full, `${e.type}: landed layout`);
        assert.equal(s.selected === null, predicted.selected === null, `${e.type}: landed open`);
      }
      if (e.type === "close" && open) assert.deepEqual(s, initialInspector, "close: the overview");
      if (e.type === "step" && open) {
        const i = ids.indexOf(was.selected), j = i + e.delta;
        const want = n < 2 ? was.selected : wrap ? ids[(j + n) % n] : j < 0 || j >= n ? was.selected : ids[j];
        assert.equal(s.selected, want, `step ${e.delta} from ${was.selected}`);
      }
      if (e.type === "open" && !ids.includes(e.id)) assert.equal(s, was, "open of an unknown id: a no-op");
      if (!open && ["toggle", "back", "close", "step", "resize"].includes(e.type)) assert.equal(s, was, `${e.type} with nothing open: a no-op`);
    }
    // Invariants after every step.
    assert.ok(s.depth >= 0 && s.depth <= 2, "depth 0 (overview), 1 (the card's level) or 2 (full screen over the pane)");
    if (s.depth === 2) assert.ok(s.full, "the level above the pane is full screen");
    assert.equal(s.depth, h.at, "depth = the inspector's entries above the overview's (pushes − pops)");
    assert.equal(s.selected === null, s.depth === 0, "open exactly when above the overview's entry");
    if (s.selected !== null) assert.ok(ids.includes(s.selected), "the open card is on the page");
    if (!room && s.selected !== null) assert.ok(s.full, "no room for two panes: full screen");
    if (s.selected === null) assert.equal(s.full, false, "closed is not full");
    // The column keeps its buttons while open: the same count at every card and in either layout.
    if (open && s.selected !== null && e.type !== "resize") assert.equal(commands(), shown, "command count stable while open");
    if (s.selected !== null) assert.equal(commands(), 1 + (room ? 1 : 0) + (n > 1 ? 2 : 0), "Close, the toggle where two fit, both chevrons");
  }
}

test("model: depth tracks history, no room means full screen, commands stay put, steps wrap, close empties", () => {
  fc.assert(fc.property(scenario, (sc) => { play(sc); }), opts());
});

test("model: Back from any level ends on the overview, one level at a time", () => {
  fc.assert(fc.property(scenario, (sc) => {
    // The app's own events, then Back until closed: never more presses than levels.
    const ids = IDS.slice(0, sc.n);
    let s = initialInspector, room = sc.canSplit;
    for (const e of sc.events) {
      if (e.type === "browser") continue;
      if (e.type === "resize") room = e.canSplit;
      s = inspector(s, e, { ids, canSplit: room, wrap: sc.wrap }).state;
    }
    let presses = 0;
    while (s.selected !== null) {
      const before = s.depth;
      s = inspector(s, { type: "back" }, { ids, canSplit: room, wrap: sc.wrap }).state;
      assert.ok(s.depth < before, "back always goes down");
      assert.ok(++presses <= 2, "at most two levels: the pane and full screen");
    }
    assert.deepEqual(s, initialInspector);
  }), opts());
});
