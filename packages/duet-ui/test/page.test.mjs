// Page placement: without children, column mode places the page in the visible viewport itself (insets 0,
// html shifted by the column when the document is scrolled across), so content starts just clear of the
// controls and is never clipped. reserve:false, children and the emulated column keep the inset contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageInsets, INLINE_WIDTH } from "../src/geometry.ts";

const env = (side) => `env(safe-area-inset-${side})`;
const base = { mode: "column", side: "right", split: false, screenWidth: 469, width: 385, hiddenPreview: false, inner: false, emulated: false, reserve: true, env };
const at = (o) => pageInsets({ ...base, ...o });

test("split, no children: page shifted by the column, no insets", () => {
  for (const side of ["left", "right"]) assert.deepEqual(at({ split: true, side }), { left: "0px", right: "0px", shift: 84 });
});

test("left column (closed, landscape 90): page shifted by the column", () => {
  assert.deepEqual(at({ side: "left", screenWidth: 678, width: 594 }), { left: "0px", right: "0px", shift: 84 });
});

test("right column: nothing to shift, no insets", () => {
  assert.deepEqual(at({ side: "right", screenWidth: 466, width: 382 }), { left: "0px", right: "0px", shift: 0 });
});

test("reserve:false opts out: page runs under the column, insets apply", () => {
  assert.deepEqual(at({ split: true, reserve: false }), { left: "84px", right: "0px", shift: 0 });
  assert.deepEqual(at({ side: "left", reserve: false }), { left: "84px", right: "0px", shift: 0 });
});

test("children: inner page owns its insets, no shift", () => {
  assert.deepEqual(at({ split: true, inner: true }), { left: "84px", right: "84px", shift: 0 });
  assert.deepEqual(at({ side: "right", inner: true }), { left: "0px", right: "84px", shift: 0 });
});

test("emulated column keeps the inset contract", () => {
  assert.deepEqual(at({ side: "right", emulated: true }), { left: "0px", right: "84px", shift: 0 });
});

test("inline and strip are unchanged", () => {
  assert.deepEqual(at({ mode: "inline" }), { left: env("left"), right: `${INLINE_WIDTH}px`, shift: 0 });
  assert.deepEqual(at({ mode: "strip" }), { left: env("left"), right: env("right"), shift: 0 });
});

test("hidden preview: no inset", () => {
  assert.deepEqual(at({ mode: "inline", hiddenPreview: true }), { left: env("left"), right: "0px", shift: 0 });
});
