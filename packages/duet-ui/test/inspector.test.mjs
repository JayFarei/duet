// The card inspector's core (inspector.ts): the pane's commands, stepping through the cards, and the reducer's levels
// and history, by example. The command examples are the monitoring dashboard's (src/lib/pane-commands.test.mjs), after
// the wealth app's capsule (ui/duet-bridge.jsx). props-inspector.test.mjs runs the reducer against a model history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspector, initialInspector, paneCommands, stepCard, PANE_GLYPHS } from "../src/inspector.ts";
import { ChevronDown, ChevronUp, Columns2, Maximize2, X } from "../src/glyphs.ts";

const ids = (o) => paneCommands(o).map((c) => c.id);
const labels = (o) => paneCommands(o).map((c) => c.label);

test("Duo wide or iPad split, pane level: Close, Full screen, Previous, Next in that order", () => {
  assert.deepEqual(ids({ canSplit: true, full: false, count: 4 }), ["close", "toggle", "previous", "next"]);
  assert.deepEqual(labels({ canSplit: true, full: false, count: 4 }), ["Close", "Full screen", "Previous card", "Next card"]);
});
test("already full where two panes fit: the toggle goes back to side by side", () => {
  const [, toggle] = paneCommands({ canSplit: true, full: true, count: 4 });
  assert.deepEqual(toggle, { id: "toggle", label: "Side by side", icon: "split" });
});
test("phone or narrow iPad (no split, opens full): Close and the chevrons, no toggle", () => {
  assert.deepEqual(ids({ canSplit: false, full: true, count: 3 }), ["close", "previous", "next"]);
});
test("a lone card: no chevrons, both or neither", () => {
  assert.deepEqual(ids({ canSplit: true, full: false, count: 1 }), ["close", "toggle"]);
  assert.deepEqual(ids({ canSplit: false, full: true, count: 1 }), ["close"]);
});
test("the column never changes height while stepping: same commands at every card", () => {
  for (const full of [false, true]) for (const index of [0, 2, 4]) for (const wrap of [true, false])
    assert.equal(paneCommands({ canSplit: true, full, count: 5, index, wrap }).length, 4);
});
test("going round (default): nothing is disabled at the ends", () => {
  for (const index of [0, 3]) assert.ok(paneCommands({ canSplit: true, full: false, count: 4, index }).every((c) => !c.disabled));
});
test("not going round: Previous disabled on the first card, Next on the last, both kept", () => {
  const at = (index) => paneCommands({ canSplit: true, full: false, count: 3, index, wrap: false }).filter((c) => c.disabled).map((c) => c.id);
  assert.deepEqual(at(0), ["previous"]);
  assert.deepEqual(at(1), []);
  assert.deepEqual(at(2), ["next"]);
});
test("every command has a glyph, Lucide's paths", () => {
  for (const c of [...paneCommands({ canSplit: true, full: false, count: 2 }), ...paneCommands({ canSplit: true, full: true, count: 2 })]) assert.ok(PANE_GLYPHS[c.icon]?.length, c.icon);
  assert.deepEqual(PANE_GLYPHS, { close: X, full: Maximize2, split: Columns2, previous: ChevronUp, next: ChevronDown });
  // The monitoring dashboard's PANE_GLYPHS, copied from lucide-react: the same paths, so its capsule does not change.
  assert.deepEqual([X, Maximize2, Columns2, ChevronUp, ChevronDown], [
    ["M18 6 6 18", "m6 6 12 12"],
    ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"],
    ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M12 3v18"],
    ["m18 15-6-6-6 6"],
    ["m6 9 6 6 6-6"],
  ]);
});

const grid = ["a", "b", "c", "d"];
test("Next and Previous follow grid order", () => {
  assert.equal(stepCard(grid, "b", 1), "c");
  assert.equal(stepCard(grid, "c", -1), "b");
});
test("they wrap at both ends, like the capsule on a Duo", () => {
  assert.equal(stepCard(grid, "d", 1), "a");
  assert.equal(stepCard(grid, "a", -1), "d");
});
test("not wrapping: nothing past the ends", () => {
  assert.equal(stepCard(grid, "d", 1, false), undefined);
  assert.equal(stepCard(grid, "a", -1, false), undefined);
  assert.equal(stepCard(grid, "b", 1, false), "c");
});
test("from the summary tile (not in the grid list): Next is the first, Previous the last", () => {
  assert.equal(stepCard(grid, "__summary", 1), "a");
  assert.equal(stepCard(grid, "__summary", -1), "d");
  assert.equal(stepCard(grid, null, 1, false), "a");
});
test("nothing to step to", () => {
  assert.equal(stepCard([], "a", 1), undefined);
  assert.equal(stepCard(["a"], "a", 1), "a");
});

// The reducer. Split: two panes fit (Duo wide, desktop >= 1050); narrow: they do not.
const split = { ids: grid, canSplit: true, wrap: true };
const narrow = { ids: grid, canSplit: false, wrap: true };
const run = (ctx, ...events) => events.reduce(({ state }, e) => inspector(state, e, ctx), { state: initialInspector, history: null });
const open = { type: "open", id: "b" };

test("open from the overview: a pane beside it where two fit, one new entry", () => {
  assert.deepEqual(run(split, open), { state: { selected: "b", full: false, depth: 1 }, history: "push" });
});
test("open where two panes do not fit: full screen, still one entry", () => {
  assert.deepEqual(run(narrow, open), { state: { selected: "b", full: true, depth: 1 }, history: "push" });
});
test("another card while one is open swaps it: same level, the entry replaced", () => {
  assert.deepEqual(run(split, open, { type: "open", id: "d" }), { state: { selected: "d", full: false, depth: 1 }, history: "replace" });
  const full = run(split, open, { type: "toggle" }, { type: "open", id: "d" });
  assert.deepEqual(full, { state: { selected: "d", full: true, depth: 2 }, history: "replace" });
});
test("toggle: full screen is a level of its own; back to side by side steps down to the pane's entry", () => {
  const up = run(split, open, { type: "toggle" });
  assert.deepEqual(up, { state: { selected: "b", full: true, depth: 2 }, history: "push" });
  assert.deepEqual(inspector(up.state, { type: "toggle" }, split), { state: { selected: "b", full: false, depth: 1 }, history: { go: -1 } });
});
test("toggle where two panes do not fit: nothing (there is no toggle)", () => {
  const r = run(narrow, open);
  assert.equal(inspector(r.state, { type: "toggle" }, narrow).state, r.state);
});
test("toggle of a card that opened full screen, now with room: its entry turns into the pane", () => {
  const r = run(narrow, open);
  assert.deepEqual(inspector(r.state, { type: "toggle" }, split), { state: { selected: "b", full: false, depth: 1 }, history: "replace" });
});
test("back: full screen to the pane, the pane to the overview", () => {
  const up = run(split, open, { type: "toggle" });
  const down = inspector(up.state, { type: "back" }, split);
  assert.deepEqual(down, { state: { selected: "b", full: false, depth: 1 }, history: { go: -1 } });
  assert.deepEqual(inspector(down.state, { type: "back" }, split), { state: initialInspector, history: { go: -1 } });
});
test("back where two panes do not fit: straight to the overview, over every level", () => {
  const up = run(split, open, { type: "toggle" });
  assert.deepEqual(inspector(up.state, { type: "back" }, narrow), { state: initialInspector, history: { go: -2 } });
});
test("close: the overview, back over every entry the inspector pushed", () => {
  assert.deepEqual(run(split, open, { type: "toggle" }, { type: "close" }), { state: initialInspector, history: { go: -2 } });
  assert.deepEqual(run(narrow, open, { type: "close" }), { state: initialInspector, history: { go: -1 } });
});
test("step: the next card in place, wrapping", () => {
  assert.deepEqual(run(split, { type: "open", id: "d" }, { type: "step", delta: 1 }), { state: { selected: "a", full: false, depth: 1 }, history: "replace" });
  const noWrap = { ...split, wrap: false };
  const end = run(noWrap, { type: "open", id: "d" });
  assert.equal(inspector(end.state, { type: "step", delta: 1 }, noWrap).state, end.state);
  assert.equal(inspector(end.state, { type: "step", delta: 1 }, noWrap).history, null);
});
test("pop: the browser's entry is the state; none is the overview", () => {
  const r = run(split, open, { type: "toggle" });
  assert.deepEqual(inspector(r.state, { type: "pop", state: { selected: "b", full: false, depth: 1 } }, split), { state: { selected: "b", full: false, depth: 1 }, history: null });
  assert.deepEqual(inspector(r.state, { type: "pop", state: null }, split), { state: initialInspector, history: null });
  // Forward onto a card's entry reopens it.
  assert.deepEqual(inspector(initialInspector, { type: "pop", state: { selected: "c", full: true, depth: 2 } }, split), { state: { selected: "c", full: true, depth: 2 }, history: null });
});
test("pop with no card on the overview changes nothing (same object)", () => {
  assert.equal(inspector(initialInspector, { type: "pop", state: null }, split).state, initialInspector);
});
test("pop of a card no longer on the page, or of another app's state: the overview", () => {
  const r = run(split, open);
  for (const state of [{ selected: "gone", full: false, depth: 1 }, { dashboard: 1 }, "x", { selected: "b" }])
    assert.deepEqual(inspector(r.state, { type: "pop", state }, split), { state: initialInspector, history: null });
});
test("pop where two panes do not fit: full screen", () => {
  assert.deepEqual(inspector(initialInspector, { type: "pop", state: { selected: "b", full: false, depth: 1 } }, narrow).state, { selected: "b", full: true, depth: 1 });
});
test("resize to no room: the pane goes full screen in its own entry; room again keeps it full", () => {
  const r = run(split, open);
  const full = inspector(r.state, { type: "resize", canSplit: false }, narrow);
  assert.deepEqual(full, { state: { selected: "b", full: true, depth: 1 }, history: "replace" });
  assert.equal(inspector(full.state, { type: "resize", canSplit: true }, split).state, full.state);
});
test("unknown ids and commands with no card open change nothing", () => {
  for (const e of [{ type: "open", id: "zz" }, { type: "toggle" }, { type: "back" }, { type: "close" }, { type: "step", delta: 1 }, { type: "resize", canSplit: false }]) {
    const r = inspector(initialInspector, e, split);
    assert.equal(r.state, initialInspector, e.type);
    assert.equal(r.history, null, e.type);
  }
  const b = run(split, open).state;
  assert.equal(inspector(b, open, split).state, b, "the open card again");
});

// The core bundles for an app without React (the wealth app's vanilla adaptive.js): it imports types only.
// organisms.ts (the organisms' pure parts, re-exported on `duet-ui/inspector`) stays inside the same closed set.
test("inspector.ts loads only glyphs.ts and organisms.ts at run time, organisms.ts only inspector.ts, glyphs.ts nothing", () => {
  const runtime = (f) => [...readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8").matchAll(/^(import|export)\s(?!type\s)[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[2]);
  assert.deepEqual(runtime("inspector.ts"), ["./glyphs.ts", "./organisms.ts"]);
  assert.deepEqual(runtime("organisms.ts"), ["./inspector.ts"]);
  assert.deepEqual(runtime("glyphs.ts"), []);
});
