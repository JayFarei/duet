// menu.tabs: the app's places are tabs in the capsule when every one fits. Otherwise the first ones stay tabs and the
// rest go in "…", and the burger only when fewer than 3 would show. Decided from the window alone (placeTabs). Windows
// measured on the Duo simulator (iOS 27.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect } from "../src/geometry.ts";
import { allocate, canMoveControls, frame, landingRoom, menuBox, morphHeight, place, placesFit, placeTabs, FEWEST_TABS, TEMPLATE, TIGHTEST_TAB_PITCH, template } from "../src/template.ts";

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
  assert.equal(placesFit(left, 7, false), true);
  assert.equal(placesFit(left, 7, true), false, "\"…\" takes a slot");
  assert.equal(placesFit(left, 6, true), true);
  assert.equal(placesFit(right, 2, false), true);
  assert.equal(placesFit(right, 3, false), false);
  assert.equal(placesFit(closed, 3, false), false);
  assert.equal(placesFit(closed, 2, false), true);
});

test("placeTabs: the normal pitch while it fits, then tighter down to the floor, then the rest fold into \"…\"", () => {
  const wide = detect(sig(669, 543, 669, 951));
  assert.deepEqual(placeTabs(wide, 8, true), { shown: 8, pitch: TEMPLATE.item }, "exactly what it was while it fits");
  const nine = placeTabs(wide, 9, true);
  assert.equal(nine.shown, 9);
  assert.ok(nine.pitch < TEMPLATE.item && nine.pitch >= TIGHTEST_TAB_PITCH, "9 tighten");
  assert.equal(placeTabs(wide, 11, true).shown, 10, "the 11th folds");
  assert.deepEqual(placeTabs(wide, 20, true), placeTabs(wide, 11, true), "however many there are");
});

test("placeTabs: 9 places on a wide Home Screen are 7 tabs and \"…\" at 48.6", () => {
  const wide = detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84 }));
  assert.deepEqual(placeTabs(wide, 9, false), { shown: 7, pitch: 48.6 });
  assert.deepEqual(placeTabs(wide, 8, false), { shown: 8, pitch: 48.6 }, "8 fit without \"…\"");
  assert.deepEqual(placeTabs(wide, 8, true), { shown: 7, pitch: 48.6 }, "beside \"…\", the 8th folds");
});

test("placeTabs: the widest pitch that holds them, never past the normal one", () => {
  const left = { ...split, side: "left" };
  const most = placeTabs(left, 20, false);
  assert.equal(most.shown, 6);
  assert.ok(most.pitch <= TEMPLATE.item && most.pitch >= TIGHTEST_TAB_PITCH);
  for (let n = 1; n <= 30; n++) for (const rest of [true, false]) {
    const t = placeTabs(left, n, rest);
    if (t.shown < n) assert.deepEqual(t, most, `n=${n}`);
  }
});

test("placeTabs: the burger only where fewer than three would show", () => {
  const right = { ...split, side: "right" }, turned = detect(sig(594, 368, 678, 466, { angle: 90 }));
  assert.equal(FEWEST_TABS, 3);
  for (const c of [closed, right, turned]) for (const n of [3, 4, 9]) assert.equal(placeTabs(c, n, true), undefined);
  assert.equal(placeTabs(closed, 3, false), undefined, "two places and \"…\" is not worth it");
  assert.deepEqual(placeTabs(closed, 2, false), { shown: 2, pitch: TEMPLATE.item }, "all of them still fit");
  assert.deepEqual(placeTabs(closed, 1, true), { shown: 1, pitch: TEMPLATE.item }, "all of them still fit");
  assert.equal(placeTabs({ ...closed, preview: true }, 9, true), undefined);
});

test("template: overflow is the shown tabs and \"…\", whatever the actions, at any pitch", () => {
  const f = frame(detect(sig(669, 543, 669, 951)));
  for (const tabPitch of [TEMPLATE.item, 47]) {
    const { placed, primary, shown } = template(f, { places: 4, actions: 3, primary: true, rest: true, tabPitch, overflow: true });
    assert.deepEqual(placed.map((g) => g.group.map((s) => s.kind)), [["place", "place", "place", "place", "more"]]);
    assert.deepEqual(placed[0].group.slice(0, 4).map((s) => s.index), [0, 1, 2, 3], "the app's order");
    assert.equal(placed[0].pitch, tabPitch);
    assert.equal(shown, 0, "every action is in the list"); assert.equal(primary, false);
  }
});

test("chrome: \"…\" lists only the folded places, first, and takes the bubble when the selected one is there", () => {
  assert.match(chrome, /tabbed \? menuItems\.slice\(tabbed\.shown\)/);
  assert.match(chrome, /overflow && places\.some\(\(m\) => m\.id === p\.menu!\.selected\)/);
  assert.match(chrome, /s\.kind === "more" && moreSelected\) \? "page"/);
  assert.match(chrome, /role="menuitemradio" aria-checked=\{m\.id === selected\}/);
  assert.match(chrome, /list\.length > 0 \|\| !placesFirst/);
});

test("template: tight tabs are one capsule with \"…\", every button at the one pitch, inside the band", () => {
  const wide = detect(sig(669, 543, 669, 951)), f = frame(wide), tabPitch = placeTabs(wide, 9, true).pitch;
  const { placed, primary, shown } = template(f, { places: 9, actions: 2, primary: true, rest: true, tabPitch });
  assert.equal(placed.length, 1);
  assert.deepEqual(placed[0].group.map((s) => s.kind), [...Array(9).fill("place"), "more"]);
  assert.equal(placed[0].pitch, tabPitch);
  assert.equal(placed[0].rect.h, TEMPLATE.control + 9 * tabPitch);
  assert.ok(placed[0].rect.y >= f.top - 12 && placed[0].rect.y + placed[0].rect.h <= f.bottom + 12);
  assert.equal(shown, 0); assert.equal(primary, false);
});

test("template: an action group keeps the normal pitch whatever the tabs do", () => {
  const f = frame(detect(sig(669, 869, 669, 951)));
  const { placed } = template(f, { actions: 3, tabPitch: 45 });
  for (const g of placed) assert.equal(g.pitch, TEMPLATE.item);
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
  assert.match(chrome, /p\.menu\?\.tabs && menuItems\.every\(\(i\) => i\.icon\) \? placeTabs\(/);
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
  assert.equal(placesFit(wide, 7, true), true);
  assert.equal(placesFit(wide, 8, true), false);
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
  const overflow = (c) => placeTabs(c, 30, false)?.shown ?? "burger";
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
  assert.match(chrome, /hasRest = \(c: Context\) => .*\|\| movable\(c\);/);
  const doc = readFileSync(new URL("../../../docs/how-duet-decides.md", import.meta.url), "utf8");
  for (const [name, c] of Object.entries(windows)) {
    const row = doc.match(new RegExp(`^\\| ${name}[^|]*\\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\|$`, "m"));
    assert.ok(row, name);
    assert.deepEqual([row[1], row[2], row[3]].map((x) => x === "burger" ? x : +x), [most(c, true), most(c, false), overflow(c)], name);
  }
});

test("moveControls: only a window that can change edge offers the move, and only when the app asks", () => {
  assert.equal(canMoveControls(detect(sig(951, 543, 951, 669))), true); // Safari full screen
  assert.equal(canMoveControls(detect(sig(669, 869, 669, 951, { standalone: true, insetBottom: 34 }))), true); // Home Screen, tall: inline
  assert.equal(canMoveControls(detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84 }))), false); // Home Screen, wide: the strip
  assert.equal(canMoveControls(detect(sig(951, 648, 951, 669, { standalone: true }))), false); // the same, before its inset lands
  assert.equal(canMoveControls(detect(sig(466, 657, 466, 678, { standalone: true, insetRight: 84 }))), false); // closed Home Screen
  assert.equal(canMoveControls(closed), false); // Safari's column
  assert.match(chrome, /movable = \(c: Context\) => !!p\.moveControls && canMoveControls\(c\)/);
  assert.match(chrome, /useSideDrag\(movable\(ctx\) \? ctx\.side : null,/);
  assert.match(chrome, /if \(!sideChoice\) return undefined;/);
});

test("the docs do not describe the removed docked column", () => {
  for (const f of ["server-rendering", "api", "how-duet-decides", "edge-cases"]) {
    const doc = readFileSync(new URL(`../../../docs/${f}.md`, import.meta.url), "utf8");
    assert.doesNotMatch(doc, /data-duet-dock|--duet-dock|\(api\.md#docked-column/, f);
  }
});

test("closed Home Screen turned: the capsule stays on the 466pt screen, whichever way screen.* reads", () => {
  for (const [sw, sh] of [[466, 678], [678, 466]]) {
    const c = detect(sig(678, 445, 466, 678, { standalone: true, insetRight: 84, insetBottom: 34, screenWidth: sw, screenHeight: sh }));
    assert.equal(c.mode, "strip");
    assert.deepEqual(placeTabs(c, 9, true), { shown: 7, pitch: 48.6 });
    assert.equal(placesFit(c, 8, false), true);
    const f = frame(c);
    assert.equal(Math.round(f.bottom - f.top), 389, "the same room as upright");
    const [{ rect }] = place(f, [[{ kind: "place", index: 0 }, ...Array(7).fill({ kind: "more" })]], 48.6);
    assert.ok(rect.y >= 0 && rect.y + rect.h <= 445, "on the screen");
  }
});
