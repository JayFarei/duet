// Property tests for the layout's geometry (docs/testing.md): over every posture the device reports (test/arb.mjs),
// what the docs promise holds. Each counterexample a property ever found is pinned below it as an example.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { columnBand, detect, DUO_SIZES, WIDE } from "../src/geometry.ts";
import { FEWEST_TABS, TEMPLATE, TIGHTEST_TAB_PITCH, extra, frame, groupHeight, morphHeight, placeTabs } from "../src/template.ts";
import { lensAt, pressShape } from "../src/press.ts";
import { app, context, layout, opts, shown, sig } from "./arb.mjs";
import { capture } from "./capture-golden.mjs";

const T = TEMPLATE, EPS = 1e-6;
const count = (t) => t?.shown ?? 0;
const mix = (a, b, t) => a + (b - a) * t;
/** The room placeTabs reads, from the docs ("Navigation fit"): a Duo Home Screen app's strip from the start, but for
 *  the inner screen upright, else the window's band at its smallest height; plus what a lone group may take beyond it. */
const roomOf = (c) => {
  const strip = c.duo && c.standalone && !(c.width >= WIDE && c.height > c.width);
  const f = frame(strip ? { ...c, mode: "strip", height: DUO_SIZES[0][1], offsetTop: 0 } : { ...c, height: c.stableHeight });
  return { f, room: f.bottom - f.top + extra(f) };
};
/** The layer's height: screen points in the column (below a banner), the viewport elsewhere. */
const layerHeight = (c) => c.mode === "column" ? c.screenHeight - c.offsetTop : c.height;
const layerWidth = (c) => c.mode === "column" ? c.screenWidth : c.width;
const pressBand = (c) => { const b = columnBand(c); return b ? { top: b.top - b.reach, bottom: b.bottom } : { top: 16, bottom: c.height - 16 }; };

// 1. Fit monotonicity.

test("fit: more room never shows fewer tabs, nor a tighter pitch at the same count", () => {
  fc.assert(fc.property(shown, fc.integer({ min: 1, max: 16 }), fc.boolean(), fc.integer({ min: 1, max: 300 }), ({ c }, n, rest, d) => {
    const more = { ...c, height: c.height + d, stableHeight: c.stableHeight + d, ...(c.visualBottom !== undefined && { visualBottom: c.visualBottom + d }) };
    const a = placeTabs(c, n, rest), b = placeTabs(more, n, rest);
    assert.ok(count(b) >= count(a), `${count(a)} tabs, then ${count(b)} with ${d}pt more`);
    if (a && b && a.shown === b.shown) assert.ok(b.pitch >= a.pitch, `pitch ${a.pitch} then ${b.pitch}`);
  }), opts());
});

test("fit: never more tabs than places, one more place changes the count by one at most, and once places fold more change nothing", () => {
  fc.assert(fc.property(shown, fc.integer({ min: 1, max: 16 }), fc.boolean(), ({ c }, n, rest) => {
    const a = placeTabs(c, n, rest), b = placeTabs(c, n + 1, rest);
    assert.ok(count(a) <= n && count(b) <= n + 1);
    if (a && b) assert.ok(Math.abs(b.shown - a.shown) <= 1, `${n} places: ${a.shown} tabs, ${n + 1}: ${b.shown}`);
    if (a && a.shown < n) assert.deepEqual(b, a, "folding: a further place goes in \"…\" too");
  }), opts());
});

// 2. The burger rule, as docs/how-duet-decides.md states it.

/** The docs' rule: every place (and "…" with anything else) at the normal pitch, else tighter down to 44, else as many
 *  leading places as fit beside "…" at 44 or wider, and the Sidebar button only when that leaves fewer than 3. */
function documented(c, n, rest) {
  const { f, room } = roomOf(c);
  if (f.preview) return undefined;
  const fits = (k) => k === 1 ? T.control <= room + EPS : T.control + (k - 1) * TIGHTEST_TAB_PITCH <= room + EPS;
  if (fits(n + (rest ? 1 : 0))) return n;
  let s = n - 1;
  while (s >= FEWEST_TABS && !fits(s + 1)) s--;
  return s >= FEWEST_TABS ? s : undefined;
}

const burger = ({ c }, n, rest) => {
    const t = placeTabs(c, n, rest), want = documented(c, n, rest);
    assert.equal(t?.shown, want, `${n} places${rest ? " and \"…\"" : ""} in ${roomOf(c).room.toFixed(1)}pt`);
    if (!t) return;
    const slots = t.shown + (t.shown < n || rest ? 1 : 0), { room } = roomOf(c);
    assert.ok(t.pitch <= T.item && t.pitch >= TIGHTEST_TAB_PITCH, `pitch ${t.pitch}`);
    assert.ok(T.control + (slots - 1) * t.pitch <= room + EPS, `${slots} at ${t.pitch} overfill ${room}`);
    if (t.pitch < T.item) assert.ok(groupHeight(slots) > room, "tighter only when the normal pitch does not fit");
};
test("burger rule: the Sidebar button exactly when fewer than 3 tabs would show, with no cliff between", () => {
  fc.assert(fc.property(shown, fc.integer({ min: 1, max: 16 }), fc.boolean(), burger), opts());
});

// 3. Containment.

const bandIn = ({ c }) => {
    const b = columnBand(c);
    if (!b) return;
    const tag = `band ${b.top - b.reach}..${b.bottom} of ${layerHeight(c)}`;
    assert.ok(b.top - b.reach >= -EPS && b.bottom <= layerHeight(c) + EPS, tag);
    // A short visual viewport lifts the band clear of Safari's bar, and may leave it too short (#140); else it holds room.
    if (c.visualBottom !== undefined) assert.ok(b.bottom <= c.visualBottom - T.gap + EPS, `${tag} below the bar at ${c.visualBottom}`);
    else assert.ok(b.top < b.bottom, tag);
};
test("containment: the column's band is on the screen, below its top and above its foot", () => {
  fc.assert(fc.property(context, bandIn), opts());
});

const aboveBar = ({ c }, p) => {
    const { f, a } = layout(c, p);
    if (f.bottom - f.top + extra(f) < T.control) return;
    for (const { rect: r } of a.placed) assert.ok(r.y + r.h <= c.visualBottom + EPS, `capsule ${r.y}..${r.y + r.h} past the bar at ${c.visualBottom}`);
};
test("containment: under a short visual viewport every capsule in Safari's column ends above its bar, where the band holds one", () => {
  fc.assert(fc.property(shown.filter(({ c }) => c.mode === "column" && c.visualBottom !== undefined), app, aboveBar), opts());
});

const inBand = ({ c }, p) => {
    const { f, a, menu, confirm } = layout(c, p), slack = extra(f) / 2;
    const roomy = f.bottom - f.top + extra(f) >= T.control;
    for (const { rect: r, group } of a.placed) {
      const tag = `${group.map((s) => s.kind).join(",")} ${r.y.toFixed(1)}..${(r.y + r.h).toFixed(1)}`;
      assert.ok(r.x >= 0 && r.x + r.w <= layerWidth(c) + EPS, `${tag} off the side`);
      if (roomy) assert.ok(r.y >= f.top - slack - EPS && r.y + r.h <= f.bottom + slack + EPS, `${tag} outside the band ${f.top.toFixed(1)}..${f.bottom.toFixed(1)}`);
      assert.ok(r.y >= -EPS && r.y + r.h <= layerHeight(c) + EPS, `${tag} off the screen's ${layerHeight(c)}`);
    }
    for (const [name, b] of [["list", menu], ["confirm", confirm]]) {
      if (!b) continue;
      assert.ok(b.x >= -EPS && b.x + b.w <= layerWidth(c) + EPS, `${name} x ${b.x}..${b.x + b.w}`);
      assert.ok(b.y >= 12 - EPS && b.y + b.h <= f.ph - 12 + EPS, `${name} y ${b.y}..${b.y + b.h} of ${f.ph}`);
    }
};
test("containment: every capsule in its band and on the screen, the \"…\" list and the confirmation in the page", () => {
  fc.assert(fc.property(shown, app, inBand), opts());
});

const morphIn = ({ c }, p, tall) => {
    const l = layout(c, { ...p, tabs: true, icons: true });
    if (!l.moreAt || !l.menu) return;
    const from = l.moreAt.rect, box = l.menu, h = morphHeight(from.h, box.h, tall, 1, true), cy = mix(from.y + from.h / 2, box.y + box.h / 2, tall);
    const lo = Math.min(from.y, box.y), hi = Math.max(from.y + from.h, box.y + box.h);
    // Half a point of slack: a spring's sub-point excursions are not what this guards.
    assert.ok(cy - h / 2 >= lo - 0.5 && cy + h / 2 <= hi + 0.5, `morph ${cy - h / 2}..${cy + h / 2} outside ${lo}..${hi} at ${tall}`);
    if (tall === 1) assert.ok(Math.abs(h - box.h) < EPS, "ends at the list's height");
};
test("containment: a menu.tabs \"…\" morphs inside what its capsule and list cover, never past the list's foot", () => {
  fc.assert(fc.property(shown, app, fc.double({ min: 0, max: 1, noNaN: true }), morphIn), opts());
});

// 4. Press round trip.

const roundTrip = ({ c }, p) => {
    for (const { group, rect, pitch } of layout(c, p).a.placed) {
      const n = group.length;
      if (n < 2) continue;
      const shape = pressShape(rect, n, pressBand(c));
      for (let k = 0; k < n; k++) {
        const at = rect.y + T.control / 2 + k * pitch;
        assert.equal(lensAt(at - shape.y, n, shape.pitch).index, k, `item ${k} of ${n} at pitch ${pitch}, open at ${shape.pitch}`);
      }
    }
};
test("press: a finger on a capsule item's resting centre names that item once the capsule opens", () => {
  fc.assert(fc.property(shown, app, roundTrip), opts());
});

// 5. Default path: an app without menu.tabs lays out as 0.8.1 did (test/fixtures/default-path.json).

test("default path: without menu.tabs, every window and app lays out as the captured 0.8.1 fixture", () => {
  const want = JSON.parse(readFileSync(new URL("./fixtures/default-path.json", import.meta.url), "utf8"));
  const got = capture(want.map(({ window, s, side, app }) => ({ window, s, side: side ?? undefined, app })));
  assert.ok(want.length > 500);
  for (let i = 0; i < want.length; i++) assert.deepEqual(got[i].out, want[i].out, `case ${i}, ${want[i].window} ${JSON.stringify(want[i].s)} side ${want[i].side} ${JSON.stringify(want[i].app)}`);
});

// 6. Further invariants from docs/edge-cases.md.

test("capsules never overlap, and keep the gap between them", () => {
  fc.assert(fc.property(shown, app, ({ c }, p) => {
    const rs = layout(c, p).a.placed.map((g) => g.rect).sort((a, b) => a.y - b.y);
    for (let i = 1; i < rs.length; i++) assert.ok(rs[i].y >= rs[i - 1].y + rs[i - 1].h + T.gap - EPS, `capsule ${i} at ${rs[i].y} under ${rs[i - 1].y + rs[i - 1].h}`);
  }), opts());
});

const withinRoom = ({ c }, p) => {
    const { f, a } = layout(c, p), room = (p.menu && p.tabs && roomOf(c).f.kind !== f.kind ? roomOf(c).room - extra(roomOf(c).f) : f.bottom - f.top) + extra(f);
    if (room < T.control || !a.placed.length) return;
    const total = a.placed.at(-1).rect.y + a.placed.at(-1).rect.h - a.placed[0].rect.y;
    assert.ok(total <= Math.max(room, f.bottom - f.top + extra(f)) + EPS, `${total} in ${room}`);
};
test("the stack never takes more than its room", () => {
  fc.assert(fc.property(shown, app, withinRoom), opts());
});

const primaryKept = ({ c }, p) => {
    const l = layout(c, { ...p, primary: true, close: false });
    if (l.f.preview || l.tabbed) return;
    const room = (p.menu && p.tabs && roomOf(c).f.kind === "inline" && c.mode !== "inline" ? roomOf(c).room - extra(roomOf(c).f) : l.f.bottom - l.f.top) + extra(l.f);
    if (!l.a.primary) assert.ok(room < groupHeight(2), `primary folded with ${room.toFixed(1)}pt of room`);
};
test("the primary keeps a capsule of its own or beside \"…\" unless one button is all that fits", () => {
  fc.assert(fc.property(shown, app, primaryKept), opts());
});

// Pinned: each counterexample a property found against the code before its fix (docs/testing.md, "Proofs").

const at = (s, side) => ({ s, c: detect(s, side) });
const App = (o) => ({ places: 0, icons: false, tabs: false, actions: 0, folded: 0, destructive: 0, primary: false, move: false, close: false, ...o, menu: (o.places ?? 0) > 0 });
const homeClosed = at(sig(466, 640, 466, 678, { insetLeft: 84, standalone: true }));
const homeTurned = at(sig(678, 430, 466, 678, { insetLeft: 84, insetBottom: 34, screenWidth: 678, screenHeight: 466, standalone: true }));

test("pinned, 381e1b5: a Home Screen strip with 8 places folds the tail into \"…\", no burger cliff", () => {
  burger(at(sig(951, 587, 951, 669, { insetLeft: 84, standalone: true })), 8, true);
});
test("pinned, 54518e0: 7 places in a closed Home Screen strip tighten to 44 rather than burger", () => {
  burger(homeClosed, 7, true);
});
test("pinned, 9357f53: a closed Duo turned Home Screen app keeps its stack in the band and its room", () => {
  for (const p of [App({ places: 1, tabs: true, actions: 2, destructive: 1 }), App({ places: 1, tabs: true, actions: 4, folded: 1 })]) { inBand(homeTurned, p); withinRoom(homeTurned, p); }
});
test("pinned, 1b7f3be: a short visual viewport lifts the band and its capsules above Safari's bar", () => {
  const turned = at(sig(594, 328, 678, 466, { visualHeight: 286, angle: 90, editing: false }));
  bandIn(turned);
  aboveBar(at(sig(382, 540, 466, 678, { visualHeight: 494, editing: false }), "right"), App({ actions: 1, destructive: 1 }));
});
test("pinned, 9bd4226: home tall, 5 tab places and a destructive action, each item named where it rests", () => {
  roundTrip(at(sig(669, 840, 669, 951, { insetBottom: 34, standalone: true }), "right"), App({ places: 5, icons: true, tabs: true, destructive: 1 }));
});
test("pinned, b7bb93f: the morph stays inside its capsule and list, early and at its end", () => {
  const p = App({ places: 1, actions: 1, destructive: 1 });
  for (const tall of [0.014204545454543869, 0.5, 1]) morphIn(homeClosed, p, tall);
});
test("pinned, e9fa1e4: closed turned inline with a short viewport, the default morph is 0.8.1's", () => {
  const want = JSON.parse(readFileSync(new URL("./fixtures/default-path.json", import.meta.url), "utf8"))
    .filter((k) => k.window === "closed turned inline" && k.s.visualHeight === 199 && k.app.places === 8);
  assert.ok(want.length >= 1);
  for (const k of want) assert.deepEqual(capture([{ ...k, side: k.side ?? undefined }])[0].out, k.out);
});
test("pinned, mutation: a lone primary in the closed column keeps its capsule", () => {
  primaryKept(at(sig(382, 540, 466, 678), "right"), App({ folded: 1 }));
});
