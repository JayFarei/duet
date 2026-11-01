// The docked section column (menu.dock): on the Duo's inner screen with the room, the places stay on screen beside
// the page. Measured windows from the simulator (iOS 27.1). The closed screen, split view, in-app preview and every
// other device never dock, so the burger keeps those.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect, sidebarInset } from "../src/geometry.ts";
import { TEMPLATE, frame, place, template } from "../src/template.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0,
  screenWidth: iw > ih ? 678 : 466, screenHeight: iw > ih ? 466 : 678, userAgent: IPHONE, touchPoints: 5, pixelRatio: 3, standalone: false, ...o,
});
const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");

test("the inner screen has room: Safari and the Home Screen, both ways up", () => {
  const cases = {
    "safari portrait": sig(669, 871, 669, 951),
    "safari portrait, tabs bar": sig(669, 825, 669, 951),
    "safari landscape": sig(951, 589, 951, 669),
    "safari landscape, short": sig(951, 497, 951, 669),
    "web app portrait": sig(669, 930, 669, 951, { standalone: true, insetTop: 61, insetBottom: 34 }),
    "web app landscape": sig(951, 648, 951, 669, { standalone: true, insetRight: 84, insetBottom: 34 }),
    "web app landscape, no insets yet (the boot script)": sig(951, 648, 951, 669, { standalone: true }),
    "request desktop website": sig(951, 589, 951, 669, { userAgent: MAC }),
  };
  for (const [name, s] of Object.entries(cases)) assert.equal(detect(s).dock, true, name);
});

test("no room, or not this screen: no dock", () => {
  const cases = {
    closed: sig(382, 580, 466, 678),
    "closed landscape": sig(594, 368, 678, 466),
    "closed landscape web app, 678 wide": sig(678, 466, 678, 466, { standalone: true, insetRight: 84 }),
    "split view": sig(385, 571, 469, 669),
    "narrow window inside the open screen": sig(480, 800, 480, 951),
    "ipad": sig(1180, 820, 1180, 820, { userAgent: MAC, screenWidth: 1180, screenHeight: 820 }),
    "ipad window the size of the open Duo": sig(669, 871, 669, 951, { userAgent: MAC, screenWidth: 820, screenHeight: 1180 }),
    desktop: sig(1440, 900, 1440, 980, { userAgent: MAC, touchPoints: 0, screenWidth: 1512, screenHeight: 982 }),
  };
  for (const [name, s] of Object.entries(cases)) assert.ok(!detect(s).dock, name);
});

test("the in-app preview filling the open screen keeps its own layout", () => {
  assert.ok(!detect(sig(653, 661, 669, 951, { insetBottom: 34 }), undefined, true, true).dock);
});

test("docked, the controls stay in the same room: the dock only takes the burger out of the template", () => {
  const c = detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84, insetBottom: 34 }));
  assert.equal(c.mode, "strip");
  const f = frame(c);
  assert.equal(f.cx, 951 - TEMPLATE.edge, "strip centre unchanged");
  const a = template(f, { close: false, menu: false, actions: 1, primary: false, rest: true, sidebar: false });
  assert.ok(!a.placed.some((g) => g.group.some((s) => s.kind === "menu")));
});

test("Home Screen landscape: a lone \"…\" rests at the strip's foot, not the middle (#254)", () => {
  const c = detect(sig(951, 648, 951, 669, { standalone: true, insetRight: 84, insetBottom: 34 }));
  const f = frame(c), [g] = place(f, [[{ kind: "more" }]]);
  assert.equal(g.rect.y + g.rect.h, f.bottom);
});

test("the open sidebar keeps clear of what the page keeps clear of, on a Duo only", () => {
  const split = { device: "duo", left: "84px", shift: 0 };
  assert.equal(sidebarInset(split), "84px", "split view with children: the page's own left inset");
  assert.equal(sidebarInset({ device: "duo", left: "0px", shift: 84 }), "84px", "without children the document is shifted instead");
  assert.equal(sidebarInset({ device: "duo", left: "0px", shift: 0 }), "0px", "right column");
  for (const device of ["ipad", "iphone", "desktop", "android"]) assert.equal(sidebarInset({ device, left: "84px", shift: 0 }), "0px", device);
});

test("CSS: the dock overrides the closed sidebar and places the page beside it, before anything mounts", () => {
  assert.match(css, /html\[data-duet-dock\] \.duet-sidebar\[data-dock\] \{[^}]*visibility: visible/);
  assert.match(css, /html\[data-duet-dock\] \.duet-sidebar\[data-dock\] ~ \.duet-scroller \{[^}]*left: /);
  assert.match(css, /html\[data-duet-dock\]:has\(\.duet-sidebar\[data-dock\]\[data-overlay\]\) \{[^}]*padding-left: /);
  assert.match(css, /--duet-dock: 220px/);
  assert.match(css, /\.duet-sidebar \{[^}]*padding: [^;]*calc\(14px \+ var\(--duet-sidebar-inset, 0px\)\)/);
});

test("the nav is server-rendered whenever the menu may dock, whatever the snapshot says", () => {
  assert.match(chrome, /data-dock=\{p\.menu\.dock \|\| undefined\}/);
  assert.match(chrome, /p\.menu && \(p\.menu\.burger !== false \|\| p\.menu\.dock\) && \(/);
});
