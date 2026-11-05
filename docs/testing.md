# Testing

duet-ui is tested in layers, cheapest first. Each layer catches what the one below it cannot see.

| Layer | Where | What it checks | Run |
| --- | --- | --- | --- |
| Example tests | `packages/duet-ui/test/*.test.mjs` | One measured window or one interaction, an exact expected value | `pnpm test` |
| Property tests (PBT) | `packages/duet-ui/test/props-*.test.mjs` | A documented rule over every posture and app the generators can build | `pnpm test` |
| Oracle (golden) tests | `test/fixtures/*.json`, compared by a property test | Unchanged paths lay out exactly as a released version did | `pnpm test` |
| Browser e2e | `e2e/*.spec.ts` | The built package in Playwright WebKit | `pnpm test:e2e` |
| Duo simulator journeys | `tools/e2e` | Real Safari on the Duo Lab simulator, recorded | see `tools/e2e/README.md` |

The unit layers run on Node's built-in runner (`node:test`, `node:assert/strict`), importing `src/*.ts` directly through Node's type stripping, with no build step.

## Property tests

A property test states a rule from the docs, not an expected number, and lets fast-check search for an input that breaks it. When one fails, fast-check shrinks the input to a small counterexample and prints it with a seed.

The generators live in `test/arb.mjs`:

- `WINDOWS`: each posture the device reports, as measured on the Duo simulator (iOS 27.1) and real iPhones, iPads and desktops, with jitter around the measured sizes. It covers closed, closed turned, split, wide, tall, Home Screen, preview, iPhone, iPad and desktop.
- `signals` adds a short visual viewport, with or without a keyboard. `context` runs `detect` for a preferred side, and `shown` keeps the contexts where the controls are visible.
- `app`: `<Duet>` props, covering places, icons, `menu.tabs`, actions, folded and destructive actions, a primary, move and close.
- `layout(c, app)`: the template run the way `chrome.tsx` runs it for one side, so properties check what is drawn.

`test/props-geometry.test.mjs` covers the pure layout code (`src/template.ts`, `src/press.ts`, `columnBand` and `detect` in `src/geometry.ts`):

- Fit monotonicity: more room never shows fewer tabs or a tighter pitch. One more place changes the tab count by at most one, and once places fold into "…", more places change nothing.
- Burger rule: `placeTabs` matches an independent encoding of the rule in `how-duet-decides.md`. Places are shown at the normal pitch, then tighter down to 44pt, then as many leading places as fit beside "…". The Sidebar button appears only when fewer than 3 would show, so there is no cliff.
- Containment: the column band is on screen, and above Safari's bar under a short visual viewport. Every capsule stays in its band and on screen. The "…" list and the confirmation stay in the page. A `menu.tabs` morph stays inside what its capsule and list cover.
- Press round trip: a finger on an item's resting centre names that same item once the capsule opens.
- No overlap: capsules never overlap and keep the gap between them.
- The stack never takes more than its room.
- The primary folds into "…" only when its room cannot hold two buttons.

## Oracle: the default path

An app without `menu.tabs` must lay out exactly as 0.8.1 did. `test/capture-golden.mjs` builds 840 cases: 300 random windows and apps from a fixed seed, plus a grid of apps over one window of each posture. For each case it records the frame, the groups and their rects, the "…" and confirmation boxes, and the morph heights. The captured cases are stored in `test/fixtures/default-path.json`, inputs alongside outputs, so the fixture replays exactly even if the generators change. The default path test recomputes every case and compares deeply.

Re-capture only for an intended change to the default path, and say why in the commit:

```sh
cd packages/duet-ui && node test/capture-golden.mjs
```

## Model-based tests (MBT)

Stateful parts are tested as a model: a test generates a random sequence of commands (taps, spring ends, signal changes, template changes), runs it against the real code and checks invariants after every step.

### Menu state (`test/props-menu.test.mjs`)

"…", the sidebar and the primary's confirmation box are one pure reducer (`src/menu.ts`); `chrome.tsx` sends it every tap, spring end and layout change. An `fc.commands` model drives random taps, springs and template changes (the "…" capsule leaving, the primary moving into "…" or away) against a boolean model. Invariants:

- After settling, nothing is stuck "closing".
- With nothing open, an outside tap reaches the page; only the dismiss tap of an open "…" or box is swallowed.
- "…" and the box are never both open.
- A capsule leaving the template closes its surface and disarms the primary.

Pinned: #262, #253a, armed then Move, and the shrunk counterexamples. A source-grep test checks `chrome.tsx` sends "gone" for both capsules, which the model cannot see.

### Posture traces (`test/props-signals.test.mjs`, `test/props-posture.test.mjs`)

`test/arb-posture.mjs` holds the landed windows (`POSTURES`, from the measured fixtures), the transition paths each fold, unfold, turn or split passes through, Home Screen launches (`LAUNCHES`), the in-app preview loading (`LOADS`), drift (Safari's bar 50 to 110, the banner, the simulator and real Duo keyboards, the top inset), and `drive()`, which feeds `stable()` the way `chrome.tsx` does: a read on each event, on the `signals.ts` settle poll, and at the damper's timers.

- props-signals: a Safari tab in the column (P, L90, L270, S) under scroll and keyboard drift, read through `drive()` and directly with random settling, plus any bar from 0 to 150 after landing. Every read stays in the column, on its side, shown (#132).
- props-posture: random traces of folds, turns, split view, the keyboard, the bar, the preview handed to a tab and Home Screen launches, with events cutting into transitions. On every read: a placement this stretch landed in, insets 0 to 88px, never over the status clock, never at the closed screen's places on the open screen, a Home Screen app's tabs the same from its first shown read, never a tab's controls on the preview, no flash under `LAND_HOLD` after a transit, at most 3 settled mode changes per 2s per window, no timer spin. At the end, settled on what `detect()` says.

Proven by reverting 0b89ebb, ae590b2, 5d9b39a, 503ad1e, 89466d1 and 9d37db9/12abe27, each counterexample pinned. Not modeled: the layout viewport's scroll offset (#126, `KEYBOARD_DOWN`).

## Pixel and differential oracles (e2e)

`e2e/site/rim.spec.ts` checks the glass rim pixel by pixel. It samples rings 1.5, 4 and 8px inside every drawn control (inline group, open "…", the closed Duo's column capsule through `/space`) in light and dark, on WebKit and Chromium at 390x844 and 1440x900, against the page 6px outside on the same normal. Light fails on luminance under 0.15 over a lighter page, dark on over 0.85 over a darker one. Replay an older stylesheet without a rebuild:

```sh
git show v0.8.0:packages/duet-ui/src/duet.css > /tmp/old.css && DUET_CSS=/tmp/old.css pnpm exec playwright test -c playwright.site.config.ts rim.spec.ts
```

That fails on the v0.8.0 black caps (worst 28 to 36). The iOS-only `.duet[data-follow]` rim cannot be checked on desktop engines; use the Duo Lab sim.

`e2e/site/space.spec.ts` diffs the site's web Duo mock against the real sim's space map in `e2e/site/fixtures/space-map.json`: mode, the signals the mock posts (`/space?s=<state>` exposes them as `data-space-signals`) and the preview's native button tops (`data-wd-native`), 1pt tolerance, with a markdown table attached. It also checks #110's placement invariant per scene: every shown group inside the screen and window, clear of every native button. The fixture is transcribed from #189, not captured; recapture with `tools/e2e` on a free Duo e2e clone and set `"source"` accordingly. Run against a built site with `SITE_PORT=<port> SITE_REUSE=1`, specs `space.spec.ts --project chromium-1440 --project webkit-1440`.

## Runs and replay

Each property runs 300 times by default, which keeps the whole suite under a few seconds. Raise this for a deeper search before a release, or after touching layout code:

```sh
cd packages/duet-ui && DUET_PBT_RUNS=30000 node --test "test/props-*.test.mjs"
```

A failure prints `seed` and `path`. Replay that exact case, with no search:

```sh
DUET_PBT_SEED=-123456 DUET_PBT_PATH="12:3:0" node --test test/props-geometry.test.mjs
```

Use `--test-name-pattern` to run one property.

## Proofs and pinned counterexamples

A property is only worth keeping if it can fail. For each one, the pre-fix source was restored temporarily, the property failed with a counterexample, and the source was put back. That counterexample is then pinned as an explicit example test at the end of the file, named after the fix commit, so the case stays covered whatever the generators become. Where no historical bug exists, a deliberate mutation of the source proves the same thing, and its pinned test is named `mutation`.

When a property finds a current bug: in a file you own, fix it minimally, add a `docs/edge-cases.md` entry and pin the counterexample. In a file you do not own, add a `{ todo: "..." }` test that holds the counterexample.
