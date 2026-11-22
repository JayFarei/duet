// Where a card opens beside the overview (canSplit): one rule, Duet's own `layout` on a Duo and 1050 wide elsewhere.
// The oracle (test/fixtures/can-split.json) is the windows the two apps run in, as the device reports them; detect()
// derives each one's duo, layout and width, so a change to the posture rules that moves a window shows here too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { detect } from "../src/geometry.ts";
import { canSplit, SPLIT_WIDTH } from "../src/inspector.ts";
import { WINDOWS, opts } from "./arb.mjs";

const F = JSON.parse(readFileSync(new URL("./fixtures/can-split.json", import.meta.url), "utf8"));

for (const row of F) test(`${row.name}: ${row.canSplit ? "side by side" : "full screen"}`, () => {
  const c = detect(row.signals);
  assert.deepEqual({ duo: c.duo, layout: c.layout, width: c.width }, { duo: row.duo, layout: row.layout, width: row.width }, "detect()");
  assert.equal(canSplit(c), row.canSplit);
});

test("the oracle covers every window the brief names", () => {
  assert.equal(F.length, 17);
  assert.deepEqual(F.filter((r) => !r.duo && r.name.startsWith("Desktop")).map((r) => [r.width, r.canSplit]), [[1049, false], [1050, true], [1051, true], [1440, true]]);
});

test("off a Duo the threshold is the app's to move", () => {
  const d = { duo: false, layout: "wide", width: 900 };
  assert.equal(canSplit(d), false);
  assert.equal(canSplit(d, { offDuo: 900 }), true);
  assert.equal(SPLIT_WIDTH, 1050);
  // On a Duo only Duet's layout counts, whatever the width or threshold.
  assert.equal(canSplit({ duo: true, layout: "narrow", width: 2000 }, { offDuo: 100 }), false);
  assert.equal(canSplit({ duo: true, layout: "wide", width: 600 }), true);
});

// The Duo postures that split: the open screen either way up, and the closed screen turned at its full 678 (inline in
// Safari or a Home Screen app), which Duet already lays out wide. Everything narrower opens full screen.
const SPLITS = new Set(["wide", "tall", "home wide", "home tall", "closed turned inline", "home closed turned"]);

test("property: on a Duo, a posture splits exactly when Duet's layout is wide", () => {
  const duo = ["closed", "closed turned", "closed turned inline", "split", "split inline", "wide", "tall", "home closed", "home closed turned", "home wide", "home tall"];
  fc.assert(fc.property(fc.oneof(...duo.map((name) => WINDOWS[name].map((s) => ({ name, s })))), ({ name, s }) => {
    const c = detect(s);
    assert.ok(c.duo, name);
    assert.equal(canSplit(c), c.layout === "wide", name);
    assert.equal(canSplit(c), SPLITS.has(name), `${name} at ${c.width}`);
  }), opts());
});
