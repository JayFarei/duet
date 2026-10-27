# Duo e2e

Automated placement checks for Duet on the iPhone Duo simulator: Safari tab in every rotation path, in-app preview (SFSafariViewController) in all three sheet styles and rotations, the preview across unfold, turn and fold (and opened unfolded), preview -> "Open in Safari" from portrait and both landscapes and then unfolded, fold and unfold in every posture, split view (left pane, right pane, moving between panes, back to full width, turning and folding from split view), largest Dynamic Type, and dark mode. Each step records every sample of the page's own Duet state during the transition, the native button frames, a screenshot and, for transitions, a video and contact sheet, then asserts it against [EXPECTED.md](EXPECTED.md).

## Run

```sh
tools/e2e/run.sh                                   # whole matrix on "Duo Lab"
tools/e2e/run.sh --only tab,fold                   # scenarios: tab, preview-sheet, preview-default, preview-full, open-in-safari, open-in-safari-90, open-in-safari-270, fold, dark, preview-unfolded, open-in-safari-unfold, split, split-turn, dynamic-type, live-tab, live-preview-sheet, live-preview-default, live-preview-full
tools/e2e/run.sh --md /path/round.md               # also write a markdown table
DUO_UDID=<udid> tools/e2e/run.sh                   # another Duo simulator
tools/e2e/.venv/bin/python -I tools/e2e/e2e.py --udid <udid> --rerender tools/e2e/reports/<ts>   # re-assess a saved run with current rules
```

`run.sh` rebuilds the `duet-ui` dist (`pnpm -s build`) and `fold/fold.bin` when stale, starts whatever is not already up and stops only what it started: the site from this checkout (`next dev -p 3140`, required to answer `/?e2e=1` with 200), the beacon (`:3141`), the host app plus UI-test runner (built with Xcode 27.1, see SDK), and a `.venv` with pillow. Output goes to `tools/e2e/reports/<ts>/`: `index.html` (table, overlays, contact sheets), `steps/<id>.json` (every sample, native frames, expectation, verdict), `shots/`.

Exit status: 1 when any step FAILs, 2 when any step is BLOCKED or the environment cannot start (broken dist build, site not answering, fold tool missing), else 0. split, split-turn and open-in-safari-unfold need the simulator helper (Split view below) and are BLOCKED without it.

## Rotation and fold

`fold/fold.bin` is a simulator command line tool that calls SpringBoard's display tool service (`SBSDisplayToolService.swapDisplayWithSettings`, the call behind Apple's internal `suiatool`). e2e.py runs it with `xcrun simctl spawn <udid> fold.bin -position=closed|open -deviceOrientation=portrait|landscapeRight|landscapeLeft|portraitUpsideDown -wait`, then `-unlock`. It drives every turn and fold with no human in the loop. Private API, simulator only. The turn lands about 4s after the call, so a step samples from the call until the signals are quiet.

`landscapeRight` is angle 90, `landscapeLeft` 270. Unfolded, `portrait` gives the wide 951x669 window at angle 270, `landscapeRight` and `landscapeLeft` the tall 669x951 window at 180 and 0. Angle 180 on the closed screen keeps Safari in its previous orientation, so the expectation there is "same as before".

## Architecture

- `apps/site/app/e2e-reporter.tsx`: loaded only with `?e2e`. Every 40ms posts the Duet state to the beacon: page id (random per load), `document.visibilityState` and `hasFocus()`, preview flag and reason, mode/side, `hidden`, `confidence`, slot rects, scroll, visualViewport, overflowing or clipped elements, content under controls.
- `beacon.mjs`: tags each sample with the driver's current step; relays device commands (`/cmd`) to the UI-test runner; `/runner` reports liveness.
- `host/`: `DuoE2EHost` presents the URL in SFSafariViewController (`-url`, `-style sheet|default|full`). `DuoE2ERunner` (XCUITest) long-polls the beacon for commands: tap or drag by label, read element frames for a bundle (`com.apple.SafariViewService` for the preview's own buttons).
- `fold/`: `fold.bin` source and build script.
- `sim.py`: client for the Claude desktop app's simulator helper (touches, Home, accessibility trees by pid), see Split view.
- `e2e.py`: scenarios, drivers (simctl openurl / launch, runner taps, fold.bin, sim.py), assertions, overlays, contact sheets, report.

## Assertions

Every sample from the start of the action until the signals have been quiet for 1.5s (at least 2.5s, at most 7s), filtered to the step's page id. Gaps between samples over 150ms are noted. Samples taken while the page is hidden (`visibilityState` hidden: Safari behind the home screen or the split view menu while the driver picks the other app) are noted and not judged: a backgrounded page keeps laying out, at whatever window size SpringBoard hands it (a closed 466x678 snapshot, a 951x669 window), and nobody sees it. A visible but unfocused split pane is judged like any other. The first render after the page is shown again (within 0.15s) is noted and not judged when it repeats the layout the page had while hidden: SpringBoard animates a snapshot over it then (screen recording, round 3), so nobody sees it either.

On every sample:

- flash: no visible placement other than the expected one, or the previous one before the window signals change (the previous one gets 0.15s of grace after the change). Hidden controls (`data-hidden`) never count as a flash.
- on screen: every visible slot is inside the screen (closed: screen points via `origin()`, so Safari's column counts; open: the visual viewport).

On the final state:

- preview flag, mode, side and `hidden` match the expectation (Safari tab: column right at 0 and 270, left at 90; preview portrait: column in the native gap; preview landscape: sheet hidden, default and full a strip in the turned-side safe-area inset below the native top bar; unfolded: inline right, preview flag set).
- every icon a visible slot draws (its svg rects, reported per slot) is painted: its crop of the final screenshot has a luminance standard deviation of at least 6 (painted icons measure 45 to 120). Catches the round 3 pill that showed only the selected tab's icon.
- settle: the last placement change is within 0.5s of the last signal change; slide: slot rects stop moving within 0.15s.
- closed: no overlap with native buttons, and in the preview the slots sit in the gap between Page Menu (or Cancel/Done/Close) and Back.
- unfolded: no overlap with Safari's or the preview's native buttons, in window points (Geometry); every slot inside the window is fully inside it; in split view at least two controls show in Safari's pane.
- no clipped text or overflowing block within the visible band.

Overlay colors: red = Duet slots, blue = native buttons, green = the required gap. Contact sheets start 0.3s before the first signal change.

The beacon drops a device command nobody took within its timeout: a queued "stop" left from a previous run's cleanup once ended the next run's UI-test runner at start, and every runner step then failed.

The harness is checked against a reverted library: with `packages/duet-ui/src` at the previous commit, tab and fold turns FAIL (flashes at the wrong edge), so a pass is meaningful.

## Geometry

Page rects are mapped to screen points with `origin()` in e2e.py, checked against overlays in every orientation:

- `col = outerW - innerW` at angle 90, else 0 (the preview reserves its native column on the left at 90).
- preview: `x0 = (W - outerW)/2 + col + vv.x`, `y0 = H - innerH`. Safari tab: `x0 = col + vv.x`, `y0 = 0`.
- landscape preview has `vv.x` / `scrollX` of +84 at 90 and -84 at 270 while `scrollWidth == clientWidth`; the overflow band is `[min(0, -scrollX), max(W, W - scrollX)]` so that inset is not reported as overflow.
- the dismissing preview briefly reports width 935, inline; ignored via page ids.
- unfolded, `screen.*` goes stale; the inner display is screenshot with `--display=3`, the outer with `--display=1`. XCUITest frames are unusable on the inner display, so native frames come from the simulator helper (`uiDescribeApplication` on Safari's or SafariViewService's pid), in points of the app's window: the pane in split view, the display otherwise. `origin_open()` maps page rects into that window: split pane `x0 = 84` when Safari's column is on the left (native Back left of the pane's middle; the document is scrolled one column across), else 0, `y0 = 0`; full width `y0 = outerH - innerH` (bars above the page); preview sheet `x0 = (screenW - outerW) / 2` (951 wide, 669 tall), `y0 = Back.y - innerH`.
- measured unfolded frames are pinned in `packages/duet-ui/test/unfolded.test.mjs` (split left and right pane, full width, the preview sheet wide and tall).

## SDK

The host must be built with the iOS 27 SDK (Xcode 27.1). With an older SDK it runs letterboxed at 375x667 and its preview does not match a Duo-native app. Duo-native preview sheet: inner 366x600, outer 450x670, 34pt inset; `default` and `full` styles: 382x603. These match the real device.

## Split view

Nothing in simctl or XCUITest enters split view on the inner display: XCUITest's synthesized touches and SimulatorKit's legacy HID do not reach it. The Claude desktop app's simulator helper (`claude-ios-sim`, idb based; `sim.py`) negotiates CoreSimulator's dtuhid transport and does, so the driver uses Apple's own gestures:

- Safari into the left pane: Home, long-press the Safari icon, "Open in Split View" (SpringBoard's `...application-shortcut-item.open-in-split`), then `simctl launch` the host app into the right pane.
- Safari into the right pane: the same with the host app's icon, then tap Safari on the home screen shown in the right pane.
- moving between panes: quit the host first, then the recipe above. "Open in Split View" on an app of a live pair brings the same pair back, so the move is split -> Safari full width -> split on the other side; Safari keeps its window and document. The landed pane is verified against Safari's native Back (BLOCKED if wrong).
- after landing, the driver taps the page's title in Safari's pane: the focused app is the one that keeps the screen when the tall posture or the fold drops split view.
- app icons may sit on another Home Screen page (HOME lands on whichever page was last shown, widgets included): a miss swipes the page and looks again. Safari is in the dock on every page.
- back to full width: drag the divider (476,335 on the wide display) to the far edge.
- SpringBoard elements are found by accessibility identifier through SpringBoard's own pid (the frontmost app in split view is the other pane's app), and its unrotated frames are mapped to the wide display, `(W - y, x)` at rotation 90.

The second app is always `DuoE2EHost` (`dev.duolab.e2e.host`), never another Home Screen app.

## Limits

- Split view exists only in the wide unfolded posture: turning to the tall posture keeps the focused app full screen, and so does folding; split view does not come back on turning wide again.
- Live Activities: the `live-*` scenarios start a real music activity from `DuoE2EHost` (`host/Host/Live.swift`, driven through the beacon's `/la`) and film every step; `run.sh` loads the runtime's `chronod` and `liveactivitiesd`, which the simulator leaves unloaded. ActivityKit starts an activity only from the foreground, so in a Safari tab the host comes forward and Safari goes back in front (the page is not reloaded). The island's activity frame is read from SpringBoard on every closed step and checked as a native obstacle; in closed landscape the island shows no activity. Each scenario's clips are stitched into one captioned film, `shots/<scenario>.mp4`, linked at the top of the report. `dynamic-type` runs the preview and the tab at the largest accessibility text size: Safari's and the preview's buttons are fixed size, so the gap must not move. Safari's bottom bar does grow there (98 -> 106pt), which the library's column signature now admits.
- Folding with the preview open (`pvu-fold`) intermittently leaves WebKit reporting a negative `visualViewport.height` (-78) until the next resize; the library treats a non-positive visual height as no keyboard (`keyboardUp`), else the controls hid as if the keyboard were up.
- No split view in the tall posture, so there is nothing to place there; `split-turn` checks that Safari takes the screen.
- `split-drag` (experimental, only with `--only split-drag`) tries a direct pane swap by dragging the pane's top handle. Round 4: blocked, the drag does not swap the panes and the simulator's accessibility tree exposes no pane handle to aim at (the dump is saved as `steps/<step>-ui.json`). `split` moves between panes through full width (quit the other app, open in split view on the other side), the path SpringBoard drives reliably.
- Unfolded steps without native frames (the preview sheet unfolded) skip the overlap and icon checks: slot positions in the window come from the native frames.
- One render after a viewport resize is not judged off screen: the page samples the new size before React has re-placed the controls (`pvu-tall`, round 3). A JS-positioned layout always has that frame.
- Only the simulator: physical Duo devices are not driven. Real-device geometry is pinned in unit fixtures (`packages/duet-ui/test/`).
- The simulator helper is a single client process per run; other agents' helpers on other simulators are unaffected, but never kill runners or helpers by name (`pkill`): an earlier round did and stopped another agent's runner.
