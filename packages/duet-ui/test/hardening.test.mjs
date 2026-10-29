// Detection hardening (#57): measured states, the sticky preview verdict, commit policy, keyboard, zoom, strip and
// negatives. Fixtures carry the screen.* values Safari really reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detect, isPreview, PIN_MAX, PREVIEW_RISE, previewPending, previewReason, stable } from "../src/geometry.ts";

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
  // Drift never takes a tab out of Safari's column, settled or not (#132).
  const after = stable(d, short, undefined, 700, false);
  assert.deepEqual([after.mode, after.confidence, after.height], ["column", "held", 640]);
});
test("a wrong inline verdict heals on drift: inline to column still moves once settled", () => {
  const d = { flips: [] };
  const short = { ...TAB, innerHeight: 640, visualHeight: 640 };
  assert.equal(stable(d, short, undefined, 0).mode, "inline");
  assert.equal(stable(d, TAB, undefined, 700).mode, "column");
});
test("a stable signal change commits at once, even while settling", () => {
  const d = { flips: [] };
  stable(d, TAB, undefined, 0);
  // Unfolded and landed: the window says 951x669 too, so this is a real state, not a fold caught halfway.
  const c = stable(d, { ...TAB, outerWidth: 951, outerHeight: 669, innerWidth: 951, innerHeight: 543, visualHeight: 543 }, undefined, 100, true);
  assert.deepEqual([c.mode, c.confidence], ["inline", "settling"]);
});
test("a fold caught halfway (page wider than its window) hides the controls and commits nothing", () => {
  const d = { flips: [] };
  const before = stable(d, TAB, undefined, 0);
  const c = stable(d, { ...TAB, innerWidth: 951, innerHeight: 543, visualHeight: 543 }, undefined, 100, true);
  assert.deepEqual([c.mode, c.side, c.hidden, c.confidence, c.width], [before.mode, before.side, "moving", "moving", before.width]);
  // Once the settle window closes the same signals are read as they are.
  assert.equal(stable(d, { ...TAB, innerWidth: 951, innerHeight: 543, visualHeight: 543 }, undefined, 2500, false).hidden, undefined);
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
// #76: the follow timeline is clamped to the scroll range, so a rubber band past either end carried the layer over
// Safari's own column buttons. The document must not rubber-band while the layer follows it.
test("column follow layer keeps the document from rubber-banding", () => {
  const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
  assert.match(css, /:where\(html\[data-duet-mode="column"\]:has\(> body \.duet\[data-follow\]\)\) \{ overscroll-behavior-y: none; \}/);
});

// #143: the preview's bottom inset reads 0 until viewport-fit=cover is set on mount, and in the sheet ~100ms later
// still, so the first readings were a tab's and the controls showed over the preview's share and reload buttons.
test("previewPending: a sheet or full screen preview before its inset lands, never a tab", () => {
  const first = at("in-app preview, page sheet, first sample");
  assert.equal(previewPending(first), true);
  assert.equal(previewPending({ ...PREVIEW, insetBottom: 0 }), true);
  assert.equal(previewPending(PREVIEW), false, "already the preview");
  assert.equal(previewPending(TAB), false);
  assert.equal(previewPending(at("tab, scrolled")), false);
});
// The pre-paint boot reads the sheet's very first frames (~70ms, iOS 27.1, e2e pvl01): the page reads the whole screen
// inside the sheet's 450x670 window, no column, inset 0. The window alone tells it, as no tab is smaller than the screen.
test("previewPending: the sheet's unlaid first frame, before its column and inset (#143)", () => {
  const unlaid = { ...at("in-app preview, page sheet, first sample"), innerWidth: 466, innerHeight: 678, visualHeight: 678, insetBottom: 0 };
  assert.equal(isPreview(unlaid), false);
  assert.equal(previewPending(unlaid), true);
  assert.equal(previewPending({ ...unlaid, insetBottom: 34 }), true);
  assert.equal(stable({ flips: [] }, unlaid, undefined, 0).hidden, "pending");
  // Not in another browser, nor installed to the home screen.
  assert.equal(previewPending({ ...unlaid, standalone: true }), false);
  assert.equal(previewPending({ ...unlaid, userAgent: unlaid.userAgent + " CriOS/130.0" }), false);
});
// The full screen preview's first frame (~200ms, iOS 27.1, e2e j37/pvl02): the page is the whole closed screen, window
// and all, inset 0. No tab reads that: its column and bar are always there (#155).
test("previewPending: the full screen preview's unlaid first frame, either orientation (#155)", () => {
  const unlaid = { ...PREVIEW, innerWidth: 466, innerHeight: 678, outerWidth: 466, outerHeight: 678, visualHeight: 678, insetBottom: 0 };
  assert.equal(isPreview(unlaid), false);
  assert.equal(previewPending(unlaid), true);
  assert.equal(stable({ flips: [] }, unlaid, undefined, 0).hidden, "pending");
  const turned = { ...unlaid, innerWidth: 678, innerHeight: 466, outerWidth: 678, outerHeight: 466, visualHeight: 466, screenWidth: 678, screenHeight: 466, angle: 90 };
  assert.equal(previewPending(turned), true);
  assert.equal(previewPending({ ...unlaid, standalone: true }), false);
  assert.equal(previewPending({ ...unlaid, userAgent: unlaid.userAgent + " CriOS/130.0" }), false);
  // A tab never: its column, its bar.
  assert.equal(previewPending(TAB), false);
  assert.equal(previewPending({ ...TAB, insetBottom: 0 }), false);
});
test("the sheet's controls stay hidden until its late inset lands, then show as the preview (#143)", () => {
  const d = { flips: [] };
  const first = stable(d, at("in-app preview, page sheet, first sample"), undefined, 0);
  assert.deepEqual([first.mode, first.preview, first.hidden], ["column", undefined, "pending"]);
  assert.equal(d.pendingUntil, PREVIEW_RISE);
  const c = stable(d, at("in-app preview, page sheet (real"), undefined, 100, true);
  assert.deepEqual([c.mode, c.preview, c.hidden], ["column", true, undefined]);
  assert.equal(d.pendingUntil, undefined);
});
test("full screen preview before its inset lands: hidden, not a tab's controls (#143)", () => {
  const d = { flips: [] };
  assert.equal(stable(d, { ...PREVIEW, insetBottom: 0 }, undefined, 0).hidden, "pending");
  assert.equal(stable(d, PREVIEW, undefined, 50, true).hidden, undefined);
});
test("an inset that never lands shows the controls once PREVIEW_RISE is past (#143)", () => {
  const d = { flips: [] }, first = at("in-app preview, page sheet, first sample");
  assert.equal(stable(d, first, undefined, 0).hidden, "pending");
  assert.equal(stable(d, first, undefined, PREVIEW_RISE - 1).hidden, "pending");
  const c = stable(d, first, undefined, PREVIEW_RISE + 10);
  assert.deepEqual([c.mode, c.hidden], ["column", undefined]);
});
// Unfolding the full screen preview (iOS 27.1, e2e j38-02): its first frame on the open screen drew the controls
// inline right for ~40ms, over the clock and island, before the window and its 84pt status band settled. The page reads
// 951x594 in the 951x669 window there, one of its insets not landed yet: the bottom (reads as a tab) or the right (the
// preview, no band). Both stay hidden; the laid out frame shows the strip.
test("unfolding the preview: hidden until its insets land, then the strip (e2e j38-02)", () => {
  const open = { ...PREVIEW, innerWidth: 951, innerHeight: 594, outerWidth: 951, outerHeight: 669, visualHeight: 594, insetBottom: 34, insetRight: 84 };
  assert.match(previewReason(open), /unfolded wide/);
  for (const unlaid of [{ ...open, insetBottom: 0 }, { ...open, insetRight: 0 }]) {
    assert.ok(previewPending(unlaid));
    const d = { flips: [] };
    assert.equal(stable(d, PREVIEW, undefined, 0).preview, true);
    const c = stable(d, unlaid, undefined, 5000, true);
    assert.equal(c.hidden, "pending");
    assert.equal(d.pendingUntil, 5000 + PREVIEW_RISE);
    const landed = stable(d, open, undefined, 5100, true);
    assert.deepEqual([landed.mode, landed.side, landed.hidden], ["strip", "right", undefined]);
    // An inset that never lands shows the controls once PREVIEW_RISE is past.
    const d2 = { flips: [] };
    stable(d2, PREVIEW, undefined, 0);
    stable(d2, unlaid, undefined, 5000, true);
    assert.equal(stable(d2, unlaid, undefined, 5000 + PREVIEW_RISE + 10).hidden, undefined);
  }
  // A tab unfolded is never pending: 126pt of bars.
  assert.equal(previewPending({ ...open, innerHeight: 543, visualHeight: 543, insetRight: 0 }), false);
});
test("a tab is never pending, even with its bar collapsed into the preview's chrome band (59pt, real Duo) (#143)", () => {
  const d = { flips: [] };
  assert.equal(stable(d, TAB, undefined, 0).hidden, undefined);
  const collapsed = { ...TAB, innerHeight: 619, visualHeight: 619 };
  assert.ok(previewPending(collapsed), "59pt sits in the preview's chrome band");
  // A quick scroll right after load, inside PREVIEW_RISE.
  assert.equal(stable(d, collapsed, undefined, 200, true).hidden, undefined);
  assert.equal(stable(d, collapsed, undefined, PREVIEW_RISE + 100, true).hidden, undefined);
  // Back from another tab (a new page show): still the same page, long past its first second.
  assert.equal(stable(d, collapsed, undefined, PREVIEW_RISE + 200, false, 1).hidden, undefined);
});
