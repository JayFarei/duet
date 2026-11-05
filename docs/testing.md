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

Stateful parts, such as the settling damper (`stable`) and the "…" open, closing and closed states, are better tested as a model. A test generates a random sequence of commands (signal changes, taps, unmounts), runs each command against both a small reference model and the real code, and checks they agree after every step. fast-check's `fc.commands` and `fc.modelRun` do this. The geometry tests above are stateless and do not need it.

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
