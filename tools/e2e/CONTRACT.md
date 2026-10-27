# The Duo placement contract

What duet-ui guarantees on the iPhone Duo, and how the e2e harness proves it. This is the locked scope: changes to it go through its issue, not through a test run.

## The goal

duet-ui behaves like an operating system control: it claims space Safari leaves free and is always there. The test suite exists to guarantee that, not to collect screenshots.

## 1. The gap map

The gap is the measured room between Safari's own UI (its buttons, bars, the preview's top bar, the Dynamic Island and its Live Activities) where a Duet button can sit without covering anything.

The gap map records that room, as rectangles in CSS pixels, for every layout:

| Dimension | Values |
|---|---|
| Screen | folded (outer), open (inner) |
| Rotation | 0, 90, 270 |
| Split View | only when open |
| Window | Safari tab; in-app preview: sheet, default, full screen, over full screen |
| Safari chrome | tab bar bottom or top; Back and Forward arrows shown or not; Shared with You banner ("From <name>" with X, on pages opened from a Messages link, stays until closed) shown or not: +40pt top chrome, Safari's column buttons unmoved, page 40pt lower (real Duo, closed tab, closed landscape, split panes, open tab; #112) |
| Live Activities | 0, 1, 2 |
| Appearance | dark mode, larger text |

It also records the room during transitions between layouts (fold, unfold, rotate, a Live Activity starting or ending, a bar compacting).

- Measured on the Duo Lab simulator, from Safari's own frames (accessibility tree) plus a screenshot.
- Versioned per iOS version: fixtures under `packages/duet-ui/test/fixtures/<ios version>/`.
- Signed off by a person on one overlay page that draws every layout's gap over its screenshot. Until signed off, a layout's gap is `unknown`.

## 2. The invariant

In every frame, in every scenario: when a gap exists, the rendered Duet button sits entirely inside the current gap and is painted (its icon visible). When no gap exists, no button is rendered. No gap, no button.

It holds under every condition:

| Group | Conditions |
|---|---|
| Page | scroll, tap, keyboard up and down, navigation (links, Safari Back and Forward), page modals |
| Device | fold, unfold, rotate, Split View |
| System | Live Activities starting and ending, background and foreground, lock and unlock, reload |

Open item: how long a button may be hidden mid-transition while a gap exists (the settle budget). It is set from calibration data, written here, and judged; it is never an unjudged exemption.

## 3. Layers

1. Placement (this contract): position and paint, against the gap map. Everything below depends on it.
2. Native feel: gloss, animation, component behavior (a tap reaches the right action, "…" opens its menu). A separate, simpler layer, tested once placement is reliable.

## 4. How it is proved

1. **Gap map** (section 1).
2. **Model check.** `detect()` and `plan()` in `packages/duet-ui/src/geometry.ts` are pure: run them over every combination of the gap map's signals, plus a scan across every threshold breakpoint (`STRIP_INSET`, `DUO_SIZES`, `SHEET_SLACK`, the split size and so on), as `node --test` unit tests. A combination that passes here is `proved`.
3. **Judge calibration.** Deliberately broken library builds (a button shifted out of the gap, painted transparent, shown with no gap, a late settle) must each turn their judge red. A judge that misses its broken build cannot report PASS: its results are UNVERIFIED.
4. **Frame check** of the minimal set on simulators:
   - every legal transition of every window type;
   - properties (Live Activities, dark mode, larger text, tab bar top, Back and Forward) spread across those scenarios so each value is covered, not every product;
   - the page interactions played inside each scenario.
   The page reports Duet's rects every 40 ms; the judges compare every sample, not only the last, against the gap map. A combination observed this way is `observed`.
5. **Results.** Three values per scenario and clause: PASS, FAIL, UNVERIFIED. Nothing passes silently: a sample the harness cannot judge (no native frames, a sampling gap, a judge not calibrated) is UNVERIFIED with its reason. Evidence labels: `proved`, `observed`, `unknown`.
6. **One results page**: a scenario × clause table, a transition grid with a frame strip per transition, and a fixed denominator (the minimal set's size is known before the run, so missing scenarios count as UNVERIFIED, never vanish).

## 5. When it runs

- Model check: every pull request (seconds, no simulator).
- Frame matrix: every push to `development`, and on demand for a library change.

## 6. Where it runs

- Slim simulators: `simslim on <udid> --except widgets,web` (keeps Live Activities and Safari's web services, stops about 150 other daemons). A slim Duo boots at about 2 GB instead of about 7 GB.
- Two hosts: the Mac mini (M4 Pro, 64 GB) and the MacBook Pro (M2, 16 GB) through mac-worker (worker/v1 jobs at a pinned commit, artifacts pulled back and hash checked).
- Each host runs its own site and beacon: the page only reports to a loopback beacon, so simulators, site and beacon share a machine.
- Simulators per host (N) are calibrated: run the calibration set at increasing N and keep the highest N whose results match a single simulator's (timing contention must not create false flash or settle reds).
- Shards from both hosts merge into the one results page.

## 7. Order of delivery

1. Thin slice first: one window (Safari tab, folded), its gap map, its model check, one calibrated judge, its transitions on frames, the results page. Then widen window by window.
2. Reuse the existing harness (`e2e.py`, `beacon.mjs`, the reporter, the UI-test runner, `matrix.sh`). Change it; do not rewrite it.
