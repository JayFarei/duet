# Column-mode regression harness

Automates the checks that used to need a human watching the device: controls drifting while the page scrolls, controls missing from Safari's column, and column taps that silently do nothing. Everything runs on the "Duo Lab" simulator only (`6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4`), never the other one.

Python: `duo-lab/.venv/bin/python -I` (needs opencv, numpy). Points are iOS points; captures are 3x.

## Setup

```bash
xcrun simctl openurl 6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4 "http://localhost:3078/duo-lab?tabs=5,searchTab=1,back=1,actions=2,title=1,feed=1&r=$RANDOM"
```

Wait about 9s for load. Gestures are injected with the simulator MCP tool (`touch_path`, `swipe`, `tap`). Taps must use `duration: 0.12`: zero-length injected taps deliver no touch events at all.

Column tap points with this lab URL: "…" (418,410), tab pill (418,506), Safari back (418,198), bookmarks (418,258), Safari + (418,565).

## Scenarios

| Scenario | Gesture | Check | Fails when |
|---|---|---|---|
| Drift | `rec.sh start d.mp4`, flick up then down with momentum (`touch_path` x=200, fast), wait for rest, `rec.sh stop d.mp4` | `drift.py d.mp4 --expect 6 --out d.png` | any glyph moves > 1pt, or not 6 controls (ours 4 + Safari's) |
| "…" opens | `rec.sh shot a.png`, tap (418,410), `rec.sh shot b.png` | `tap.py --at 418,410 a.png b.png` | the button glyph did not change |
| "×" closes | tap (418,410) again, `rec.sh shot c.png` | `tap.py --same --at 418,410 a.png c.png` | not back to the initial glyph |
| Tab island opens | tap (418,506), shot | `tap.py --at 418,506 before after` | pill unchanged |
| Outside tap closes | tap (200,330) in the page, shot | `tap.py --same --at 418,506 initial after` | island still open |
| Magnet drag (open posture, inline) | record without `--display`, `touch_path` from "…" left 40pt and hold, then on to x 300 | frames: held strip moves < 18pt, then switches to the left | strip follows the finger before 64pt, or does not switch |
| Magnet spring-back | `touch_path` 50pt toward the middle, release | frames | strip changes side |
| Lens scrub | record, `touch_path` x=419 y 474 → 525 → 423, stop | review frames against the News reference | visual only for now |

`drift.py` uses Safari's own glyphs as the control: if they move, the tracker is wrong, not our chrome. `tap.py` compares glyph masks, not raw pixels, so page content reflowing behind the column does not count as a reaction.

Known baselines (column without children, `/scroll?marker`): flicks to the page end failed at 12 to 18pt while Safari's toolbar grew back with a measured range, and pass at 2pt with the `100dvh` range (#100).

Per-frame trace: start the site with `DUET_TRACE=<file.csv>` and add `&trace` to the `/scroll` lab URL. Each frame appends `t, scrollY, innerHeight, clientHeight, scrollHeight, visualViewport height, visualViewport offsetTop, the layer's computed translateY, its rect top, a 100dvh probe, events since the last frame` (`s` scroll, `r` resize, `vr` visualViewport resize) through the dev-only `/api/lab-trace` route. The computed translateY minus scrollY is the main-thread error; drift.py on a recording is what Safari actually painted, and the two can disagree.

Known baselines: the user's drift video fails at 11pt; the pre-fix build fails at 30pt; the inner-scroller build passes at 0.0pt with 6 controls.

## Layout overlap (WebKit, no simulator)

`duo-lab/.venv/bin/python -I duo-lab/harness/overlap.py` opens the lab in Playwright WebKit at the split-view pane (385x571), open posture (951x543) and closed landscape (594x368), strip on each side. It fails when any visible page text crosses into the strip's x range, or the sticky title stops short of the edge behind the strip (scrolled content then shows between them). Caught the split-view screenshot of 2026-10-24: bleed bands laid text out under the strip ("120Hz" under the bell). Needs the dev server on 3078 and `pip install playwright` in the venv.

## Unit tests

`node --test duo-lab/harness/` runs `transitions.test.mjs` against `src/lib/native-chrome/geometry.ts` (Node 23.6+ strips the types). It pins the mode for every recorded window signature, the flip damper and the magnet curve, so the split-view loop and magnet regressions fail without a device.
