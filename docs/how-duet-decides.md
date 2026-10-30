# How Duet decides

[Back to the README](../README.md)

How Duet tells a Duo from anything else, picks a layout, and what that cannot guarantee.

## Is this an iPhone Duo?

`useDuet().duo` (and `isDuo(signals)`) is a heuristic. It is true when both hold:

1. The screen size (`screen.width` x `screen.height`) or the window size (`outerWidth` x `outerHeight`) matches, within 1px and in either orientation, one of the sizes measured on the Duo: 466x678 (closed screen; Safari keeps reporting it as `screen.*` after unfolding), 669x951 (open screen) or 469x669 (a Safari split-view pane).
2. The user agent says iOS: it contains `iPhone` or `iPod`, or it contains `Macintosh` and `navigator.maxTouchPoints` is greater than 1 (Safari's "Request Desktop Website"). Signals without a user agent, such as ones you build yourself for `isDuo()`, skip this check.

Possible false positives: an iPad (which also sends a Mac user agent with touch) or another iOS device whose screen or window happens to match one of these sizes. Possible false negatives: anything that changes the reported sizes, such as a different display zoom setting, a future iOS release, or a window size that was not measured. Use it to switch to a Duo layout, not as proof of the device.

## Which mode

Duet re-reads the signals on resize, orientation change (including `screen.orientation` change: turning from one landscape to the other keeps the window size), visual viewport resize, `pageshow` and `visibilitychange` (so a page handed from the in-app preview to a Safari tab re-reads). The window size and insets settle late (after a fold `outerWidth` can land up to ~2s after the viewport, with no event), so after each event Duet polls every 100ms until the sizes hold for 500ms, re-reading on every change, for at most 2s. It picks the first mode that matches:

| Order | Mode | Conditions (all must hold) | Controls |
| --- | --- | --- | --- |
| 1 | `strip` | Running as a Home Screen app (`navigator.standalone` or `display-mode: standalone`) on a Duo (`duo` true), and the left or right safe-area inset is at least 76px (the Duo's strip is 84; an iPhone's landscape sensor inset is 59, an Android cutout 62). The right side wins if both are. Also the in-app Safari preview turned sideways in its default or full style (below): closed screen, 678x466 window, an 84px safe-area inset on the turned side. | In the strip iOS gives the app, beside the page (in the preview, in the inset below its top bar) |
| 2 | `column` | Not a Home Screen app; not inside an iframe; not the in-app Safari preview turned sideways (below); the browser is Safari (below); `outerWidth - innerWidth` is 80 to 88px; `outerHeight - innerHeight` is 68 to 102px (not checked in the in-app preview, whose top bar compacts on scroll); portrait (`innerHeight > innerWidth`), or landscape in a window the size of the closed screen (678x466 within 1px) with `screen.orientation.angle` 90 or 270; the page is not zoomed (`visualViewport.scale` 1); the oscillation guard has not paused column mode; and either the window is a split-view pane (`outerWidth` x `outerHeight` 469x669 within 1px, iOS user agent) or `duo` is true | Painted into the part of Safari's column (or the in-app preview's) its own buttons leave empty, so the page keeps its full width |
| 3 | `inline` | Everything else: unfolded at full width, landscape of unknown turn, other browsers, in-app web views, the in-app Safari preview unfolded, other phones, desktops | An 84px strip inside the page, on the side the user picks |

"Safari" means the user agent has `Version/x Safari/` and none of the tokens of other iOS browsers and apps (`CriOS`, `FxiOS`, `EdgiOS`, `OPiOS`, `GSA/`, `Ddg/`); an in-app web view drops the `Safari/` token. `useDuet().browser` reports the result: `"safari"`, `"chrome"`, `"firefox"`, `"edge"`, `"webview"` or `"other"`. Other browsers draw their own chrome where Safari has its column, so they always get `inline`.

There is no fold signal. The mode follows the geometry: folding or unfolding changes the window size, and the mode follows on the next read.

How a new reading is committed:

- **Keyboard.** The keyboard does not change the mode. `useDuet().keyboard` is true while the visual viewport is shorter than the page, and `<Duet>` sets `data-keyboard`; in `column` and `inline` mode the controls hide until it closes (it covers the lower column, and the inline rail would slide off). It counts only while a text field has focus, and until the viewport grows back once focus leaves.
- **Zoom.** While the page is zoomed (`visualViewport.scale` not 1, for example Safari zooming out when an input takes focus) the window signature is unreadable, so Duet keeps the last context.
- **Drift.** While the window is still settling, a mode change at the same window size, page width and turn is held until the sizes stop moving; a change of window size, page width or turn commits at once.
- **Loops.** A mode that flips twice in 2s at a stable window is pinned for 3s, doubling on each repeat up to 60s.
- `useDuet().confidence` says how the context was reached: `"sure"` (settled signals), `"settling"` (the window is still moving) `"held"` (the last context, kept through zoom or drift) or `"moving"` (a turn or fold caught halfway, controls hidden).

## Column mode: how it works

Column mode infers from the window geometry that Safari's column is there; it never sees Safari's buttons. The 80 to 88px width difference is Safari's column (84px measured), the height difference is Safari's chrome below the page.

- `position: fixed` content stops at the page viewport (and a fixed box covering the middle of the viewport edge has its colour painted over the column, see [Modals and sheets in column mode](#modals-and-sheets-in-column-mode)), but WebKit paints in-document content that overflows the layout viewport into Safari's column. Duet renders the controls in an absolute layer at the top of the document, widens the document by the column's width, keeps the document itself from scrolling (the page scrolls in the inner scroller) and sets `touch-action: pan-y` on `<html>` so the page does not pan sideways. This is observed WebKit behaviour, not a supported API.
- Without `children` the document itself scrolls, and the layer follows it on a CSS scroll timeline (`animation-timeline: scroll(root)`). Safari runs the timeline with the scroll, so the controls hold through momentum and through smooth programmatic scrolls (`scrollIntoView({ behavior: "smooth" })`, `scrollTo({ behavior: "smooth" })`): you need no scroll listener and no `behavior: "auto"` workaround. Measured on the simulator: within 1px through flings and at rest, and one frame of up to 7pt at the end of a smooth scroll (a transform set on scroll ran up to 300pt off there). The keyframe ends at `scrollHeight - innerHeight`, Safari's own timeline range, which follows its URL bar as it collapses. Without scroll-timeline support, or when a page reset like `* { animation: none !important }` removes it, Duet falls back to a transform set on scroll, which lags in momentum. Children mode stays the steadier choice.
- The widened document can pan sideways when a swipe runs off the end of a horizontal scroller (a chip row), since `touch-action` stops at that scroller. Duet pins `scrollX` (0, or the column width when the document spans a left column) on every scroll and sets `overscroll-behavior-x: contain` on all elements at zero specificity (`:where()`), so your own value wins.
- Touches in the column reach the page but are not hit-tested to Duet's buttons, and Safari usually keeps the touch end. Duet listens for `pointerdown`, finds the button under the touch's coordinates and clicks it, so a column button fires on touch down.
- Placement comes from constants measured on the iPhone Duo simulator (iOS 27.1) and checked on a device: Safari's back and reader rows at the top of the column, its +/tabs pill at the bottom. A Safari update that moves its buttons or changes this painting behaviour needs new measurements.

## Modals and sheets in column mode

A modal or sheet on the web usually sits on a full-screen scrim: `position: fixed; inset: 0`. In Safari's column on the closed Duo that used to hide Duet's whole column layer, the close button included (#79).

- **What you see:** nothing to handle. While the overlay is open, the controls stay in the column and keep working. Safari's own buttons there are unaffected either way.
- **Cause:** Safari 26 hit-tests the middle of each viewport edge, 4px in, for a fixed or sticky box (WebKit's `LocalFrameView::fixedContainerEdges`). When one covers that point, Safari paints the box's colour, or plain chrome when the box has a `backdrop-filter`, over everything beyond that edge, Safari's column included. Duet's column layer is in-document content, so it disappears under that fill. Measured on the simulator: a scrim 3px short of the edge still hides the column, 6px short does not, and a scrim of 90% width or 40% height does not.
- **What Duet does:** on a Duo in Safari it renders a small fixed guard (`.duet-guard`, 16x64px, transparent, `pointer-events: none`, top `z-index`) straddling that point on each viewport edge, in every mode, so it is there through folds and turns too. Safari's hit test lands on the guard, which is too small to count as a container, so it finds none and keeps painting the column normally. The guard takes no taps and paints nothing.
- **What you must do:** nothing for visibility. For a native feel, pass `close` to `<Duet>` while the sheet is open, so the controls hold only its close button, and hide the sheet's own X while Duet shows its close (`<html data-duet-close>`, set in every mode, so the open screen shows one X too):

  ```tsx
  <Duet menu={menu} close={open ? { label: "Close", onPress: () => setOpen(false) } : undefined}>
  ```

  ```css
  html[data-duet-close] .sheet-x { display: none; }
  ```

  The old workaround, making the scrim `position: absolute` in column mode, still works and is no longer needed.
- **Blur:** keep `backdrop-filter` off the scrim box itself and put it on a `::before`, so Safari's bar takes the dimmed colour on the open screen instead of a solid band (see [Sheet scrim stops at Safari's bar](edge-cases.md#sheet-scrim-stops-at-safaris-bar)):

  ```css
  .sheet-scrim { position: fixed; inset: 0; background: rgb(0 0 0 / 0.38); }
  .sheet-scrim::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; backdrop-filter: blur(8px); }
  ```
- **Not covered:** `<dialog>.showModal()` puts its `::backdrop` in the browser's top layer, above any `z-index`, so it still hides the column (checked on the simulator), and the page outside a modal dialog is inert anyway, so Duet's buttons could not take taps. Use a fixed `<div>` scrim (or `dialog.show()` with your own scrim) when you want the column controls. A page box of your own with `z-index: 2147483647` over the middle of the column edge also beats the guard.

Try it on the [site](https://getduet.dev/sheet).

## Split view

A Safari split-view pane (469x669 window, 385x571 page) has Safari's column on the pane's outer edge, but no web signal says whether the pane is on the left or the right. In column mode Duet widens the document by a column on each side and draws the controls in both; each pane only shows its own column, and a tap there tells Duet which side it was. The document is kept scrolled across the left column, so a pane shows document x 84 to 469. When a split pane falls back to `inline`, its side is remembered separately from the full-window side, so the user can move the controls next to Safari's column once. `useDuet().split` is true in a split pane.

## Side

`useDuet().side` is the edge the controls are on. It is only detected in `strip` mode (from which safe-area inset is large). In `column` mode it is Safari's column on the closed Duo: `"right"` in portrait; turned sideways, the side the camera is on, `"left"` at angle 90 (turned anticlockwise) and `"right"` at 270. A left column widens the document on the left and keeps it scrolled across, as in split view. In a split pane it is nominal, since both edges are drawn. In `inline` mode it is the user's choice: drag the controls across the middle of the page, or use "Move controls" in "…". The choice is stored in `localStorage` per site (`duet-side`, or `duet-side-split` in split view). Without one, it is `"right"`. In the in-app preview turned sideways (`strip`) it is the side of the safe-area inset: `"left"` at angle 90, `"right"` at 270.

## In-app preview

Links opened from social and mail apps can open in the in-app Safari preview (`SFSafariViewController`). On the closed Duo the preview has a column like a Safari tab's, holding its own buttons: close and reader/menu at the top, back and a share/reload/Safari pill below. In portrait Duet uses `column` and puts its controls into the free gap between the reader/menu button and the back button (146pt, screen y 282 to 428, the same in the sheet and full screen on the simulator and a real Duo), so the page keeps its full width. Live Activities push close and reader/menu down (one about 45pt on a real Duo) while back stays put, and a page can't tell, so Duet assumes the worst case (`DUO.island`, two activities, as in a Safari tab): the gap is then about 54pt, room for one button, and none of Duet's buttons can ever sit under the preview's. That button is "…", centred in the gap, its list holding the page's actions, then the places under "Menu". Turned sideways, the preview's layout depends on its style. The sheet keeps a column on the side the Duo is turned to, with a gap of about 26pt, too small for a button: there Duet hides its controls (`useDuet().hidden` is `"preview"`, the controls get `visibility: hidden` and no inset) instead of drawing an inline strip across the page, so the page keeps its full width and the preview's own close, back, share and "Open in Safari" stay usable. The default and full styles move every native button into a top bar (window y 24 to 68) and give the page an 84px safe-area inset on the turned side (left at 90, right at 270) that nothing draws in: Duet uses `strip` there, its controls in that inset from below the top bar to above the home indicator, and the page keeps its width. Turning back to portrait, or opening the page in Safari, brings the column back. A strip across page content was flagged in review and is never used. Duet sets `useDuet().preview` in both. Duet takes a Safari window that is not standalone to be the preview when it is either:

- the closed screen's 466x678 window with the column signature, 44 to 77px of chrome (the preview has 75, down to 46 as its top bar compacts on scroll in the default and full styles; a Safari tab 98, or 80 with the compact URL bar) and a bottom safe-area inset (34 in the preview, 0 in a tab), or
- a page sheet: a window inside the closed 466x678 screen, in either orientation (450x670 on a real Duo, 662x458 turned) with the column signature and a bottom safe-area inset, or
- exactly 375x667 at `devicePixelRatio` 3, the size earlier builds gave the preview.

No Safari tab on the Duo is smaller than the screen (a split pane is 469 wide, the screen 466), and iOS has no windowed Safari or Stage Manager, so a window inside the screen is the sheet.

The verdict is sticky: a page that loaded as a tab stays a tab while its page height and insets move (scrolling collapses the URL bar to 80px of chrome), and is only re-decided when the window size, page width, turn, standalone or framing changes, or on `pageshow` or when the page becomes visible again. In a window's first second the verdict may still rise to preview, since the sheet's inset reads 0 on the first sample and 34 about 100ms later. A preview that stops matching becomes a tab at once.

While the Duo turns or folds, the window passes through sizes no landed window has (inner and outer orientations disagree, or the chrome around the page is not Safari's). Duet keeps the last placement and hides the controls (`hidden` is `"moving"`) until the window lands and holds there for 150ms, so nothing flashes at the wrong edge mid-turn, not even the closed portrait window an unfold from landscape passes through for a frame or two.

Unfolded, the preview is a sheet centred on the open screen (653x661 wide, 653x869 tall) with its bars above and below the page and no column: Duet reads it as the preview (`preview` true) and goes `inline` on the user's side, as in full width Safari. Limits: When "Open in Safari" hands the page to a tab, the `pageshow`/`visibilitychange` re-read switches to `column`. The [/probe page](https://getduet.dev/probe) logs every signal the rule reads, every 100ms. Measurements are in [docs/research-notes.md](research-notes.md).

## Oscillation guard

Column mode can feed back into the signals (for example if Safari zooms the page out to fit the wider document, the column signature disappears, `inline` removes the overflow, and the signature returns). If the mode changes 3 times within 2 seconds while the outer window size stays the same, Duet pauses column mode for 3 seconds, then tries again. If the loop resumes as soon as the pause lifts, the next pause doubles. A change of window size resets the guard, and changes while the window is still settling after an event (the 2s polling above, as during a fold) are not counted: they are the transition, not a loop.

## Viewport meta

Duet appends `shrink-to-fit=no` to every `<meta name="viewport">` when `duet-ui` is imported, and `viewport-fit=cover` when `<Duet>` mounts, and keeps both on metas the framework adds or rewrites later. If there is no viewport meta it adds `width=device-width,initial-scale=1` first. It only appends a key that is absent: an existing `viewport-fit` or `shrink-to-fit` value is left as it is. Safe-area insets only reach the page with `viewport-fit=cover`, so with `viewport-fit=contain` `strip` mode cannot be detected. Without `shrink-to-fit=no`, Safari zooms a split pane out to fit the widened document.

## Claimable space

Each mode has a band the controls may use, and Duet keeps every control inside it, so you never position anything yourself:

- **Above:** the status bar and Dynamic Island, and in Safari its own back and reader buttons at the top of the column. Live Activities grow the island down the strip and push Safari's buttons with it, and a page can't tell, so the band always assumes the worst case measured on device (two activities). That space stays empty even when none are running. A split-view pane on the right sits under the same status column, so it gets the same band as a closed tab, while the left pane uses the full column.
- **Below:** Safari's +/tabs pill, or the bottom edge.
- **Closed landscape:** Safari moves its back and reader rows and its pill on each side (left column: back slot top 81.5pt, pill top 327pt; right column: 23.5pt and 279pt), and Duet takes the gap between. Measured with a bare island; how Live Activities grow it sideways is not yet known.
- **What does not fit folds into "…"**: actions from the last, then `primary`. "…" shows whenever something is in it. Items marked `folded` or `destructive` always sit in "…", after the ones that did not fit.
- **Safari's column buttons are an exclusion zone for menus too.** Native chrome always paints over the page, so z-index can't help. A menu that reaches into the column keeps its top at or below `columnTop` (the reader button's worst-case bottom plus 11pt) and its bottom above Safari's pill, opening flush with the column like Safari's own menus. A menu too tall for that band opens wholly over the page, beside the column, where it may rise to the top of the page. One too tall even there caps its height and scrolls inside. Duet sets `--duet-safe-top-column` on `<html>` for your own popovers (0 outside `column` mode).

## Limitations

- **Duo detection is a heuristic** from screen and window sizes plus the user agent (see above). It can misfire on devices with matching sizes and miss a Duo whose reported sizes differ.
- **Column mode depends on unsupported WebKit behaviour** (painting in-document content outside the layout viewport) and on measured positions of Safari's buttons. A Safari or iOS update can break or shift it. Duet falls back to `inline` whenever any column check fails, but it cannot detect a Safari layout that still passes the checks while its buttons moved.
- **Column taps are routed by coordinates** on `pointerdown`: they fire on touch down and show no native press state.
- **Live Activities and the Dynamic Island are invisible to the page**, so the top band always reserves the worst case, which leaves empty space when no activity runs.
- **Split-view panes can't tell their side**: column mode draws both edges, inline mode relies on the user's choice.
- **Server rendering** starts from a fixed Duo snapshot (see [Server rendering](server-rendering.md#server-rendering-and-hydration)).
- Other iOS browsers, in-app web views, iframes, landscape other than the closed Safari tab and the open screen at full width all get `inline`.
- Measured on the iPhone Duo simulator (iOS 27.1) and checked on a device in October 2026.
