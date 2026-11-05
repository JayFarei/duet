// The burger's sheet on the Duo: closes when its layout goes away, and reaches the screen's foot in the column. Windows
// measured on the simulator (iOS 27.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect, sheetLayout } from "../src/geometry.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0,
  screenWidth: 466, screenHeight: 678, userAgent: IPHONE, touchPoints: 5, pixelRatio: 3, standalone: false, ...o,
});
const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");
const key = (s) => sheetLayout(detect(s));

test("a Duo's sheet layout changes across a resize out of a split pane, and a fold", () => {
  const pane = key(sig(385, 571, 469, 669));
  assert.notEqual(pane, key(sig(951, 543, 951, 669)), "split pane to full screen");
  assert.notEqual(key(sig(951, 543, 951, 669)), key(sig(382, 580, 466, 678)), "open screen to closed");
});

test("a Duo's sheet layout holds while Safari's bar compacts", () => {
  assert.equal(key(sig(385, 571, 469, 669)), key(sig(385, 589, 469, 669)));
});

test("other devices have no sheet layout to lose: their output does not change", () => {
  const ipad = (w, h) => sig(w, h, w, h, { userAgent: MAC, screenWidth: 1180, screenHeight: 820 });
  assert.equal(key(ipad(1180, 820)), key(ipad(590, 820)));
  const phone = (w, h) => sig(w, h, w, h, { screenWidth: 393, screenHeight: 852 });
  assert.equal(key(phone(393, 660)), key(phone(852, 300)));
  const desk = (w, h) => sig(w, h, w, h, { userAgent: MAC, touchPoints: 0, screenWidth: 1512, screenHeight: 982 });
  assert.equal(key(desk(1440, 900)), key(desk(500, 900)));
});

test("the sheet closes on that change", () => {
  assert.match(chrome, /useEffect\(\(\) => \{ send\(\{ type: "sheet" \}\); \}, \[sheet\]\);/);
});

test("in the column the open sheet paints down behind Safari's bar, with its rows still ending above it", () => {
  assert.match(css, /html\[data-duet-mode="column"\] \.duet-sidebar\[data-open\] \{ box-shadow: 0 240px 0 var\(--duet-solid\), var\(--duet-sidebar-inset, 0px\) 0 0 var\(--duet-solid\), var\(--duet-sidebar-inset, 0px\) 240px 0 var\(--duet-solid\); \}/);
  assert.match(css, /html\[data-duet-mode="column"\] \.duet-sidebar \{[^}]*height: var\(--duet-vh, 100vh\)/);
});

test("split view, right pane: the open sheet clears Safari's column on the far edge, which the page cannot tell from the near one", () => {
  // The slid page ran from x -84 by the 469pt screen width, leaving its Canvas card over the 84pt strip beside the rail.
  assert.match(chrome, /translate: slid && sidebar === "open" \? `calc\(\$\{slide\}px \+ \$\{clear\}\) 0` : undefined/);
});

test("split view, right pane: the card moving through the strip is the rail's colour unless the page names its own, not Canvas white", () => {
  assert.match(css, /html\[data-duet-mode="column"\] \.duet-scroller\[data-slid\] \{ background: var\(--duet-page, var\(--duet-solid\)\); \}/);
});
