// In-app Safari preview (SFSafariViewController) on the closed Duo: Duet's controls go into the free gap of the
// preview's own column, between its reader/menu button and its back button, and never touch a native button.
// Native frames are the e2e runner's XCUITest reads (Duo Lab Preview simulator, iOS 27.1, 2026-10-26), in screen
// points, matching the real Duo (iOS 18.7, Messages): reader/menu bottom ~281, back top ~429. Live Activities push
// Cancel and Page Menu down (one: ~45pt, device, 2026-10-27), assumed DUO.island at worst; Back stays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, stable, staleLayoutWidth, DUO, PREVIEW_RISE } from "../src/geometry.ts";
import { frame, template } from "../src/template.ts";

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
for (const close of [false, true]) for (const menu of [false, true]) for (const actions of [0, 1, 4]) for (const primary of [false, true])
  SPECS.push({ close, menu, actions, primary });

const boxes = (c, spec) => template(frame(c), spec).placed;

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
        const p = boxes(c, spec), tag = JSON.stringify(spec);
        assert.ok(p.length <= 1, `one button at most ${tag}`);
        for (const { group: [k], rect: b } of p) {
          assert.ok(Math.abs(x0 + b.x + b.w / 2 - (menu[1] + 24)) <= 1, `centre ${x0 + b.x + b.w / 2} vs native ${menu[1] + 24} ${tag}`);
          const top = y0 + b.y, bottom = top + b.h;
          assert.ok(top >= menu[2] + 48 - 0.5 && bottom <= back[2] + 0.5, `${k.kind} ${top}..${bottom} outside the gap ${tag}`);
          for (const [n, , ny] of native) assert.ok(bottom <= ny || top >= ny + 48, `${k.kind} overlaps ${n} ${tag}`);
        }
      }
    }
  });
  test(`preview ${name}: "…" alone, centred in the worst-case gap, its list holding everything`, () => {
    const p = boxes(detect(s), { menu: true, actions: 2, primary: true });
    assert.deepEqual(p.map((g) => g.group), [[{ kind: "more" }]]);
    const top = y0 + p[0].rect.y, above = top - (234 + DUO.island + 48), below = 428 - (top + DUO.control);
    assert.ok(above > 0 && Math.abs(above - below) < 0.5, `${above} above, ${below} below`);
  });
  test(`preview ${name}: a sheet's close shows itself alone, centred in the gap, not folded into "…" (#142)`, () => {
    const p = boxes(detect(s), { close: true, menu: true, actions: 2 });
    assert.deepEqual(p.map((g) => g.group), [[{ kind: "close" }]]);
    const top = y0 + p[0].rect.y, above = top - (234 + DUO.island + 48), below = 428 - (top + DUO.control);
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
      const p = boxes(c, spec), tag = JSON.stringify(spec);
      assert.ok(p.length <= 1 && (p.length || (!spec.menu && !spec.actions && !spec.primary)), `one button ${tag}`);
      for (const { group: [k], rect: b } of p) {
        const top = y0 + b.y, bottom = top + b.h;
        assert.ok(top >= 234 + 48 - 0.5 && bottom <= 374 + 0.5, `${k.kind} ${top}..${bottom} outside the gap ${tag}`);
        for (const [n, , ny] of native) assert.ok(bottom <= ny || top >= ny + 48, `${k.kind} overlaps ${n} ${tag}`);
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

// Leaving through Home, iOS snapshots the app at other sizes (951x669 at 270) and hands the preview back with the top
// bar's 130pt of chrome for a moment (e2e life06, iOS 27.1: 382x548 in 466x678, inset 34). Measured for 220ms; hidden
// or on a slower phone it outlasts PREVIEW_RISE, and the controls dropped to an inline strip for good, beside the
// preview's own column.
test("back from another app: a late 130pt top bar keeps the preview's column, whatever it lasts", () => {
  const d = { flips: [] }, O = { insetBottom: 34 };
  const run = (t, s, angle = 0, epoch = 0) => stable(d, { ...s, angle }, undefined, t, false, epoch);
  assert.equal(run(0, sig(382, 603, 466, 678, O)).mode, "column");
  run(2000, sig(951, 615, 951, 669, O), 270);
  run(2100, sig(382, 603, 466, 678, O));
  const late = run(4000, sig(382, 548, 466, 678, O));
  assert.equal(late.mode, "column"); assert.ok(late.preview);
  const home = run(5000, sig(382, 603, 466, 678, O));
  assert.equal(home.mode, "column"); assert.ok(home.preview);
});

test("back from another app: the snapshot lands straight on the late top bar, the preview's column still", () => {
  const d = { flips: [] };
  const run = (t, s, angle = 0) => stable(d, { ...s, angle }, undefined, t);
  run(0, sig(382, 603, 466, 678));
  run(2000, sig(951, 615, 951, 669), 270);
  assert.deepEqual([run(2100, sig(382, 548, 466, 678)).mode, run(4000, sig(382, 548, 466, 678)).mode, run(5000, sig(382, 603, 466, 678)).mode], ["column", "column", "column"]);
  assert.ok(d.preview);
});

test("a preview handed to a tab (inset 0) forgets it was one: a later inset does not read as the preview", () => {
  const d = { flips: [] };
  assert.ok(stable(d, sig(382, 603, 466, 678), undefined, 0).preview);
  assert.ok(!stable(d, sig(382, 580, 466, 678, { insetBottom: 0 }), undefined, 5000).preview);
  assert.ok(!stable(d, sig(382, 548, 466, 678), undefined, 9000).preview);
});

// The sheet can come back from the snapshot with its page 52pt narrower, and stay so (e2e life03, iOS 27.1: 314x600 in
// 450x670). The verdict dropped a second later, and the controls went inline, inside the page.
test("back from another app: the sheet's page left narrower keeps the preview's column, and the menu opens from its edge", () => {
  const d = { flips: [] };
  const run = (t, s, angle = 0, epoch = 0) => stable(d, { ...s, angle }, undefined, t, false, epoch);
  const c0 = run(0, sig(366, 600, 450, 670));
  assert.deepEqual([c0.mode, !!c0.preview], ["column", true]);
  run(2000, sig(935, 591, 951, 669), 270);
  for (const t of [2100, 3000, 5000]) {
    const c = run(t, sig(314, 600, 450, 670), 0, 1);
    assert.deepEqual([c.mode, !!c.preview, c.side, c.width, c.screenWidth], ["column", true, "right", 314, 450]);
    const f = frame(c);
    assert.equal(f.cx, frame(c0).cx);
    assert.equal(f.edge, 314);
  }
});

test("back from another app: the full style's page left narrower keeps the preview's column too", () => {
  const d = { flips: [] };
  stable(d, sig(382, 603, 466, 678), undefined, 0);
  const c = stable(d, sig(322, 603, 466, 678), undefined, 3000);
  assert.deepEqual([c.mode, !!c.preview, c.width], ["column", true, 322]);
});

test("a page narrower than the column that never was the preview is not one", () => {
  const d = { flips: [] };
  assert.ok(!stable(d, sig(314, 600, 450, 670), undefined, 0).preview);
});

test("back from another app: the page left narrower or under the late bar shows its controls while the window settles", () => {
  for (const [p, h] of [[314, 600], [382, 548]]) {
    const w = p === 314 ? [450, 670] : [466, 678], d = { flips: [] };
    assert.ok(stable(d, sig(w[0] - 84, h === 548 ? 603 : 600, ...w), undefined, 0).preview);
    for (const t of [2000, 2400, 3500, 6000]) {
      const c = stable(d, { ...sig(p, h, ...w), angle: 0 }, undefined, t, true, 1);
      assert.deepEqual([c.mode, !!c.preview, c.hidden], ["column", true, undefined]);
    }
  }
});

test("a preview still turning stays in transit: a sideways page in the upright sheet hides", () => {
  const d = { flips: [] };
  stable(d, sig(366, 600, 450, 670), undefined, 0);
  assert.equal(stable(d, { ...sig(600, 366, 450, 670), angle: 0 }, undefined, 100, true).hidden, "moving");
});

test("a preview's page left short of its column reads as stale, closed and upright only (#225)", () => {
  const c = { mode: "column", preview: true }, sheet = { outerWidth: 450, outerHeight: 670 }, full = { outerWidth: 466, outerHeight: 678 };
  assert.equal(staleLayoutWidth(sheet, c, 314), 366);
  assert.equal(staleLayoutWidth(full, c, 322), 382);
  assert.equal(staleLayoutWidth(sheet, c, 366), undefined);
  assert.equal(staleLayoutWidth(sheet, { ...c, preview: false }, 314), undefined);
  assert.equal(staleLayoutWidth(sheet, { ...c, mode: "inline" }, 314), undefined);
  assert.equal(staleLayoutWidth({ outerWidth: 670, outerHeight: 450 }, c, 314), undefined);
  assert.equal(staleLayoutWidth({ outerWidth: 653, outerHeight: 869 }, c, 314), undefined);
});
