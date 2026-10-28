// In-app Safari preview (SFSafariViewController) on the closed Duo: Duet's controls go into the free gap of the
// preview's own column, between its reader/menu button and its back button, and never touch a native button.
// Native frames are the e2e runner's XCUITest reads (Duo Lab Preview simulator, iOS 27.1, 2026-10-26), in screen
// points, matching the real Duo (iOS 18.7, Messages): reader/menu bottom ~281, back top ~429. Live Activities push
// Cancel and Page Menu down (one: ~45pt, device, 2026-10-27), assumed DUO.island at worst; Back stays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, plan, stable, DUO, PREVIEW_RISE } from "../src/geometry.ts";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const sig = (iw, ih, ow, oh, o = {}) => ({
  innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, visualHeight: ih, insetTop: 0, insetBottom: 34,
  screenWidth: 466, screenHeight: 678, insetRight: 0, insetLeft: 0, standalone: false, pixelRatio: 3, userAgent: UA, angle: 0, ...o,
});
// origin: the page's top-left on screen. native: the preview's column buttons (48x48), screen points.
const BUTTONS = (x, push = 0) => [["Cancel", x, 174 + push], ["Page Menu", x, 234 + push], ["Back", x, 428], ["Share", x, 488], ["Reload", x, 542], ["Open in Safari", x, 596]];
// Scrolled, the default and full styles compact their top bar (75 -> 46pt chrome) and the page grows up under it.
const PORTRAIT = {
  "page sheet": { s: sig(366, 600, 450, 670), origin: [8, 78], x: 386 },
  "full screen / default": { s: sig(382, 603, 466, 678), origin: [0, 75], x: 394 },
  "full screen / default, scrolled": { s: sig(382, 632, 466, 678), origin: [0, 46], x: 394 },
};

const SPECS = [];
for (const back of [false, true]) for (const leading of [0, 2]) for (const actions of [0, 1, 4]) for (const tabs of [0, 3, 5])
  for (const primary of [false, true]) SPECS.push({ back, leading, actions, tabs, primary, searchButton: !tabs, accessory: false, minimized: false });

const boxes = (p) => ["back", "primary", "leading", "actions", "more", "tabs", "searchButton"].filter((k) => p[k]).map((k) => [k, p[k]]);

for (const [name, { s, origin: [x0, y0], x }] of Object.entries(PORTRAIT)) {
  test(`preview ${name}: column mode on the right, flagged preview`, () => {
    const c = detect(s);
    assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", true]);
  });
  test(`preview ${name}: every control clear of the native buttons, with or without Live Activities, centred on them`, () => {
    const c = detect(s);
    for (const native of [BUTTONS(x), BUTTONS(x, DUO.island)]) {
      const menu = native.find(([n]) => n === "Page Menu"), back = native.find(([n]) => n === "Back");
      for (const spec of SPECS) {
        const p = plan(c, spec), tag = JSON.stringify(spec);
        assert.ok(Math.abs(x0 + p.centerX - (menu[1] + 24)) <= 1, `centre ${x0 + p.centerX} vs native ${menu[1] + 24} ${tag}`);
        assert.ok(p.more || spec.tabs || spec.searchButton || !boxes(p).length, `something reachable ${tag}`);
        for (const [k, b] of boxes(p)) {
          const top = y0 + b.top, bottom = top + b.height;
          assert.ok(top >= menu[2] + 48 - 0.5 && bottom <= back[2] + 0.5, `${k} ${top}..${bottom} outside the gap ${tag}`);
          for (const [n, , ny] of native) assert.ok(bottom <= ny || top >= ny + 48, `${k} overlaps ${n} ${tag}`);
        }
      }
    }
  });
  test(`preview ${name}: one button at worst, the selected tab, its menu holding the rest`, () => {
    const p = plan(detect(s), { back: true, leading: 0, actions: 2, tabs: 3, primary: false, searchButton: false, accessory: false, minimized: false });
    assert.ok(!p.more && !p.rail);
    assert.deepEqual([p.tabs.min, p.tabs.merged], [true, true]);
    assert.deepEqual(p.menu, { primary: false, back: true, leading: 0, actions: 2 });
    // Centred in the worst-case gap, the same room above and below.
    const top = y0 + p.tabs.top, above = top - (234 + DUO.island + 48), below = 428 - (top + DUO.control);
    assert.ok(above > 0 && Math.abs(above - below) < 0.5, `${above} above, ${below} below`);
  });
  test(`preview ${name}: "…" alone where there are no tabs and no search button`, () => {
    const p = plan(detect(s), { back: true, leading: 2, actions: 1, tabs: 0, primary: true, searchButton: false, accessory: false, minimized: false });
    assert.deepEqual(boxes(p).map(([k]) => k), ["more"]);
  });
  test(`preview ${name}: a sheet's close (back alone) shows itself, centred in the gap, not folded into "…" (#142)`, () => {
    const p = plan(detect(s), { back: true, leading: 0, actions: 0, tabs: 0, searchButton: false, accessory: false, minimized: false, menuExtra: 0 });
    assert.deepEqual(boxes(p).map(([k]) => k), ["back"]);
    assert.equal(p.menu.back, false);
    const top = y0 + p.back.top, above = top - (234 + DUO.island + 48), below = 428 - (top + DUO.control);
    assert.ok(above > 0 && Math.abs(above - below) < 0.5, `${above} above, ${below} below`);
  });
}

test("preview turned: the gap is ~26pt, so inline, on the side away from the preview's column", () => {
  const turned = (angle) => detect(sig(578, 388, 662, 458, { angle, screenWidth: 678, screenHeight: 466 }));
  assert.deepEqual([turned(90).mode, turned(90).side, turned(90).preview], ["inline", "right", true]);
  assert.deepEqual([turned(270).mode, turned(270).side, turned(270).preview], ["inline", "left", true]);
});

test("preview scrolled: every frame of the top bar compacting (75 -> 46pt chrome) stays the preview's column", () => {
  for (const chrome of [75, 70, 65, 58, 53, 49, 47, 46]) {
    const c = detect(sig(382, 678 - chrome, 466, 678));
    assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", true], `chrome ${chrome}`);
  }
});

test("preview scrolled through stable(): the mode and preview flag hold while the top bar compacts and returns", () => {
  const d = { flips: [] };
  [75, 70, 58, 47, 46, 46, 53, 65, 75].forEach((chrome, i) => {
    const c = stable(d, sig(382, 678 - chrome, 466, 678), undefined, PREVIEW_RISE + 100 * i, chrome !== 75);
    assert.deepEqual([c.mode, c.preview], ["column", true], `frame ${i}, chrome ${chrome}`);
  });
});

test("Open in Safari from the preview: a tab's column, the preview flag gone", () => {
  const c = detect(sig(382, 580, 466, 678, { insetBottom: 0 }));
  assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", undefined]);
});

// Forward history (#117): going back gives the preview a Forward button where Back was (428) and moves Back up a row
// (374; e2e ctl02-05, simulator iOS 27.1). The gap 282..374 holds one button and no Live Activities allowance.
const FORWARD = (x) => [["Cancel", x, 174], ["Page Menu", x, 234], ["Back", x, 374], ["Forward", x, 428], ["Share", x, 488], ["Reload", x, 542], ["Open in Safari", x, 596]];
for (const [name, { s, origin: [x0, y0], x }] of Object.entries(PORTRAIT)) {
  test(`preview ${name}, forward history: every control in the gap above the raised Back, clear of every native button`, () => {
    const c = detect({ ...s, canGoForward: true });
    assert.deepEqual([c.mode, c.preview, c.forward], ["column", true, true]);
    const native = FORWARD(x);
    for (const spec of SPECS) {
      const p = plan(c, spec), tag = JSON.stringify(spec);
      assert.ok(p.more || spec.tabs || spec.searchButton || !boxes(p).length, `something reachable ${tag}`);
      for (const [k, b] of boxes(p)) {
        const top = y0 + b.top, bottom = top + b.height;
        assert.ok(top >= 234 + 48 - 0.5 && bottom <= 374 + 0.5, `${k} ${top}..${bottom} outside the gap ${tag}`);
        for (const [n, , ny] of native) assert.ok(bottom <= ny || top >= ny + 48, `${k} overlaps ${n} ${tag}`);
      }
    }
  });
}

test("forward history outside the preview changes nothing: a tab's column has its own Forward row", () => {
  const s = sig(382, 580, 466, 678, { insetBottom: 0 });
  const a = detect(s), b = detect({ ...s, canGoForward: true });
  assert.equal(b.forward, undefined);
  assert.deepEqual(b, a);
});
