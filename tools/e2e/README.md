# Duo e2e

Automated placement checks for Duet on the iPhone Duo simulator: Safari tab in every rotation path, in-app preview (SFSafariViewController) in all three sheet styles and rotations, preview -> "Open in Safari" from portrait and both landscapes, fold and unfold in every posture, and dark mode. Each step records every sample of the page's own Duet state during the transition, the native button frames, a screenshot and, for transitions, a video and contact sheet, then asserts it against [EXPECTED.md](EXPECTED.md).

## Run

```sh
tools/e2e/run.sh                                   # whole matrix on "Duo Lab"
tools/e2e/run.sh --only tab,fold                   # scenarios: tab, preview-sheet, preview-default, preview-full, open-in-safari, open-in-safari-90, open-in-safari-270, fold, dark
tools/e2e/run.sh --md /path/round.md               # also write a markdown table
DUO_UDID=<udid> tools/e2e/run.sh                   # another Duo simulator
tools/e2e/.venv/bin/python -I tools/e2e/e2e.py --udid <udid> --rerender tools/e2e/reports/<ts>   # re-assess a saved run with current rules
```

`run.sh` rebuilds the `duet-ui` dist (`pnpm -s build`) and `fold/fold.bin` when stale, starts whatever is not already up and stops only what it started: the site from this checkout (`next dev -p 3140`, required to answer `/?e2e=1` with 200), the beacon (`:3141`), the host app plus UI-test runner (built with Xcode 27.1, see SDK), and a `.venv` with pillow. Output goes to `tools/e2e/reports/<ts>/`: `index.html` (table, overlays, contact sheets), `steps/<id>.json` (every sample, native frames, expectation, verdict), `shots/`.

Exit status: 1 when any step FAILs, 2 when any step is BLOCKED or the environment cannot start (broken dist build, site not answering, fold tool missing), else 0. UNSUPPORTED steps (split view) are listed with the reason and do not change the exit status.

## Rotation and fold

`fold/fold.bin` is a simulator command line tool that calls SpringBoard's display tool service (`SBSDisplayToolService.swapDisplayWithSettings`, the call behind Apple's internal `suiatool`). e2e.py runs it with `xcrun simctl spawn <udid> fold.bin -position=closed|open -deviceOrientation=portrait|landscapeRight|landscapeLeft|portraitUpsideDown -wait`, then `-unlock`. It drives every turn and fold with no human in the loop. Private API, simulator only. The turn lands about 4s after the call, so a step samples from the call until the signals are quiet.

`landscapeRight` is angle 90, `landscapeLeft` 270. Unfolded, `portrait` gives the wide 951x669 window at angle 270, `landscapeRight` and `landscapeLeft` the tall 669x951 window at 180 and 0. Angle 180 on the closed screen keeps Safari in its previous orientation, so the expectation there is "same as before".

## Architecture

- `apps/site/app/e2e-reporter.tsx`: loaded only with `?e2e`. Every 40ms posts the Duet state to the beacon: page id (random per load), preview flag and reason, mode/side, `hidden`, `confidence`, slot rects, scroll, visualViewport, overflowing or clipped elements, content under controls.
- `beacon.mjs`: tags each sample with the driver's current step; relays device commands (`/cmd`) to the UI-test runner; `/runner` reports liveness.
- `host/`: `DuoE2EHost` presents the URL in SFSafariViewController (`-url`, `-style sheet|default|full`). `DuoE2ERunner` (XCUITest) long-polls the beacon for commands: tap or drag by label, read element frames for a bundle (`com.apple.SafariViewService` for the preview's own buttons).
- `fold/`: `fold.bin` source and build script.
- `e2e.py`: scenarios, drivers (simctl openurl / launch, runner taps, fold.bin), assertions, overlays, contact sheets, report.

## Assertions

Every sample from the start of the action until the signals have been quiet for 1.5s (at least 2.5s, at most 7s), filtered to the step's page id. Gaps between samples over 150ms are noted.

On every sample:

- flash: no visible placement other than the expected one, or the previous one before the window signals change (the previous one gets 0.15s of grace after the change). Hidden controls (`data-hidden`) never count as a flash.
- on screen: every visible slot is inside the screen (closed: screen points via `origin()`, so Safari's column counts; open: the visual viewport).

On the final state:

- preview flag, mode, side and `hidden` match the expectation (Safari tab: column right at 0 and 270, left at 90; preview portrait: column in the native gap; preview landscape: hidden, see EXPECTED.md; unfolded: strip or inline per the window).
- settle: the last placement change is within 0.5s of the last signal change; slide: slot rects stop moving within 0.15s.
- closed: no overlap with native buttons, and in the preview the slots sit in the gap between Page Menu (or Cancel/Done/Close) and Back.
- no clipped text or overflowing block within the visible band.

Overlay colors: red = Duet slots, blue = native buttons, green = the required gap. Contact sheets start 0.3s before the first signal change.

The harness is checked against a reverted library: with `packages/duet-ui/src` at the previous commit, tab and fold turns FAIL (flashes at the wrong edge), so a pass is meaningful.

## Geometry

Page rects are mapped to screen points with `origin()` in e2e.py, checked against overlays in every orientation:

- `col = outerW - innerW` at angle 90, else 0 (the preview reserves its native column on the left at 90).
- preview: `x0 = (W - outerW)/2 + col + vv.x`, `y0 = H - innerH`. Safari tab: `x0 = col + vv.x`, `y0 = 0`.
- landscape preview has `vv.x` / `scrollX` of +84 at 90 and -84 at 270 while `scrollWidth == clientWidth`; the overflow band is `[min(0, -scrollX), max(W, W - scrollX)]` so that inset is not reported as overflow.
- the dismissing preview briefly reports width 935, inline; ignored via page ids.
- unfolded, `screen.*` goes stale; the inner display is screenshot with `--display=3`, the outer with `--display=1`. Native frames are not mapped there (XCUITest frames are unusable on the inner display), so overlap checks run on the closed screen only.

## SDK

The host must be built with the iOS 27 SDK (Xcode 27.1). With an older SDK it runs letterboxed at 375x667 and its preview does not match a Duo-native app. Duo-native preview sheet: inner 366x600, outer 450x670, 34pt inset; `default` and `full` styles: 382x603. These match the real device.

## Limits

- Split view (UNSUPPORTED): no API enters, moves or swaps Safari between split panes; tab drags, long presses and bottom bar swipes on the inner display did not open one. Split geometry (pane 469x669, page 385x571) is covered by unit fixtures.
- Only the simulator: physical Duo devices are not driven. Real-device geometry is pinned in unit fixtures (`packages/duet-ui/test/`).
