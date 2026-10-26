// In-app Safari preview (SFSafariViewController) on the closed Duo: Duet's controls go into the free gap of the
// preview's own column, between its reader/menu button and its back button, and never touch a native button.
// Native frames are the e2e runner's XCUITest reads (Duo Lab Preview simulator, iOS 27.1, 2026-10-26), in screen
// points, matching the real Duo (iOS 18.7, Messages): reader/menu bottom ~281, back top ~429.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, plan, DUO } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 34,
  screenWidth: 466, screenHeight: 678, insetRight: 0, insetLeft: 0, standalone: false, pixelRatio: 3, userAgent: UA, angle: 0, ...o,
});
// origin: the page's top-left on screen. native: the preview's column buttons (48x48), screen points.
const BUTTONS = (x) => [["Cancel", x, 174], ["Page Menu", x, 234], ["Back", x, 428], ["Share", x, 488], ["Reload", x, 542], ["Open in Safari", x, 596]];
const PORTRAIT = {
  "page sheet": { s: sig(366, 600, 450, 670), origin: [8, 78], native: BUTTONS(386) },
  "full screen / default": { s: sig(382, 603, 466, 678), origin: [0, 75], native: BUTTONS(394) },
};

const SPECS = [];
for (const back of [false, true]) for (const leading of [0, 2]) for (const actions of [0, 1, 4]) for (const tabs of [0, 3, 5])
  for (const primary of [false, true]) SPECS.push({ back, leading, actions, tabs, primary, searchButton: !tabs, accessory: false, minimized: false });

const boxes = (p) => ["back", "primary", "leading", "actions", "more", "tabs", "searchButton"].filter((k) => p[k]).map((k) => [k, p[k]]);

for (const [name, { s, origin: [x0, y0], native }] of Object.entries(PORTRAIT)) {
  test(`preview ${name}: column mode on the right, flagged preview`, () => {
    const c = detect(s);
    assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", true]);
  });
  test(`preview ${name}: every control in the gap between the reader/menu and back buttons, centred on them`, () => {
    const c = detect(s);
    const menu = native.find(([n]) => n === "Page Menu"), back = native.find(([n]) => n === "Back");
    for (const spec of SPECS) {
      const p = plan(c, spec), tag = JSON.stringify(spec);
      assert.ok(Math.abs(x0 + p.centerX - (menu[1] + 24)) <= 1, `centre ${x0 + p.centerX} vs native ${menu[1] + 24} ${tag}`);
      assert.ok(p.more || (!boxes(p).length || spec.tabs || spec.searchButton), `something reachable ${tag}`);
      for (const [k, b] of boxes(p)) {
        const top = y0 + b.top, bottom = top + b.height;
        assert.ok(top >= menu[2] + 48 + DUO.gap - 0.5 && bottom <= back[2] - DUO.gap + 0.5, `${k} ${top}..${bottom} outside the gap ${tag}`);
        for (const [n, , ny] of native) assert.ok(bottom <= ny || top >= ny + 48, `${k} overlaps ${n} ${tag}`);
      }
    }
  });
  test(`preview ${name}: tabs and "…" both fit, the tabs minimized to the selected one`, () => {
    const p = plan(detect(s), { back: true, leading: 0, actions: 2, tabs: 3, primary: false, searchButton: false, accessory: false, minimized: false });
    assert.ok(p.more && p.tabs);
    assert.equal(p.tabs.min, true);
    assert.deepEqual(p.menu, { primary: false, back: true, leading: 0, actions: 2 });
  });
}

test("preview turned: the gap is ~26pt, so inline, on the side away from the preview's column", () => {
  const turned = (angle) => detect(sig(578, 388, 662, 458, { angle, screenWidth: 678, screenHeight: 466 }));
  assert.deepEqual([turned(90).mode, turned(90).side, turned(90).preview], ["inline", "right", true]);
  assert.deepEqual([turned(270).mode, turned(270).side, turned(270).preview], ["inline", "left", true]);
});

test("Open in Safari from the preview: a tab's column, the preview flag gone", () => {
  const c = detect(sig(382, 580, 466, 678, { insetBottom: 0 }));
  assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", undefined]);
});
