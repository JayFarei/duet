// menu.tabs: the app's places are tabs in the capsule when every one fits, and the burger when they do not. All or
// nothing, decided from the window alone. Windows measured on the Duo simulator (iOS 27.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect } from "../src/geometry.ts";
import { allocate, frame, landingRoom, menuBox, morphHeight, placesFit, template } from "../src/template.ts";

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

// Defects found on the simulator once places made the capsule tall.
test("the \"…\" panel of a menu.tabs app ends at the list's size, from a capsule taller or shorter than the list", () => {
  assert.equal(morphHeight(411, 200, 1, 1, true), 200, "taller capsule");
  assert.equal(morphHeight(49, 200, 1, 1, true), 200, "shorter capsule");
  assert.equal(morphHeight(411, 200, 0, 1, true), 411, "starts as the capsule");
  // A short capsule's path is what it was: the swell, then the list.
  for (const [t, sw] of [[0, 1], [0.1, 1.2], [0.5, 1.1], [0.9, 1]]) assert.equal(morphHeight(49, 200, t, sw, true), Math.max(49 * sw, 49 + 151 * t));
});

test("the \"…\" panel of any other app keeps 0.8.0-rc.2's height, whatever the capsule", () => {
  for (const [from, box] of [[152, 82], [411, 82], [49, 200]])
    for (const [t, sw] of [[0, 1], [0.1, 1.2], [0.5, 1.1], [0.9, 1], [1, 1]])
      assert.equal(morphHeight(from, box, t, sw, false), Math.max(from * sw, from + (box - from) * t), `${from} to ${box} at ${t}`);
  assert.equal(morphHeight(152, 82, 1, 1, false), 152, "the capsule's height, as tagged");
});

test("the box a tall capsule grows into stays in the page", () => {
  for (const c of [detect(sig(951, 543, 951, 669)), detect(sig(669, 869, 669, 951, { standalone: true, insetBottom: 34 })), { ...split, side: "left" }]) {
    const f = frame(c), g = template(f, { places: 5, actions: 2, rest: false }).placed[0];
    const b = menuBox(f, g.rect, 2);
    assert.ok(b.y >= 0 && b.y + b.h <= c.height - 12, `${c.width}x${c.height}: ${b.y}+${b.h}`);
  }
});

test("a Home Screen tabs app allocates its actions from the strip's room while the inset lands, so nothing refolds", () => {
  const forms = (c) => kinds(template(frame(c), { room: landingRoom(c), places: 5, actions: 2, rest: true }).groups);
  const wide = detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84 }));
  for (const c of [detect(sig(951, 648, 951, 669, { standalone: true })), detect(sig(951, 587, 951, 669, { standalone: true }))]) {
    assert.equal(c.mode, "inline");
    assert.deepEqual(forms(c), forms(wide));
  }
  assert.deepEqual(forms(wide), [["p0", "p1", "p2", "p3", "p4", 0, "more"]]);
  assert.deepEqual(forms(detect(sig(466, 657, 466, 678, { standalone: true }))), forms(detect(sig(466, 657, 466, 678, { standalone: true, insetRight: 84 }))));
  // Not a Home Screen app, or the inner screen upright: the window's own band.
  assert.equal(landingRoom(detect(sig(951, 543, 951, 669))), undefined);
  assert.equal(landingRoom(detect(sig(669, 869, 669, 951, { standalone: true, insetBottom: 34 }))), undefined);
});

test("a new window on a Duo closes \"…\", other devices keep what they did", () => {
  assert.match(chrome, /setMore\("closed"\); setArmed\(false\); setAsk\("closed"\); \}, \[tabsKey, ctx\.duo && `\$\{ctx\.mode\} \$\{ctx\.width\}`\]\)/);
});

test("one button of room in a tabs app: the places lead \"…\"", () => {
  const turned = detect(sig(594, 368, 678, 466, { angle: 90 }));
  assert.deepEqual(kinds(template(frame(turned), { menu: true, actions: 2 }).groups), [["more"]]);
  assert.deepEqual(kinds(template(frame(turned), { menu: true, actions: 0 }).groups), [["menu"]]);
  assert.match(chrome, /placesFirst = !!p\.menu\?\.tabs && askAt !== moreAt/);
  assert.ok(chrome.indexOf("{placesFirst && placeRows}") < chrome.indexOf("{!placesFirst && placeRows}"));
});

test("the docs' table is the rule", () => {
  const most = (c, rest) => { let k = 0; while (k < 20 && placesFit(c, k + 1, rest)) k++; return k; };
  const standalone = { standalone: true };
  const windows = {
    "Safari full screen, wide": detect(sig(951, 543, 951, 669)),
    "Safari full screen, tall": detect(sig(669, 825, 669, 951)),
    "Home Screen, wide": detect(sig(951, 648, 951, 669, { ...standalone, insetRight: 84 })),
    "Home Screen, tall": detect(sig(669, 869, 669, 951, { ...standalone, insetBottom: 34 })),
    "Split View, left": { ...split, side: "left" },
    "Split View, right": { ...split, side: "right" },
    "Closed Safari, upright": closed,
    "Closed Safari, turned": detect(sig(594, 368, 678, 466, { angle: 90 })),
    "Closed Home Screen": detect(sig(466, 657, 466, 678, { ...standalone, insetRight: 84 })),
  };
  const doc = readFileSync(new URL("../../../docs/how-duet-decides.md", import.meta.url), "utf8");
  for (const [name, c] of Object.entries(windows)) {
    const row = doc.match(new RegExp(`^\\| ${name}[^|]*\\| ([^|]+) \\| ([^|]+) \\|$`, "m"));
    assert.ok(row, name);
    assert.deepEqual([row[1], row[2]].map((x) => +x), [most(c, true), most(c, false)], name);
  }
});
