// Detection hardening (#57): measured states, the sticky preview verdict, commit policy, keyboard, zoom, strip and
// negatives. Fixtures carry the screen.* values Safari really reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect, isPreview, PIN_MAX, PREVIEW_RISE, previewReason, stable } from "../src/geometry.ts";

const F = JSON.parse(readFileSync(new URL("./fixtures/states.json", import.meta.url), "utf8"));
const full = (s) => ({
  insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3, userAgent: F.ua,
  screenWidth: 466, screenHeight: 678, visualHeight: s.innerHeight, ...s,
});
const at = (name) => full(F.states.find((x) => x.name.startsWith(name)).s);
const TAB = at("tab, fresh load"), PREVIEW = at("in-app preview, full screen");
const CHROME_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1";

for (const { name, s, expect } of F.states) {
  test(`measured: ${name}`, () => {
    const c = detect(full(s));
    assert.deepEqual({ mode: c.mode, side: c.side, preview: c.preview, keyboard: c.keyboard },
      { mode: expect.mode, side: expect.side, preview: expect.preview, keyboard: expect.keyboard });
    const settled = stable({ flips: [] }, full(s), undefined, 0);
    assert.equal(settled.mode, expect.mode);
    assert.equal(settled.confidence, "sure");
  });
}

test("a tab whose page height drifts into the preview band mid-scroll stays a tab", () => {
  const d = { flips: [] };
  assert.equal(stable(d, TAB, undefined, 0).preview, undefined);
  // Same window, page width and turn: only the page height and inset moved. The raw rule matches; the verdict holds.
  const drift = { ...TAB, innerHeight: 603, visualHeight: 603, insetBottom: 34 };
  assert.ok(isPreview(drift));
  // Past PREVIEW_RISE: the window has been a tab for over a second.
  const c = stable(d, drift, undefined, PREVIEW_RISE + 100);
  assert.deepEqual([c.mode, c.preview], ["column", undefined]);
  // A new page show (epoch) re-decides.
  assert.equal(stable(d, drift, undefined, PREVIEW_RISE + 200, false, 1).preview, true);
});
test("the sheet's late inset (0, then 34 ~100ms later, real Duo) still rises to preview on the same load", () => {
  const d = { flips: [] };
  const sheet = at("in-app preview, page sheet (real"), first = at("in-app preview, page sheet, first sample");
  assert.deepEqual([stable(d, first, undefined, 0).mode, d.preview], ["column", false]);
  const c = stable(d, sheet, undefined, 100, true);
  assert.deepEqual([c.mode, c.side, c.preview], ["column", "right", true]);
  assert.match(previewReason(sheet), /450x670 sheet in the 466x678 screen/);
});
test("the sheet rule wants the inset, the column, a window inside the closed screen and Safari", () => {
  const sheet = at("in-app preview, page sheet (real");
  assert.equal(isPreview({ ...sheet, insetBottom: 0 }), false);
  assert.equal(isPreview({ ...sheet, innerWidth: 450 }), false, "no column");
  assert.equal(isPreview({ ...sheet, outerWidth: 469, innerWidth: 385 }), false, "a split pane is wider than the screen");
  assert.equal(isPreview({ ...sheet, screenWidth: 951, screenHeight: 669 }), false, "another screen");
  assert.equal(isPreview({ ...sheet, userAgent: CHROME_UA }), false);
  assert.equal(isPreview({ ...sheet, standalone: true }), false);
});
test("a preview becomes a tab as soon as the rule stops matching (Open in Safari)", () => {
  const d = { flips: [] };
  assert.equal(stable(d, PREVIEW, undefined, 0).preview, true);
  const c = stable(d, TAB, undefined, 100, true);
  assert.deepEqual([c.mode, c.preview], ["column", undefined]);
});
test("the preview rule wants a real bottom inset (20pt or more)", () =>
  assert.equal(isPreview({ ...PREVIEW, insetBottom: 10 }), false));

test("keyboard: the mode stays, the context says keyboard", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  const kb = stable(d, at("tab, keyboard up"), undefined, 100, true);
  assert.deepEqual([kb.mode, kb.keyboard], ["column", true]);
  assert.equal(stable(d, at("tab, scrolled"), undefined, 200, true).keyboard, undefined);
});
test("zoom (measured: Safari zooms to 0.94 on input focus) holds the last context", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  const zoomed = { ...TAB, innerWidth: 406, innerHeight: 635, visualHeight: 289, scale: 0.9411764740943909 };
  assert.equal(detect(zoomed).mode, "inline", "the raw signature is gone under zoom");
  const c = stable(d, zoomed, undefined, 100);
  assert.deepEqual([c.mode, c.confidence, c.keyboard], ["column", "held", true]);
  assert.equal(stable(d, { ...zoomed, visualHeight: 635 }, undefined, 200).keyboard, undefined);
});
test("a mode only drifting signals ask for waits for the window to settle", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  const short = { ...TAB, innerHeight: 640, visualHeight: 640 }; // chrome 38: no column signature
  const held = stable(d, short, undefined, 100, true);
  assert.deepEqual([held.mode, held.confidence, held.height], ["column", "held", 640]);
  assert.equal(stable(d, short, undefined, 700, false).mode, "inline");
});
test("a stable signal change commits at once, even while settling", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  const c = stable(d, { ...TAB, innerWidth: 951, innerHeight: 543, visualHeight: 543 }, undefined, 100, true);
  assert.deepEqual([c.mode, c.confidence], ["inline", "settling"]);
});
test("pins double up to PIN_MAX, no further", () => {
  const short = { ...TAB, innerHeight: 640, visualHeight: 640 };
  const d = { flips: [90, 95], mode: "column", key: "466x678", ttl: PIN_MAX, until: 50 };
  stable(d, short, undefined, 100);
  assert.equal(d.ttl, PIN_MAX);
});

test("strip: Home Screen app on the Duo only, with the Duo's side inset", () => {
  const home = { ...TAB, innerHeight: 678, visualHeight: 678, standalone: true };
  assert.equal(detect({ ...home, insetRight: 84 }).mode, "strip");
  assert.equal(detect({ ...home, insetLeft: 84 }).side, "left");
  // iPhone landscape sensor inset (59), Android cutout (62), iPad: never strip.
  const phone = full({ innerWidth: 852, innerHeight: 393, outerWidth: 852, outerHeight: 393, screenWidth: 852, screenHeight: 393, standalone: true, insetLeft: 59 });
  assert.notEqual(detect(phone).mode, "strip");
  const android = full({ innerWidth: 412, innerHeight: 915, outerWidth: 412, outerHeight: 915, screenWidth: 412, screenHeight: 915, pixelRatio: 2.625, standalone: true, insetLeft: 62, userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" });
  assert.notEqual(detect(android).mode, "strip");
  const ipad = full({ innerWidth: 1024, innerHeight: 1366, outerWidth: 1024, outerHeight: 1366, screenWidth: 1024, screenHeight: 1366, pixelRatio: 2, standalone: true, insetRight: 84, touchPoints: 5 });
  assert.notEqual(detect(ipad).mode, "strip");
});
test("negatives: WKWebView (outer 0x0) and Chrome iOS are never column or preview", () => {
  const wk = { ...TAB, outerWidth: 0, outerHeight: 0 };
  assert.deepEqual([detect(wk).mode, isPreview(wk)], ["inline", false]);
  const chrome = { ...TAB, userAgent: CHROME_UA };
  assert.equal(detect(chrome).mode, "inline");
  assert.equal(isPreview({ ...PREVIEW, userAgent: CHROME_UA }), false);
});

// Hand-rolled perturbation: drifting signals never move a committed column; a window change commits in one read.
let seed = 57;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
test("perturbation: page height, keyboard and zoom keep the committed column", () => {
  for (const base of [TAB, at("tab, landscape turned left")]) {
    const d = { flips: [] };
    const first = stable(d, base, undefined, 0);
    for (let i = 1; i <= 300; i++) {
      // Any chrome in the column band at any time; outside it (find bar, toolbar animating) only while settling.
      const settling = rand() < 0.5, chrome = settling ? 30 + rand() * 100 : 68 + rand() * 34;
      const ih = Math.round(base.outerHeight - chrome);
      const s = { ...base, innerHeight: ih, visualHeight: rand() < 0.3 ? ih - 100 - rand() * 200 : ih };
      if (rand() < 0.2) Object.assign(s, { scale: 1.01 + rand() * 2 });
      const c = stable(d, s, undefined, i * 50, settling);
      assert.equal(c.mode, first.mode, JSON.stringify(s));
      assert.equal(c.side, first.side);
    }
    assert.equal(d.pinned, undefined, "no pin without a loop");
  }
});
test("perturbation: an outer size change commits within one read", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  const open = { ...TAB, innerWidth: 951, innerHeight: 571, visualHeight: 571, outerWidth: 951, outerHeight: 669 };
  assert.equal(stable(d, open, undefined, 100, true).mode, "inline");
  assert.equal(stable(d, TAB, undefined, 200, true).mode, "column");
});
// #61: the column layer widens the document so it can paint there; from a text field's focus it must not, or Safari
// zooms out to the wider document.
test("column layer leaves the document width while a text field has focus", () => {
  const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
  assert.match(css, /html:has\(:read-write:focus\) \.duet\[data-mode="column"\] \{ overflow: clip;/);
});
