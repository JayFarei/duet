// menu.tabs: the app's places are tabs in the capsule when every one fits, and the burger when they do not. All or
// nothing, decided from the window alone. Windows measured on the Duo simulator (iOS 27.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect } from "../src/geometry.ts";
import { allocate, frame, placesFit, template } from "../src/template.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0,
  screenWidth: 466, screenHeight: 678, userAgent: IPHONE, touchPoints: 5, pixelRatio: 3, standalone: false, ...o,
});
const kinds = (groups) => groups.map((g) => g.map((s) => s.kind === "place" ? `p${s.index}` : s.kind === "action" ? s.index : s.kind));
const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");

const closed = detect(sig(382, 580, 466, 678)), split = detect(sig(385, 571, 469, 669));

test("placesFit: all of them in one capsule, with room for \"…\" when anything else competes", () => {
  const left = { ...split, side: "left" }, right = { ...split, side: "right" };
  assert.equal(placesFit(left, 6, false), true);
  assert.equal(placesFit(left, 6, true), false, "\"…\" takes a slot");
  assert.equal(placesFit(left, 5, true), true);
  assert.equal(placesFit(right, 2, false), true);
  assert.equal(placesFit(right, 3, false), false);
  assert.equal(placesFit(closed, 3, false), false);
  assert.equal(placesFit(closed, 2, false), true);
});

test("placesFit: no places is not tabs, and the preview's one button is never tabs", () => {
  assert.equal(placesFit(detect(sig(669, 871, 669, 951)), 0, false), false);
  assert.equal(placesFit({ ...closed, preview: true }, 1, false), false);
});

test("placesFit: Safari's bar collapsing on a scroll does not flip it, the smallest height rules", () => {
  // An inline window whose height grew on a scroll: 5 fit at 300, not at 260.
  const c = detect(sig(390, 300, 390, 400, { screenWidth: 390, screenHeight: 844, userAgent: IPHONE }));
  const n = (x) => { let k = 0; while (placesFit(x, k + 1, true)) k++; return k; };
  assert.equal(n({ ...c, stableHeight: 200 }), n({ ...c, height: 200, stableHeight: 200 }));
});

test("the actions and the primary fold first, and a place never does", () => {
  const a = allocate(1000, 2, { places: 5, primary: true, rest: true });
  assert.deepEqual(kinds(a.groups), [["p0", "p1", "p2", "p3", "p4", 0, 1, "more"], ["primary"]]);
  const b = allocate(49 + 5 * 51.7, 2, { places: 5, primary: true });
  assert.deepEqual(kinds(b.groups), [["p0", "p1", "p2", "p3", "p4", "more"]]);
  assert.deepEqual([b.shown, b.primary], [0, false]);
  for (let h = 49 + 5 * 51.7; h < 700; h += 7) {
    const c = allocate(h, 4, { places: 5, primary: true });
    assert.deepEqual(c.groups[0].slice(0, 5).map((s) => s.kind), Array(5).fill("place"), `${h}`);
  }
});

test("template: a sheet's close and the preview's \"…\" still come first, and tabs have no burger", () => {
  const c = detect(sig(669, 871, 669, 951)), f = frame(c);
  assert.deepEqual(kinds(template(f, { close: true, places: 5, actions: 1 }).groups), [["close"]]);
  assert.deepEqual(kinds(template(f, { places: 3, actions: 0 }).groups), [["p0", "p1", "p2"]]);
  assert.ok(!template(f, { places: 3, actions: 1 }).groups.flat().some((s) => s.kind === "menu"));
});

test("without places the template is what it was", () => {
  for (const o of [{ menu: true }, { menu: true, primary: true }, { rest: true }, {}])
    for (let h = 49; h < 500; h += 31) assert.deepEqual(allocate(h, 3, { ...o, places: 0 }), allocate(h, 3, o));
});

test("the chrome: the server's guess stays hidden for an opted-in menu, and a selected place stays a tab", () => {
  assert.match(chrome, /data-hidden=\{ctx\.hidden \?\? \(p\.menu\?\.tabs && !ctx\.confidence \? "pending" : undefined\)\}/);
  assert.match(chrome, /data-tab=\{s\.kind === "place" \|\|/);
  assert.match(chrome, /aria-current=\{\(s\.kind === "place" && menuItems\[s\.index\]\.id === selected\)/);
});

test("the dock is gone: no public option, attribute or variable", () => {
  const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8"), geo = readFileSync(new URL("../src/geometry.ts", import.meta.url), "utf8");
  for (const s of [chrome, css, geo]) assert.doesNotMatch(s, /duet-dock|menu\.dock|\bdock\?/);
  assert.equal(detect(sig(669, 871, 669, 951)).dock, undefined);
});

test("chrome: a place without an icon stays behind the burger, for callers the types do not reach", () => {
  assert.match(chrome, /p\.menu\?\.tabs && menuItems\.every\(\(i\) => i\.icon\) && placesFit\(/);
});

test("placesFit: a Duo Home Screen app reads the strip's room while its inset is still landing", () => {
  const landing = detect(sig(466, 657, 466, 678, { standalone: true }));
  const landed = detect(sig(466, 657, 466, 678, { standalone: true, insetRight: 84 }));
  for (const n of [3, 5, 6, 7, 9]) assert.equal(placesFit(landing, n, true), placesFit(landed, n, true), `n=${n}`);
  assert.equal(placesFit(landed, 5, true), true);
  // Turning to wide passes 951x587 with a stale reading of the height: the same answer as landed at 951x648.
  const turning = detect(sig(951, 587, 951, 669, { standalone: true }));
  const wide = detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84 }));
  for (const n of [5, 6, 7]) assert.equal(placesFit(turning, n, true), placesFit(wide, n, true), `wide n=${n}`);
  assert.equal(placesFit(wide, 6, true), true);
  assert.equal(placesFit(wide, 7, true), false);
});

test("placesFit: the inner screen upright as a Home Screen app is inline, with more room than the strip", () => {
  const tall = detect(sig(669, 869, 669, 951, { standalone: true, insetBottom: 34 }));
  assert.equal(placesFit(tall, 7, true), true);
});
