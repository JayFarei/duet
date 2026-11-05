// The default path's golden: what an app without menu.tabs lays out, captured from 0.8.1 (test/fixtures/default-path.json).
// The inputs are stored with the outputs, so the fixture replays exactly, whatever the arbitraries become.
// Re-capture only for an intended change to the default path: node test/capture-golden.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { detect } from "../src/geometry.ts";
import { morphHeight } from "../src/template.ts";
import { WINDOWS, app, layout, signals } from "./arb.mjs";

const FILE = new URL("./fixtures/default-path.json", import.meta.url);
const sides = [undefined, "left", "right"];

/** Random windows with random apps, and a grid of apps over one window of each posture. menu.tabs always off. */
export function inputs() {
  const random = fc.sample(fc.tuple(signals, fc.constantFrom(...sides), app), { numRuns: 300, seed: 81 })
    .map(([{ name, s }, side, p]) => ({ window: name, s, side, app: { ...p, tabs: false } }));
  const grid = [];
  for (const [name, a] of Object.entries(WINDOWS)) {
    const [s] = fc.sample(a, { numRuns: 1, seed: 81 });
    for (const places of [0, 5, 9]) for (const actions of [0, 2, 5]) for (const primary of [false, true]) for (const move of [false, true])
      grid.push({ window: name, s, side: undefined, app: { places, icons: true, tabs: false, actions, folded: 1, destructive: 0, primary, move, close: false, menu: places > 0 } });
  }
  return [...random, ...grid];
}

/** What chrome.tsx draws for one case: the frame, the groups and their rects, the "…" list and confirm boxes, and
 *  the morph's height into each, half way and at the end (fit is menu.tabs, so false). */
export function capture(cases) {
  return cases.map(({ window, s, side, app: p }) => {
    const l = layout(detect(s, side), p), morph = (from, box) => box && [0.5, 1].map((t) => morphHeight(from.rect.h, box.h, t, 1, false));
    return {
      window, s, side: side ?? null, app: p,
      out: JSON.parse(JSON.stringify({
        frame: l.f, shown: l.a.shown, primary: l.a.primary, tabbed: l.tabbed ?? null,
        placed: l.a.placed.map((g) => ({ group: g.group.map((x) => x.kind === "action" || x.kind === "place" ? `${x.kind}${x.index}` : x.kind), rect: g.rect, pitch: g.pitch })),
        menu: l.menu ?? null, confirm: l.confirm ?? null, morph: l.moreAt ? morph(l.moreAt, l.menu) : null, ask: l.askAt ? morph(l.askAt, l.confirm) : null,
      })),
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const got = capture(inputs());
  writeFileSync(FILE, JSON.stringify(got) + "\n");
  console.log(`${got.length} cases to ${fileURLToPath(FILE)}`);
}
