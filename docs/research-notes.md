> **Historical lab notes from 2026-10-24**, written while column mode was being built, before `duet-ui` was published. Paths, names (`native-chrome`, `DuoChrome`) and some conclusions are out of date, for example split-view panes now use Safari's column on both sides instead of always falling back to inline. For current behaviour, read the [README](../README.md#how-duet-decides) and `packages/duet-ui/src/geometry.ts`.
>
> Current behaviour in short: `strip` when running as a Home Screen app with a side inset of at least 60px; `column` in Safari (not in an iframe, portrait or a known landscape turn, not zoomed; the keyboard keeps the mode) when the window minus the page is 80 to 88px wide and 68 to 102px tall and the window is a Duo or split-view size; `inline` otherwise. Column placement uses the constants measured here. An in-app Safari preview (a 466x678 window with 75pt of chrome and a bottom inset, a sheet inside the screen, or the older 375x667 at 3x) is `column` in portrait, in the gap of its own column between reader/menu and back; turned, `inline` on the side away from its column (see "Preview placement in the gap").

# Handoff: our controls inside Safari's column on the iPhone Duo

## Goal

On the iPhone Duo (closed portrait, 466x678pt), iOS gives every app a right-hand control strip. A Home Screen web app gets the strip itself (`env(safe-area-inset-right)` ≥ 60), and our `DuoChrome` draws there; that mode works. In a Safari tab, Safari owns the strip: back + reader at the top, a +/tabs pill at the bottom. The aim is to render our page's controls (back, actions group, tab pill) in that same column, in the free space between Safari's buttons, so they look and act like part of Safari's chrome. Taps must work, scroll must not move them, and placement must hold in every Safari state the user can reach.

## Where things are

- Library: `src/lib/native-chrome/` (`geometry.ts` placement engine, `chrome.tsx` rendering + `useColumnLayer`, `native-chrome.css`).
- Lab page: `src/app/duo-lab/` at http://localhost:3078/duo-lab (dev server: `npx next dev -p 3078 -H 127.0.0.1`, exposed with `tailscale serve`).
- Native reference measurements: SwiftUI app in `duo-lab/ios`, numbers in `DUO` in `geometry.ts`. `duo-lab/edges.py img [cx]` measures control top/bottom from a 3x screenshot.
- Captures: `duo-lab/captures/` (`w-safari-column.png`, `w-safari-column-menu.png` are the working state).
- Branch `duo-chrome`, PR #2 (Closes #1), last commit `6427731`.
- Simulator: use only "Duo Lab" `6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4`. Never drive `3962C431-6040-4E24-814D-5877101F797E` (shared), never touch the user's HOTDROP app, bookmarks or tabs.

## What we learned (verified on the simulator)

1. Safari tab viewport is 382x580; screen is 466x678. `position: fixed` content is clipped at x=382, so fixed chrome can never reach the column.
2. In-document content (an absolute layer wider than the viewport) does paint into Safari's column area. This is the only rendering path found.
3. To keep it on screen, the document itself never scrolls: page content scrolls inside `.duo-scroller` (absolute, widened by `--duo-under` so bleeds still reach under the column), so the layer never moves. The earlier `translateY(scrollY)` on scroll events lagged momentum scrolling by up to 30pt (issue #1, the user's drift video); it stays only as a fallback for pages without the scroller.
4. The wide layer makes the page pan sideways. `overflow-x: hidden` and `overflow-x: clip` both re-clip or shift the layer. `touch-action: pan-y` on `<html>` stops panning and keeps the paint.
5. Touches in the column reach the page as `pointerdown`/`touchstart` with `clientX ≥ innerWidth`, but WebKit does not hit-test them to our elements and usually keeps the touch end (no `pointerup`, no `click`). Workaround: window `pointerdown` listener, find the button whose `getBoundingClientRect` contains the point, call `.click()`. `:active` styles therefore never show.
6. Safari column grid in the default portrait state: centre x = screenWidth − 48.2 = 417.8; first slot top 173.3; back and reader take 2 rows (49 + 11 gap each), so our first slot is at 293.3; Safari's +/tabs pill is 112.7 tall and ends 23.7 above the bottom. A 5-tab pill does not fit between, so it auto-minimizes to the selected tab.

## What is broken (user's report, 3 screenshots, 2026-10-24)

1. Split view / small Safari window (Duo open, Safari in the right pane): our actions group and tab render inside the page content near its right edge, not in Safari's column. Cause: `centerX` uses `screen.width`, which is not the Safari window's width in split view; the column's real x and the page's width are unknown to us.
2. Landscape full Safari: Safari moves its chrome to a top toolbar and there is no column. Our controls render mid-page, stacked on each other (tab button over "…"). Cause: `detect()` returns `column` whenever there is no right inset; it has no "no column at all" mode.
3. Portrait, Safari in its other state (after scroll / compact toolbar: column shows ✕, ≡, and a vertical share/reload/compass pill, toolbar collapsed into the URL at top): our back, actions and tab overlap Safari's pill. Cause: we hardcode Safari's layout (2 rows top, 2-item pill bottom); Safari's column content changes by state and we cannot see it.
4. User could not confirm taps work on device; only verified in my simulator via injected taps.
5. Scroll behaviour looked wrong to the user (lag/drift of the layer, possibly also the page panning in some states).

## Root problem

We are positioning into a region the page does not own, using a fixed guess of Safari's layout. The page gets no signal for: Safari window width in split view, whether the column exists, which Safari toolbar state is active, or where Safari's own buttons are. Every fix so far was another hardcoded constant.

## Open questions for the next agent

- Is there any reliable signal of Safari's column geometry: `visualViewport` (offsetLeft/width/scale), `screen.availWidth`, `window.outerWidth`, `matchMedia` on device-width, resize events when the toolbar collapses? Measure them in each state (portrait default, portrait compact, landscape, split view small/large) on the Duo Lab simulator and tabulate.
- Can we detect Safari's compact/expanded toolbar state (innerHeight changes when the toolbar collapses; does 580 change?)?
- Is in-document painting into the column a stable WebKit behaviour or an artefact we should not build on? If unstable, the honest fallback is: in Safari, render our controls inside the viewport (a right-edge strip within the 382pt page), and use the real strip only in standalone mode.
- Better scroll tracking than scroll events (e.g. `position: sticky` tricks, or a `position: fixed` wrapper with an absolute child that overflows; check whether clipping applies to descendants).
- Can taps be made native (real hit-testing, `:active`) for content outside the layout viewport, or is coordinate routing the ceiling?

## Definition of done

On the Duo Lab simulator, recorded with screenshots for each state (portrait default, portrait compact toolbar, landscape, split view): our controls either sit cleanly in Safari's column without overlapping any Safari button, or fall back to a sensible in-viewport layout when the column is unavailable or unknown. No mid-page stacking ever. Taps on every control work (back, each action, "…" menu and its items, tab). Controls stay put during normal and momentum scroll. Page never pans sideways. Committed on `duo-chrome` with Refs #1, PR #2 description updated.

## Results (2026-10-24)

### Step 1: measurements (Duo Lab simulator, probe page)

| State | inner | outer | visualViewport | Events | Column |
|---|---|---|---|---|---|
| Closed portrait, default toolbar | 382x580 | 466x678 | 382x580 @0,0, scale 1 | resize + vv resize | yes, right |
| Closed portrait, compact URL bar (after scroll) | 382x598 | 466x678 | 382x598 | vv resize only | yes, unchanged |
| Closed portrait, keyboard up | 382x580 | 466x678 | height 345 or 413 | vv resize | yes |
| Closed landscape | 594x368 | 678x466 (lags ~400ms) | matches inner | resize, orientationchange | yes, on the camera's side: left at angle 90 (back slot top 81.5, pill top 327), right at angle 270 (back 23.5, pill 279); remeasured 2026-10-26, iOS 27.1 |
| Open posture | 951x543 (669 wide when rotated) | 951x669 (lags) | matches inner | resize | no, top toolbar |
| Split view pane (device) | 385x571 | 469x669 | matches inner | resize | Safari draws its column, but our in-document paint does not show there (round 5) |

Findings: `screen.*` is stale after posture changes (stays 466x678), never use it in Safari. `outerWidth/outerHeight` is right but lags rotation by ~400ms, so signals are re-read at 0, 300 and 600ms. visualViewport offsetLeft/offsetTop/scale stay 0/0/1 in every state and say nothing about the column. Column signature: `outer − inner` width 80 to 88 (84 measured) and height 76 to 102 (98 default, 80 compact URL bar). Safari's "compact" column state (✕, ≡, share/reload/compass) from the user's report could not be reproduced and has no signal we found.

### Step 2: decision

Painting into Safari's column is an undocumented WebKit artefact (in-document content painted outside the layout viewport), so it is only used under a strict whitelist: not standalone, column signature present, portrait (`innerHeight > innerWidth`), keyboard down. Update 2026-10-26: closed landscape is whitelisted too, when the window is the closed screen and `screen.orientation.angle` is 90 (column left) or 270 (column right); an unknown angle stays inline. Turning from one landscape to the other fires no resize, so Duet also listens to `screen.orientation` change. Everything else, including split view and anything we cannot identify, gets `inline` mode: a right-edge strip 84px wide inside the page viewport, page inset by `--duo-right: 84px`. Standalone keeps `strip` mode (real iOS strip). `position: fixed` and `position: sticky` both get clipped at the viewport edge, so column mode keeps the absolute layer, with the inner scroller holding it still.

### Step 3: verification captures (`duo-lab/captures/`)

- s1: column, closed portrait. Back, like, "…" menu and item, tab all tapped.
- s2: column with momentum scroll and compact URL bar; tap with no sideways pan.
- s3: column with full tab pill (fits when no back), tab tapped.
- s4: closed landscape both directions, inline; back, share (menu), tab tapped.
- s5: open posture, inline; back, like, tab tapped (6 actions fit, no "…").
- s6: back to closed portrait after rotations, column mode restored.

### Known limits

- Column layer lags ~10 to 36pt during momentum scroll, then settles.
- Column taps are routed by coordinates, so no `:active` feedback there.
- Safari's compact column state is not detected. Split-view panes are always inline.
- Rotation shows a brief overlap while CSS transitions run (under ~1s).

## Round 2 (2026-10-24)

### Live Activities worst case (Safari column)

On device, two Live Activities (call + Maps, or call + music, same size) grow the Dynamic Island and push Safari's back + reader rows down by 91.7pt (back top 173.3 to 265). Safari's +/tabs pill never moves. Our column band is computed against the pushed position, so it never overlaps Safari in either state:

- Band: 385 to ~531 (146pt), between Safari's pushed reader row and its pill.
- That fits two controls: one "…" launcher (back, leading and actions fold into it, in that order) and the tab pill minimized to the selected tab, which opens a tab menu.
- When the activities end, Safari's rows move back up and ~103pt above our band stays empty. That is the price of never moving our controls when an activity starts or ends; the page gets no signal for island state, so following it is not possible.
- Live Activities cannot be started on the simulator (no Clock / Phone / Maps activity), so the push is the device measurement (`SAFARI.islandPush`), not a simulator capture.

### Home Screen (standalone)

Keeps mimicking SwiftUI: the real iOS strip, `DUO.top` 173.3 fixed. Known limit: with Live Activities the native strip may also shift, and a web app cannot see that.

### Inner scroller

Page content renders inside `.duo-scroller` (fixed, own overflow), so the document never scrolls: no layer lag during momentum, no rubber-band drift of the chrome. `padding-left: env(safe-area-inset-left)` keeps content clear of the island in landscape Home Screen (it was covering the title).

### liquid-glass (Glass-HQ/liquid-glass) evaluation

Not adopted. It renders with WebGPU; the simulator has no adapter (`VGPU-RING1-UNSUPPORTED`) and surfaces render invisible with no fallback. It also needs a bounded scene of opaque content and does not support transformed ancestors, and in column mode there is nothing behind our controls to refract. We keep CSS `.duo-glass` (blur + saturate + rim). Possible later: opt-in for strip/inline on devices with WebGPU, CSS fallback otherwise.

### Second test run (Duo Lab simulator)

| Rendering | Mode | Verified | Capture |
|---|---|---|---|
| Safari, closed portrait | column | scroll, "…" menu, tab menu, outside tap closes | r2-column-tabmenu-closed |
| Safari, closed landscape | inline | tab menu, tab select | r2-safari-landscape-inline |
| Safari, open | inline | full pill, tab tap | r2-safari-open-inline |
| Home Screen, open | strip | "…" menu, item tap | r2-homescreen-open-strip |
| Home Screen, closed | strip | matches native | r2-homescreen-closed-strip |
| Home Screen, landscape | inline | island inset fixed | r2-homescreen-landscape-inline |
| Split view, right pane | inline | device recording 2026-10-24 23:14, simulator cannot enter split view | |

### Split view and the left side

Still open. No signal found that says which side of a split our window is on: `screen.*` is stale, `visualViewport` offsets stay 0, `outerWidth` reports our window only. Current behaviour: a split-view pane is always inline, so the side does not matter. The user can drag the strip to the other edge (magnet drag, round 5). If a left-pane signal is ever needed, the candidates to measure on device are `screenX/screenLeft` and safe-area insets per side.

## Round 3 (2026-10-24)

### GlassyUI surfaces

GlassyUI is vendored in `src/lib/native-chrome/glassyui` (GlassSurface plus its lib). Controls render on GlassSurface with the frost tinted by `--duo-fill`. Its grain (`.lg-noise`) is hidden, it read as dirt on flat iOS controls. In column mode the glass is replaced by a flat, opaque fill with a hairline, because nothing of the page sits behind Safari's column, so blur and shadows only painted artefacts there.

### Light and dark

The theme follows GlassyUI's `[data-lg-theme]` on `<html>` (auto by default, system light/dark), with `prefers-color-scheme` as the fallback before hydration. Every colour is a `--duo-*` token in `native-chrome.css`.

### Island slots (Safari column)

Superseded in Round 4: the 146pt band holds two separate round buttons, the selected tab and "…" (or the one item that fits). Only separate buttons unroll, so nothing is merged into a shared pill to save room. `ISLAND` (46.5pt per slot) now sizes the menu island slots only.

### Menus: one button unrolls into an island

- Only the tapped button unrolls. "…" is its own round button (`Plan.more`), and the minimized tab is its own pill, so a menu never grows out of a group.
- The menu is a horizontal, icon-only pill, 49pt tall. Each slot is 46.5pt, so width = 6 + n × 46.5. The right edge sits on the button's right edge, so it grows toward the page centre like the Dynamic Island, never up into other buttons.
- Animation (Round 4): width only, right edge fixed, on a damped spring sampled into `linear()`, so the island overshoots and settles like an elastic band and thins a little while stretched. Icons fade and scale in after a short delay. With reduced motion there is no animation.
- While open, the source button gets `data-unrolled` and is hidden, so it does not show through the island's end slot. `--duo-menu` (Round 4) is a denser frost than the controls (55% white, 40% black in dark), so the strip under it does not compete with the menu icons.
- The "…" island ends with a close X in the button's own position.

### Home Screen edge blur

iOS blurs the top ~28pt of a standalone viewport (`DUO.edgeBlur`). The lab title pads by `var(--duo-top)` so it sits below the blur instead of under it.

### Split view guard

Round 4 (reverted in round 5, see below): on device, a split-view pane (469x669 outer, 385x571 inner) shows Safari's own column at its right edge, and our inline strip inside the page made two columns. `SAFARI_WINDOWS` now accepts both window heights: 675 to 681 (closed, back row top 173.3) and 665 to 673 (split pane, back row top 123.5, back centre measured at 148, bookmarks 208, + 557, tabs 611, column centre x 421). Our band in the pane: 335 to 522, centre x 420.8. The simulator could not be put into split view (app switcher, long-press tab, home-indicator hold all failed), so this is from the user's device signature and needs a device check.

### Known limits

- Closed posture, Home Screen: the tab island (5 tabs, ~238pt) covers the right part of the Now Playing accessory while it is open. It is transient and closes on outside tap, but the accessory could be hidden while a menu is open if that reads badly.
- Safari column was re-verified with the r3 column captures, not re-recorded after the final island change.

### Third test run (Duo Lab simulator)

| Rendering | Theme | Verified | Capture |
|---|---|---|---|
| Home Screen, closed | dark | "…" island unrolls smoothly, no dots behind | r3-closed-moremenu-dark |
| Home Screen, closed | light | "…" island | r3-closed-moremenu-light |
| Home Screen, closed | light | tab island, selected tab tinted | r3-closed-tabmenu-light |
| Home Screen, open | dark | tab island | r3-open-tabmenu-dark |
| Home Screen, open | dark / light | strip and "…" menu | r3-strip-menu-dark, r3-strip-menu-light |
| Home Screen, closed | dark | title clear of the edge blur | r3-homescreen-closed-dark |
| Safari, closed portrait | light / dark | column island, menus | r3-column-light, r3-column-menu-dark, r3-column-tabmenu-dark, r3-column-tabmenu-light |

## Round 4 (2026-10-24)

### Press lift

As iOS Liquid Glass: a separate button swells to about 1.4x on press and its glass turns lighter (`--duo-lift`), then springs back on release. Items inside a shared surface (groups, the full tab pill) lift as a bubble of their own at 1.25x. `.duo` sets `user-select: none` and `-webkit-touch-callout: none`, otherwise a held press starts text selection and the loupe instead of the lift.

### Glass realism, sampled against native

The native lab app (`duo-lab/ios`) and the web lab take `bg=1..3`: a purple to red gradient, saturated 24pt colour bands, black with thin white lines. Captures were compared side by side for both themes.

- Light: native glass is a milky veil (about 42% white) over roughly twice GlassyUI's control blur, so colour bands melt into a soft wash. Now `--lg-surface-blur: 18px` and `--duo-frost`.
- Dark: native keeps the colours vivid under a light dark veil (`--duo-frost` 10% black).
- Selection: native darkens what is under the selected tab translucently, it never paints an opaque grey pill. `--duo-sel` is a translucent black (10% light, 22% dark). `mix-blend-mode: multiply` was tried and rendered flat in WebKit (the frost is a separate backdrop-filter layer), so it is a plain overlay.
- Not matched: native's specular rim and lens refraction at the edges, and its bolder filled tab symbols (the lab uses lucide line icons; the demo sites use Phosphor fill for the selected tab).

### Demo sites

`/duo-demos` holds three mock customer sites built with the library (Halftone, Low Tide, Marrow), each exercising a different chrome config, designed per the landing-page-design skill (elayadesign/ai-design-skills).

## Regression harness (`duo-lab/harness/`)

See `duo-lab/harness/README.md`. `drift.py` fails a scroll recording when any column control moves more than 1pt or controls go missing; `tap.py` fails when a column tap does nothing. Both run on simulator captures, so these regressions no longer need a human to spot them.

## Round 5 (2026-10-24): split view back to inline, magnet drag

### Round 4's split-as-column was wrong

Device recording 23:14: in a split pane the mode flipped between column (385x571) and inline (469 wide, height 696, 679, 659, 674, 681; outer 469x669 throughout). Two causes:

- Safari's column in a split pane does not show in-document paint, so in column mode our controls were clipped inside the page.
- The column layer overflows the layout viewport (`.duo-scroller` is `100% + var(--duo-under)` wide). In a split pane Safari zooms the page out to the window width (469), which drops the column signature, so the next read is inline. Inline has no overflow, the zoom resets, and the signature returns. That is the loop.

Fix: `SAFARI_COLUMN.height` is back to [675, 681], so the split pane (outer 669) is always inline. Showing two columns (Safari's own and our strip) is unavoidable there, because Safari's split-pane column will not take our paint.

### Flip damper

`stable()` in geometry.ts wraps `detect()`. If the mode flips 3 times within 2s for the same outer window size, it pins inline for that size. A change in the window size (fold, rotate, pane resize) releases the pin. This guards any other window that hits the same zoom feedback.

### Magnet drag

In inline mode the strip can be dragged to the other edge. It now acts like a magnet: up to 64pt of travel (`MAGNET.release`) it rubber-bands, `18 * (1 - exp(-pull/64))`, so it moves at most 18pt. Past that it lets go and follows the finger. On release it switches side only if it let go and the finger is past the middle of the viewport, otherwise it springs back. The motion comes from a registered `@property --duo-drag` transitioned on `.duo`, so the existing glass top/height/scale transitions are untouched. `data-drag` is held (no transition), free (a short follow) or switch (no transition for the frame of the side swap).

### Tests

`duo-lab/harness/transitions.test.mjs`, run with `node --test duo-lab/harness/`. It covers the mode for each recorded signature (closed, open, split pane, zoomed pane, standalone, landscape, keyboard), a model of the zoom feedback loop (settles inline within 3 flips; the split pane never flips), pin release on a size change, the ordinary sequence closed → open → split → closed, and the magnet curve (hold, monotonic resistance, release and track, rubber band toward its own edge, mirrored on the left).

Simulator, open posture: a slow pull of 40pt holds the strip within a few points; continued to x 300 it let go and switched to the left; a 52pt drag from the left and release sprang back. Recordings: `mag.mp4`, `spring.mp4` (scratchpad, not committed).

## In-app Safari preview and settling after a fold (2026-10-26, issue #46)

### In-app Safari preview (SFSafariViewController)

Measured on the Duo Lab Preview simulator (iOS 27.1, closed portrait) with a small test host app that presents `SFSafariViewController` on a probe page (`viewport-fit=cover, shrink-to-fit=no`, as Duet sets). The UA is the same as a Safari tab's. Button rows measured from 3x screenshots.

| State | inner | outer | inset bottom | Column signature (84 wide, 68 to 102 tall) |
|---|---|---|---|---|
| Preview, full screen, default and over-full-screen presentations | 382x603 | 466x678 | 34 | yes (84, 75) |
| Preview, page sheet | 366x600 | 450x670 | 34 | yes (84, 70); preview since #66 (see below) |
| Preview, landscape (angle 90 and 270) | 678x391 | 678x466 | 34 | no (width 0): bar above the page |
| Safari tab, closed (after "Open in Safari", and a fresh tab) | 382x580 | 466x678 | 0 | yes (84, 98) |

- The preview's column holds its own buttons: close 173.3 to 222.7, reader 233.3 to 282.7, back 427.3 to 476.7, and a share/reload/Safari pill 487.3 to 644.7 (157.3 tall, 33.3 above the screen bottom). Free between reader and back: ~122pt with a bare island, ~31pt with the Live Activities worst case (`DUO.island`). Too small to keep clear of reliably, so the preview goes `inline`, on the left by default.
- This column (close, reader, share/reload/compass pill) is the "compact column state" from the 2026-10-24 report above that could not be reproduced in a tab: it was most likely the preview.
- The window reads 466x678 at load with no column, then resizes to 382x603 about 0.1s later; `screen.*` read 375x667 on one launch and 466x678 on the next, so it is not used.
- Detection (`isPreview`): not standalone, Safari, and either the older 375x667 window at 3x, or the closed screen's 466x678 window with the column signature, at most 77pt of chrome below the page and a bottom inset. A closed tab has 98pt (80 with the compact URL bar) and inset 0. Windowed Safari (453x661) and a compact split pane (385x594) also report inset 34 on device, so the inset alone is not enough; the window size and chrome height are.
- Page sheet: told apart since #66, see "Real Duo: preview sheet and bfcache restore". The open posture preview was not measured (the simulator could not be unfolded from here).
- "Open in Safari" on the simulator reloaded the page in a tab (load, then pageshow with persisted false), and the tab took the column. On device RegTail reports no reload; `watchSignals` re-reads on pageshow and visibilitychange for that case.

### Settling after a fold (RegTail ask #8)

Folding open to closed in a portrait Safari tab could leave the controls inline (rail centre 382 − 48.2) instead of in the column (466 − 48.2). The viewport lands first and `outerWidth` later, with no event when it does, and the old re-reads at 0, 300 and 600ms could miss it; flips while the column layer's first frames resize Safari could also pin inline. `watchSignals` now polls every 100ms after any geometry event until outer, inner and visual sizes hold for 500ms (a page more than 100pt narrower or wider than its window counts as mid-fold and keeps polling), capped at 2s, re-reading on each change and once at the end. `settling()` is true for that time and `stable()` does not count flips while it is. The simulator could not be folded from here, so the case is a synthetic timeline in `transitions.test.mjs` (URL bar expanded and compact, ending in column at 466x678).

## Preview hardening (#57, 2026-10-26)

/probe beacons every 100ms on Duo Lab Media (iOS 18.7 Safari, 3x). Fixtures: `packages/duet-ui/test/fixtures/states.json`.

| State | inner / outer | chrome | inset bottom | rule | mode |
| --- | --- | --- | --- | --- | --- |
| Tab, fresh load | 382x580 / 466x678 | 98 | 0 | not preview | column |
| Tab, hard scroll, URL bar collapsed | 382x598 / 466x678 | 80 (min) | 0 | not preview | column |
| Tab, momentum back to top | 382x580 | 98 | 0 | not preview | column |
| Tab, keyboard up | 382x598, visual 272 | 80 | 0 | not preview | column |
| Landscape, both turns | 594x368 / 678x466 | 98 | 0 | not preview | column left (90), right (270) |
| Preview, full screen | 382x603 / 466x678 | 75 | 34 | preview | inline |
| Preview, page sheet | 366x600 / 450x670 | 70 | 34 | preview since #66 | inline |

- The closest tab state is chrome 80 with inset 0; the preview is 75 with 34. The chrome band stays [73,77] and the rule now also wants inset >= 20. The verdict is sticky (README), so a scroll-time resize cannot flip a tab.
- Non-geometric signals (display-mode, referrer, history length, screen, ApplePaySession, serviceWorker, share, Notification) are identical in tab and preview, so geometry is all there is.
- Keyboard: focusing an input made Safari zoom out to scale 0.941 (inner 406x635). The old build read inline, then oscillated column/inline after dismissal and stuck inline. The zoom hold keeps column. Cause of the zoom: the document's scrollWidth is 442, the column nav (`.duet-pill`, absolute, x 393 to 442) overflows `innerWidth` in no-children mode. The overflow is what lets the layer paint in the column: `overflow-x: clip` on html, an `overflow-clip-margin` on the layer, and rtl all either keep scrollWidth 442 or stop the paint. Fix (#61): from a text field's focus (`html:has(:read-write:focus)`), before the zoom, the layer is clipped and hidden; measured scrollWidth 382 and scale 1 on focus, the layer back after dismissal.
- One 100ms sample read inline during rotation before column.
- Not measured: Reader, Hide Toolbar, find bar, private tab, Home Screen app, WKWebView, preview scrolled or landscape, a pinch zoom (two-finger simulator input did not zoom). These need the real-device /probe test.

## Real Duo: preview sheet and bfcache restore (#66, 2026-10-26)

Real Duo, iOS 18.7, Safari UA Version/27.0, angle 0, pixelRatio 3, link opened from Messages.

- Preview sheet: inner 366x600, outer 450x670, screen 466x678, chrome 70, column 84. `safe-area-inset-bottom` reads 0 on the first sample and 34 about 100ms later. Rule: Safari, not standalone, inset >= 20, the column signature, screen exactly 466x678, and a portrait window at least 4pt inside it on both sides. No tab is inside the screen: closed 466x678, open 951x669, split pane 469x669 (wider than the 466 screen Safari keeps reporting), and tabs read inset 0 in every state. iOS has no windowed Safari or Stage Manager; the 2026-10-25 "windowed Safari" trace (453x661 and 450x670) was most likely this sheet. `stable()` lets a tab verdict rise to preview in the first second of a window (`PREVIEW_RISE`) for the late inset.
- Slow slide after a back/forward cache restore (split left pane, back from /probe): the column layer pins `scrollX` to the column width with `scrollTo` on every scroll event. Under the site's `html { scroll-behavior: smooth }` each call started a smooth scroll and the next scroll event restarted it, so the controls crept from x 80 into the column over 2 to 3s. Fix: `behavior: "instant"`, a pin on `pageshow`, and transitions off again for 1.1s after a persisted `pageshow`, as at first mount.

## Preview placement in the gap (2026-10-26, user decision)

Native frames from the e2e runner (XCUITest on `com.apple.SafariViewService`, Duo Lab, iOS 27.1), screen points, buttons 48x48:

| Presentation | Page on screen | Column x | Close / reader | Back / share / reload / Safari | Free gap |
| --- | --- | --- | --- | --- | --- |
| Sheet, portrait | 366x600 at (8, 78) | 386 | 174 / 234 | 428 / 488 / 542 / 596 | y 282 to 428, 146pt |
| Full screen and default, portrait | 382x603 at (0, 75) | 394 | 174 / 234 | 428 / 488 / 542 / 596 | y 282 to 428, 146pt |
| Sheet, angle 90 (662x458 outer, 578x388 inner) | column left | 32 | 82 / 142 | 216 / 276 / 330 / 384 | 26pt |
| Sheet, angle 270 | column right | 598 | 32 / 92 | 168 / ... | 28pt |

- The real Duo (iOS 18.7, Messages, screenshot) matches portrait: reader bottom ~281, back top ~429.
- A probe page confirmed that in-document absolute content paints into the preview's column under its buttons (fixed content is clipped to the viewport), as in a tab, so the column layer works there.
- Portrait: `column`, band = the gap less `DUO.gap` each side, converted to page coordinates by `678 - innerHeight` (the page reaches the screen bottom); centre `outerWidth - 48.2`, the native buttons' centre. 124pt holds "…" and the minimized selected tab (49 + 11 + 49).
- Turned: no usable gap, so `inline` on the side away from the preview's column; the preview rule now accepts the sheet in either orientation.
- Unknown: the preview's buttons with Live Activities (the old note's ~31pt worst case assumed the island pushes them like Safari's rows; not measured).

