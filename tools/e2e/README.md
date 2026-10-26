# Duo e2e

Automated placement checks for Duet on the iPhone Duo simulator: Safari tab, in-app preview (SFSafariViewController) in all three sheet styles, rotations, and preview -> "Open in Safari". Each step records the page's own Duet state, the native button frames, and a screenshot, then asserts it against [EXPECTED.md](EXPECTED.md).

## Run

```sh
tools/e2e/run.sh                                   # whole matrix on "Duo Lab"
tools/e2e/run.sh --only tab,preview-sheet          # scenarios: tab, preview-sheet, preview-default, preview-full, open-in-safari
tools/e2e/run.sh --md /path/round.md               # also write a markdown table
DUO_UDID=<udid> tools/e2e/run.sh                   # another Duo simulator
tools/e2e/.venv/bin/python -I tools/e2e/e2e.py --udid <udid> --rerender tools/e2e/reports/<ts>   # re-assess a saved run with current rules
```

`run.sh` starts whatever is not already up and stops only what it started: the site from this checkout (`next dev -p 3140`), the beacon (`:3141`), the host app plus UI-test runner (built with Xcode 27.1, see SDK), and a `.venv` with pillow. Output goes to `tools/e2e/reports/<ts>/`: `index.html` (table plus overlays), `steps/<id>.json` (every sample, native frames, expectation, verdict), `shots/`.

Exit status is non-zero when any step FAILs. BLOCKED steps are states no automation can reach today (see Limits), listed so the gap stays visible.

## Rotation

The only thing that rotates the Duo outer display is the Claude Code iOS Simulator MCP `rotate` action. `simctl`, XCUIDevice.orientation, the Simulator menu via osascript, GraphicsServices purple events and `devicectl device orientation` all leave the outer display unrotated (tried, removed). So rotation steps are a handshake:

1. e2e.py writes `reports/<ts>/WAITING` and prints `ROTATE <left|left2> to angle <n>`.
2. Whoever drives (an agent with the MCP, or a person in Simulator) turns the device; `left2` means two left turns.
3. e2e.py polls the beacon until the page reports that angle (`--rot-timeout`, default 120s), otherwise the step is BLOCKED.

`--rotate-cmd 'cmd {udid} {dir} {angle}'` runs a command per turn instead, for when a scriptable rotator exists. The cycle is 0 -> 90 -> 270 -> 0. Angle 180 is not reachable: Safari and the preview keep their previous orientation upside down (two left turns from 90 stay at 90).

## Architecture

- `apps/site/app/e2e-reporter.tsx`: loaded only with `?e2e`. Every 100ms posts the Duet state to the beacon: page id (random per load), preview flag and reason, mode/side, slot rects, scroll, visualViewport, overflowing or clipped elements, content under controls.
- `beacon.mjs`: tags each sample with the driver's current step; relays device commands (`/cmd`) to the UI-test runner; `/runner` reports liveness.
- `host/`: `DuoE2EHost` presents the URL in SFSafariViewController (`-url`, `-style sheet|default|full`). `DuoE2ERunner` (XCUITest) long-polls the beacon for commands: tap a button by label, read element frames for a bundle (`com.apple.SafariViewService` for the preview's own buttons).
- `e2e.py`: scenarios, drivers (simctl openurl / launch, runner taps), assertions, overlays, report.

## Assertions

Per step, over 2.5s of samples filtered to the step's page id:

- preview flag, mode and side match the expected state (Safari tab: column right at 0 and 270, column left at 90; preview: column inside the native gap).
- every slot is on screen and does not overlap a native button. In the preview, slots must sit in the gap of the native column between Page Menu (or Cancel/Done/Close) and Back, if that gap is at least 49pt tall; otherwise any non-overlapping fallback passes, noted.
- no clipped text or overflowing block within the visible band; content not under controls.
- settle: the last placement change is within 0.5s of the step's first sample and nothing moves after (drift).

Overlay colors: red = Duet slots, blue = native buttons, green = the required gap.

## Geometry

Page rects are mapped to screen points with `origin()` in e2e.py, checked against overlays in every orientation:

- `col = outerW - innerW` at angle 90, else 0 (the preview reserves its native column on the left at 90).
- preview: `x0 = (W - outerW)/2 + col + vv.x`, `y0 = H - innerH`. Safari tab: `x0 = col + vv.x`, `y0 = 0`.
- landscape preview has `vv.x` / `scrollX` of +84 at 90 and -84 at 270 while `scrollWidth == clientWidth`; the overflow band is `[min(0, -scrollX), max(W, W - scrollX)]` so that inset is not reported as overflow.
- the dismissing preview briefly reports width 935, inline; ignored via page ids.

## SDK

The host must be built with the iOS 27 SDK (Xcode 27.1). With an older SDK it runs letterboxed at 375x667 and its preview does not match a Duo-native app. Duo-native preview sheet: inner 366x600, outer 450x670, 34pt inset; `default` and `full` styles: 382x603. These match the real device.

## Limits (BLOCKED steps)

- Fold/unfold: the hinge state is only reachable through a private dtuhidd XPC endpoint; no public simctl, devicectl or XCTest API. Unfolded full, split and fold transitions stay manual.
- Split view: no API enters, moves or swaps Safari between split panes on the simulator.
- Angle 180: not a UI state on the Duo (see Rotation).
- Only the simulator: physical Duo devices are not driven.
