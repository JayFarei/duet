// The organisms' pure parts (organisms.ts): what an inspectable card's tap leaves to its controls, the keys, the
// history entry and its repair, the viewer group's order, Duet's root attributes and scroll to top. Plain objects
// stand in for elements: `closest` over a parent chain, `contains` over descendants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hitsControl, inspectorKey, isTyping, withEntry, readEntry, needsRepair, inOrder, viewerStep, rootAttrs, scrollToTop, HISTORY_KEY } from "../src/organisms.ts";
import { inspector, initialInspector } from "../src/inspector.ts";

/** A fake element: `tag` matched against a comma list of plain tags and [attr] selectors, a parent chain. */
function el(tag, parent = null, attrs = {}) {
  const node = { tag, parent, attrs, parentElement: parent };
  const matches = (n, sel) => sel.split(",").map((s) => s.trim()).some((s) => {
    const attr = /^\[([a-z-]+)\]/.exec(s);
    if (attr) return attr[1] in n.attrs && !(s.includes(':not([contenteditable="false"])') && n.attrs[attr[1]] === "false");
    return s === n.tag;
  });
  node.closest = (sel) => { for (let n = node; n; n = n.parent) if (matches(n, sel)) return n; return null; };
  node.contains = (o) => { for (let n = o; n; n = n.parent) if (n === node) return true; return false; };
  return node;
}

test("hitsControl: a tap on the card's own text opens it, a control, link, field or editable text inside does not", () => {
  const card = el("article");
  const p = el("p", card), span = el("span", p);
  assert.equal(hitsControl(span, card), false);
  assert.equal(hitsControl(card, card), false);
  for (const [tag, attrs] of [["button", {}], ["a", {}], ["input", {}], ["select", {}], ["textarea", {}], ["div", { "data-duet-control": "" }], ["div", { contenteditable: "" }]]) {
    const c = el(tag, card, attrs), inner = el("svg", c);
    assert.equal(hitsControl(c, card), true, tag);
    assert.equal(hitsControl(inner, card), true, `inside ${tag}`);
  }
  assert.equal(hitsControl(el("div", card, { contenteditable: "false" }), card), false);
});

test("hitsControl: a text node is its parent; nothing, or a card that is itself a link, opens", () => {
  const card = el("article"), b = el("button", card);
  assert.equal(hitsControl({ parentElement: b }, card), true);
  assert.equal(hitsControl({ parentElement: card }, card), false);
  assert.equal(hitsControl(null, card), false);
  const link = el("a"), text = el("span", link);
  assert.equal(hitsControl(text, link), false);
  // A control outside the card (the card inside a button, say) is not the card's own.
  const outer = el("button"), inside = el("article", outer), word = el("span", inside);
  assert.equal(hitsControl(word, inside), false);
});

test("inspectorKey: Escape is back, the arrows step, modifiers, composition and fields keep their keys", () => {
  assert.equal(inspectorKey({ key: "Escape" }, false), "back");
  assert.equal(inspectorKey({ key: "Escape" }, true), "back");
  assert.equal(inspectorKey({ key: "ArrowDown" }, false), 1);
  assert.equal(inspectorKey({ key: "ArrowUp" }, false), -1);
  assert.equal(inspectorKey({ key: "ArrowDown" }, true), null);
  assert.equal(inspectorKey({ key: "ArrowLeft" }, false), null);
  for (const m of ["altKey", "ctrlKey", "metaKey", "shiftKey", "isComposing"]) {
    assert.equal(inspectorKey({ key: "ArrowDown", [m]: true }, false), null, m);
    assert.equal(inspectorKey({ key: "Escape", [m]: true }, false), null, m);
  }
});

test("isTyping: fields and editable text, not buttons", () => {
  assert.equal(isTyping(el("input")), true);
  assert.equal(isTyping(el("span", el("textarea"))), true);
  assert.equal(isTyping({ isContentEditable: true }), true);
  assert.equal(isTyping(el("button")), false);
  assert.equal(isTyping(null), false);
});

test("withEntry keeps the framework's state and readEntry reads ours back", () => {
  const s = { selected: "b", full: true, depth: 2 };
  const next = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: [1] };
  const w = withEntry(next, s);
  assert.equal(w.__NA, true);
  assert.deepEqual(w.__PRIVATE_NEXTJS_INTERNALS_TREE, [1]);
  assert.deepEqual(w[HISTORY_KEY], s);
  assert.deepEqual(readEntry(w), s);
  assert.deepEqual(withEntry(null, s), { [HISTORY_KEY]: s });
  assert.deepEqual(withEntry("x", s, "k"), { k: s });
  assert.equal(readEntry(null), null);
  assert.equal(readEntry({ other: 1 }), null);
  assert.equal(readEntry(w, "other"), null);
  assert.notEqual(w, next, "a new object, the old entry untouched");
  assert.equal(next[HISTORY_KEY], undefined);
});

test("needsRepair: only while a card is open and the entry lost or misstates its level", () => {
  const s = { selected: "b", full: false, depth: 1 };
  assert.equal(needsRepair(null, initialInspector), false);
  assert.equal(needsRepair({ __NA: true }, initialInspector), false);
  assert.equal(needsRepair(null, s), true);
  assert.equal(needsRepair({ __NA: true }, s), true);
  assert.equal(needsRepair(withEntry({ __NA: true }, s), s), false);
  assert.equal(needsRepair(withEntry(null, { ...s, full: true }), s), true);
  assert.equal(needsRepair(withEntry(null, { ...s, depth: 2 }), s), true);
  assert.equal(needsRepair(withEntry(null, { ...s, selected: "c" }), s), true);
});

test("a repaired entry brings the level back through the reducer's pop", () => {
  const ctx = { ids: ["a", "b", "c"], canSplit: true, wrap: true };
  const s = { selected: "b", full: false, depth: 1 };
  // The router replaced the entry: a pop to it reads as the overview...
  assert.deepEqual(inspector(s, { type: "pop", state: readEntry({ __NA: true }) }, ctx).state, initialInspector);
  // ...the repaired one as the pane.
  assert.deepEqual(inspector(initialInspector, { type: "pop", state: readEntry(withEntry({ __NA: true }, s)) }, ctx).state, s);
});

test("inOrder sorts by document position, not registration", () => {
  const pos = { x: 2, y: 0, z: 1 };
  assert.deepEqual(inOrder(["x", "y", "z"], (a, b) => pos[a] < pos[b]), ["y", "z", "x"]);
  assert.deepEqual(inOrder([], () => true), []);
  const items = ["b", "a"];
  inOrder(items, (a, b) => a < b);
  assert.deepEqual(items, ["b", "a"], "the input is left alone");
});

test("viewerStep goes round, stops at the ends without wrap, and is undefined alone", () => {
  const ids = ["a", "b", "c"];
  assert.equal(viewerStep(ids, "a", 1), "b");
  assert.equal(viewerStep(ids, "c", 1), "a");
  assert.equal(viewerStep(ids, "a", -1), "c");
  assert.equal(viewerStep(ids, "c", 1, false), undefined);
  assert.equal(viewerStep(ids, "a", -1, false), undefined);
  assert.equal(viewerStep(ids, "b", -1, false), "a");
  assert.equal(viewerStep(["a"], "a", 1), undefined);
  assert.equal(viewerStep([], "a", 1), undefined);
});

test("rootAttrs names the three attributes under the prefix, trailing dashes dropped", () => {
  const c = { device: "duo", layout: "wide", mode: "column" };
  const want = { "data-app-device": "duo", "data-app-layout": "wide", "data-app-mode": "column" };
  assert.deepEqual(rootAttrs("data-app", c), want);
  assert.deepEqual(rootAttrs("data-app-", c), want);
});

test("scrollToTop scrolls the scroller and the window", () => {
  const scroller = { scrollTop: 480 };
  const calls = [];
  scrollToTop(scroller, { scrollTo: (x, y) => calls.push([x, y]) });
  assert.equal(scroller.scrollTop, 0);
  assert.deepEqual(calls, [[0, 0]]);
  assert.doesNotThrow(() => scrollToTop(null));
});
