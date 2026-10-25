// Path of screens: which panes show at each layout, where back goes, and which layout each Duo window gets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { panes, backFrom } from "../src/panes.ts";
import { detect } from "../src/geometry.ts";

const PATH = ["sidebar", "list", "chat", "artifact"];
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih,
  insetTop: 0, insetBottom: 0, screenWidth: ow, screenHeight: oh, insetRight: 0, insetLeft: 0, standalone: false, ...o,
});

test("narrow shows the focused pane alone", () => {
  for (const [i, id] of PATH.entries()) assert.deepEqual(panes(PATH, id, "narrow"), { start: i, count: 1, visible: [id] });
});
test("wide shows the focused pane with the one before it, the first two at the root", () => {
  assert.deepEqual(panes(PATH, "sidebar", "wide").visible, ["sidebar", "list"]);
  assert.deepEqual(panes(PATH, "list", "wide").visible, ["sidebar", "list"]);
  assert.deepEqual(panes(PATH, "chat", "wide").visible, ["list", "chat"]);
  assert.deepEqual(panes(PATH, "artifact", "wide"), { start: 2, count: 2, visible: ["chat", "artifact"] });
});
test("a one-pane path or an unknown id never breaks the window", () => {
  assert.deepEqual(panes(["only"], "only", "wide"), { start: 0, count: 1, visible: ["only"] });
  assert.deepEqual(panes(PATH, "nope", "narrow").visible, ["sidebar"]);
});
test("back steps along the path, and only when the screen would change", () => {
  assert.equal(backFrom(PATH, "sidebar", "narrow"), null);
  assert.equal(backFrom(PATH, "list", "narrow"), "sidebar");
  assert.equal(backFrom(PATH, "list", "wide"), null); // sidebar already shows beside it
  assert.equal(backFrom(PATH, "chat", "wide"), "list");
});
test("wide only where two panes fit: open full width, not closed, split view or closed landscape", () => {
  assert.equal(detect(sig(951, 543, 951, 669)).layout, "wide");
  assert.equal(detect(sig(382, 580, 466, 678)).layout, "narrow"); // closed Safari, column
  assert.equal(detect(sig(385, 571, 469, 669)).layout, "narrow"); // split-view pane
  assert.equal(detect(sig(594, 368, 678, 466)).layout, "narrow"); // closed landscape
  assert.equal(detect(sig(382, 657, 466, 678, { insetRight: 84, standalone: true })).layout, "narrow"); // strip
});
