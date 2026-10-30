# Edge cases

[Back to the README](../README.md)

Every iOS and Safari quirk Duet handles, what you would see without the handling, and what is left for you to do. Most need nothing from you. "Without children" means a page that renders `<Duet>` without `children`, so the document itself scrolls.

- [Split view pane, or the closed Duo turned left](#split-view-pane-or-the-closed-duo-turned-left)
- [Right split pane holds two buttons](#right-split-pane-holds-two-buttons)
- [Rubber band at the top or bottom of the page](#rubber-band-at-the-top-or-bottom-of-the-page)
- [Toolbar growing back at the end of the page](#toolbar-growing-back-at-the-end-of-the-page)
- [Full-screen `position: fixed` overlay or modal backdrop](#full-screen-position-fixed-overlay-or-modal-backdrop)
- [Page dialog open through a turn or fold](#page-dialog-open-through-a-turn-or-fold)
- [Sheet scrim stops at Safari's bar](#sheet-scrim-stops-at-safaris-bar)
- [Sideways swipe pans the page into the column](#sideways-swipe-pans-the-page-into-the-column)
- [Back/forward cache restore](#backforward-cache-restore)
- [In-app preview sheet](#in-app-preview-sheet)
- [In-app preview filling the open screen](#in-app-preview-filling-the-open-screen)
- [Turning or folding mid-transition](#turning-or-folding-mid-transition)
- [Unfolding the in-app preview](#unfolding-the-in-app-preview)
- [Text field focus and the on-screen keyboard](#text-field-focus-and-the-on-screen-keyboard)
- [Inline controls with the keyboard up](#inline-controls-with-the-keyboard-up)
- [A short visual viewport after a turn, read as the keyboard](#a-short-visual-viewport-after-a-turn-read-as-the-keyboard)
- [Column controls under Safari's bar after a turn](#column-controls-under-safaris-bar-after-a-turn)
- [Inline controls as the keyboard goes down](#inline-controls-as-the-keyboard-goes-down)
- [Pinch zoom](#pinch-zoom)
- [Safari's URL bar collapses](#safaris-url-bar-collapses)
- [Live Activities and the top band](#live-activities-and-the-top-band)
- [Safari's forward button plus Live Activities](#safaris-forward-button-plus-live-activities)
- [In-app preview top bar compacting on scroll](#in-app-preview-top-bar-compacting-on-scroll)
- [In-app preview after visiting another app](#in-app-preview-after-visiting-another-app)
- [In-app preview buttons and Live Activities](#in-app-preview-buttons-and-live-activities)
- [Shared with You bar](#shared-with-you-bar)
- [In-app preview with forward history](#in-app-preview-with-forward-history)
- [Controls flash over the in-app preview while it loads](#controls-flash-over-the-in-app-preview-while-it-loads)
- [Controls flash over the clock unfolding the in-app preview](#controls-flash-over-the-clock-unfolding-the-in-app-preview)
- [Controls a scroll too high for a frame after a turn](#controls-a-scroll-too-high-for-a-frame-after-a-turn)
- [Menus and popovers under Safari's buttons](#menus-and-popovers-under-safaris-buttons)
- [Plain layout before mount](#plain-layout-before-mount)
- [Page modal turns off pointer events](#page-modal-turns-off-pointer-events)
- [Column buttons fire on touch down](#column-buttons-fire-on-touch-down)
- [Animations removed by a page reset](#animations-removed-by-a-page-reset)
- [Viewport meta and `viewport-fit=cover`](#viewport-meta-and-viewport-fitcover)
- [Scrolling or typing on a real Duo drops the controls off the column](#scrolling-or-typing-on-a-real-duo-drops-the-controls-off-the-column)
- [Mode flips back and forth](#mode-flips-back-and-forth)
- [Mode detection limits](#mode-detection-limits)
- [Sheet X shown twice](#sheet-x-shown-twice)
- [No close for a sheet in the in-app preview](#no-close-for-a-sheet-in-the-in-app-preview)
- [No close after turning the in-app preview upright](#no-close-after-turning-the-in-app-preview-upright)
- [Overlay stacked level with the controls](#overlay-stacked-level-with-the-controls)
- [Folded primary runs at once](#folded-primary-runs-at-once)
- [Burger without children](#burger-without-children)
- [One button of room](#one-button-of-room)
- [An app's own web view (a link opened in X)](#an-apps-own-web-view-a-link-opened-in-x)
- [Square backing behind the open menu](#square-backing-behind-the-open-menu)
- [Call to action hidden in the closed column](#call-to-action-hidden-in-the-closed-column)
- [Primary in its own capsule](#primary-in-its-own-capsule)

## Split view pane, or the closed Duo turned left

- **You see:** in column mode without children, the left 84px of the page is clipped, the controls draw over the content and an empty band runs down the right.
- **Cause:** Safari's column is on the pane's left edge (or on the left when the closed Duo is turned to 90). Duet keeps the document scrolled one column across so the left column can paint, but the page content still starts at x 0, under the column.
- **Duet does:** places the page itself: `margin-left` of the column width and the matching negative `margin-right` on `<html>`, marked `<html data-duet-reserve>`, with both insets 0. Centred content stays centred, nothing is clipped.
- **You do:** nothing. Don't set `margin` on `<html>` or reset `scrollX`, Duet owns both. `<Duet reserve={false}>` opts out: the page runs under the column and `--duet-inset-left` / `--duet-inset-right` hold its width for `column()`, `bleed()` or your own padding.
- **Status:** [#77](https://github.com/JayFarei/duet/issues/77), [PR #78](https://github.com/JayFarei/duet/pull/78), 0.4.0-rc.2. See [Split view](how-duet-decides.md#split-view).

## Rubber band at the top or bottom of the page

- **You see:** in column mode without children, the controls leave their place as a group while the page bounces at either end (sliding up to 160pt over Safari's own column buttons, or out of the column), then come back once it settles.
- **Cause:** the controls follow the document on a CSS scroll timeline, which is clamped to the scroll range. The iOS rubber band pushes `scrollY` past that range, and the in-document layer moves with the bounce.
- **Duet does:** while the layer follows the document, `<html>` gets `overscroll-behavior-y: none`, so the document does not rubber-band, like a page with children. Only the Duo column is affected: other modes and other devices keep the bounce.
- **You do:** nothing. The rule has zero specificity (`:where()`), so a page's own `overscroll-behavior` still wins, and with it the controls ride the bounce again.
- **Status:** [#76](https://github.com/JayFarei/duet/issues/76), [PR #80](https://github.com/JayFarei/duet/pull/80), 0.4.0-rc.2.

## Toolbar growing back at the end of the page

- **You see:** in column mode without children, after a flick to the end of the page the controls sit up to 18pt too high for about half a second, then snap back. Smaller 1 to 2pt jitters show while momentum scrolling.
- **Cause:** the controls ride a CSS scroll timeline whose keyframe ends at the scroll range, `scrollHeight - innerHeight`. At the page end Safari's toolbar grows back after the scroll has stopped, sometimes seconds later, and `innerHeight` steps down (598, 586, 581, 580). Only `visualViewport` fires `resize` meanwhile, with no `scroll` and no window `resize` until it settles, so a range measured in JavaScript goes stale while the timeline's own range follows the live viewport.
- **Duet does:** writes the range as `max(0px, <scrollHeight>px - 100dvh)`. `100dvh` follows `innerHeight` frame by frame, so CSS keeps the range live and JavaScript only reports `scrollHeight`. Measured on the simulator: a computed offset within 0.3pt of `scrollY` through the regrow (was 18pt), and 0.0pt during smooth `scrollIntoView` jumps.
- **You do:** nothing. A fast flick toward the top can still paint a single frame (16ms) a few points off, from Safari's compositor sampling the scroll and the animation apart. If a page needs the controls perfectly still, pass `children` to `<Duet>`: the document then never scrolls, and the controls measure 0.0pt.
- **Status:** [#100](https://github.com/JayFarei/duet/issues/100).

## Full-screen `position: fixed` overlay or modal backdrop

- **You see:** without the handling, in column mode, while a modal or sheet scrim (`position: fixed; inset: 0`) is open, every Duet control in Safari's column disappears, the close button included, so the user has no way to close the sheet from the column.
- **Cause:** Safari 26 hit-tests a point 4px in from the middle of each viewport edge for a fixed or sticky box and, when one covers it, paints that box's colour over the inset beyond that edge, Safari's column included, instead of the page's in-document content.
- **Duet does:** on a Duo in Safari renders `.duet-guard`, a small invisible fixed box (`pointer-events: none`, top `z-index`) on each viewport edge, 240px tall (since [#142](#no-close-for-a-sheet-in-the-in-app-preview)), 16px wide on the left and 300px wide reaching inward on the right (since [#147](#no-close-after-turning-the-in-app-preview-upright)), so that hit test lands on it and the column keeps showing the controls. Your scrim stays `position: fixed`.
- **You do:** nothing for a fixed `<div>` scrim. `<dialog>.showModal()` is not covered: its `::backdrop` sits in the top layer, above any `z-index`, so use a fixed `<div>` scrim instead. For one X, in the column, pass `close` to `<Duet>` while the sheet is open and hide the sheet's own X while Duet shows its close (`html[data-duet-close] .sheet-x { display: none; }`, see [Sheet X shown twice](#sheet-x-shown-twice)). See [Modals and sheets in column mode](how-duet-decides.md#modals-and-sheets-in-column-mode).
- **Status:** [#79](https://github.com/JayFarei/duet/issues/79), [PR #83](https://github.com/JayFarei/duet/pull/83), 0.4.0-rc.2.

## Page dialog open through a turn or fold

- **You see:** without handling, with a full-screen page dialog open in a Safari tab on the closed Duo, turning the phone on its side and back upright leaves Safari's column without Duet's close button, and tapping where it was does nothing.
- **Cause:** through the turn the page is in transit, not in column mode. A guard rendered only in column mode unmounts for those frames, Safari's edge hit test finds the scrim and fills the column with it, and that fill stays once the column and the guard are back.
- **Duet does:** keeps `.duet-guard` mounted whenever the page is in Safari on a Duo, in every mode, so no frame of a turn, fold or unfold leaves the edge sample point on the scrim. The guard is invisible and takes no taps, so it changes nothing outside the column.
- **You do:** nothing.
- **Status:** [#119](https://github.com/JayFarei/duet/issues/119).

## Sheet scrim stops at Safari's bar

- **You see:** on the open Duo, in a tall Safari window (no tab bar), a sheet's blurred scrim dims the page but stops at Safari's top bar, which stays the undimmed page colour, a solid band over the dimmed page.
- **Cause:** Safari 26 tints its bar with the colour of the fixed box at the top edge's sample point, but skips that tint for a box with a `backdrop-filter` and falls back to the page colour. Measured on the inner screen: blurred scrim, bar rgb(242,242,247) over a dimmed page of rgb(150,150,153); the same scrim without blur, bar rgb(149,149,153). Wide, with the tab bar, Safari never tints its bar, sheet or not. The closed screen's column is not affected.
- **Duet does:** nothing it can; the scrim is the page's. The e2e `bar` check (journey mod03) compares the bar with the page under the scrim.
- **You do:** keep the scrim box to its colour and move the blur to a `::before` (absolute, `inset: 0`, `z-index: -1`, `pointer-events: none`). The blur looks the same and the bar dims with the page. See [Modals and sheets in column mode](how-duet-decides.md#modals-and-sheets-in-column-mode).
- **Status:** [#136](https://github.com/JayFarei/duet/issues/136).

## Sideways swipe pans the page into the column

- **You see:** a sideways swipe moves the whole page, controls included, into Safari's column, typically when a swipe runs off the end of a carousel or code block.
- **Cause:** the controls widen the document by the column's width, so the document can scroll sideways, and `touch-action` on `<html>` stops at a horizontal scroller, whose overscroll chains to the document.
- **Duet does:** sets `touch-action: pan-y` on `<html>` (and on the inner scroller with children), `overscroll-behavior-x: contain` on every element at zero specificity, and pins `scrollX` (0, or the column width for a left column) on every scroll, instantly, so a page's `scroll-behavior: smooth` can't turn it into a slow creep. Leaving the column resets `scrollX` to 0. Carousels and code blocks still scroll sideways.
- **You do:** nothing. Your own `overscroll-behavior-x` wins over Duet's.
- **Status:** 0.2.5 ([PR #26](https://github.com/JayFarei/duet/pull/26)). See [Column mode](how-duet-decides.md#column-mode-how-it-works).

## Back/forward cache restore

- **You see:** after going back to a page (`pageshow` with `persisted`), the controls start in the page and slide into the column over 2 to 3s, seen in a split left pane and on the closed Duo turned left.
- **Cause:** a back/forward cache restore keeps the page's old state but not the old window, and the `scrollX` pin was a plain `scrollTo`, which a page's `html { scroll-behavior: smooth }` animated and each scroll event restarted.
- **Duet does:** re-reads the signals on `pageshow`, re-pins `scrollX` with `behavior: "instant"`, and turns transitions off for 1.1s after a restore, as at first mount, so the controls land in place. Normal mode changes keep their ~250ms spring.
- **You do:** nothing.
- **Status:** [#66](https://github.com/JayFarei/duet/issues/66), [PR #67](https://github.com/JayFarei/duet/pull/67).

## In-app preview sheet

- **You see:** a link opened from a social or mail app in the in-app Safari preview's page sheet got Safari-tab placement on a real Duo.
- **Cause:** the sheet is a window inside the closed screen (450x670 on a real Duo), and its bottom safe-area inset reads 0 on the first sample and 34 about 100ms later, so the first reading looks like a tab.
- **Duet does:** recognises a window inside the closed screen with the column signature and a bottom inset as the preview, and lets a tab verdict rise to preview during a window's first second. Turned sideways in the sheet, where the free gap is about 26pt, it hides the controls (`useDuet().hidden` is `"preview"`) so the preview's own buttons stay usable.
- **You do:** nothing. Check `useDuet().preview` and `hidden` if your page lays out differently there.
- **Status:** [#66](https://github.com/JayFarei/duet/issues/66), [PR #67](https://github.com/JayFarei/duet/pull/67), [#69](https://github.com/JayFarei/duet/issues/69). See [In-app preview](how-duet-decides.md#in-app-preview).

## In-app preview filling the open screen

- **You see:** a link opened in the in-app preview's default or full screen style on the unfolded Duo put the controls over the clock and Dynamic Island (wide) or on the preview's Page Menu (tall, turned right), and `useDuet().preview` read false.
- **Cause:** these styles fill the open screen (951x669 or 669x951), unlike the sheet, so neither the closed nor the sheet signature matched. Wide, every native button sits in a 75pt top bar and the status column heads an 84pt inset on the right; tall turned right, the top bar floats over the page's first 54pt.
- **Duet does:** recognises both windows by their chrome and inset (a tab has 126pt of bars and inset 34). Wide, it takes the right inset as a strip below the status column, with room for two Live Activities. Tall, it stays inline right and starts the controls below the top bar and the island.
- **You do:** nothing.
- **Status:** [#108](https://github.com/JayFarei/duet/issues/108). Live Activities on the open screen are assumed to grow the island as on the closed one.

## Turning or folding mid-transition

- **You see:** without the handling, the controls flash at the wrong edge during a turn, fold, unfold or split move, the page insets jump (up to 296px on a turn, -485px on an unfold), or Safari zooms the page to fit (scale 1.14).
- **Cause:** there is no fold signal, and mid-transition the window passes through sizes no landed window has (inner and outer orientations disagree). The window size can land up to ~2s after the viewport, with no event. The column layer still carries the old posture's positions, which widen the document past the new window.
- **Duet does:** keeps the last placement and hides the controls (`hidden` and `confidence` are `"moving"`) until the window lands and holds for 150ms (`LAND_HOLD`). The insets keep their last values, and the column layer is clipped out of the document width, so it adds no width until the landing. After each event it polls every 100ms until the sizes hold for 500ms, for at most 2s.
- **You do:** nothing. If your own code reacts to `useDuet()`, ignore readings with `confidence: "moving"`.
- **Status:** [#68](https://github.com/JayFarei/duet/issues/68), [#69](https://github.com/JayFarei/duet/issues/69), [PR #70](https://github.com/JayFarei/duet/pull/70), 0.4.0-rc.1. See [Which mode](how-duet-decides.md#which-mode).

## Unfolding the in-app preview

- **You see:** without the handling, unfolding from the closed preview turned sideways leaves the closed screen's controls (the strip, or Safari's column) on the open screen for 50 to 130ms before they land inline.
- **Cause:** WebKit holds `resize` back while the window animates, yet lays the page out every frame: the page took four sizes over ~220ms with no event. One of them, 585x876 in the 669x951 window, is the closed page's 84pt column handed the open window, which reads as Safari's column.
- **Duet does:** also watches a viewport-sized box with a `ResizeObserver`, which reports every layout, so the window starts settling (controls hidden, `confidence: "moving"`) on the first new size. A column-wide page in the full open window is in transit, never the column: Safari has no column there.
- **You do:** nothing.
- **Status:** [#115](https://github.com/JayFarei/duet/issues/115). See [Turning or folding mid-transition](#turning-or-folding-mid-transition).

## Text field focus and the on-screen keyboard

- **You see:** without the handling, focusing an input in column mode makes Safari zoom out (to about 0.94), and the keyboard covers the lower column and the controls in it.
- **Cause:** the column layer widens the document, and Safari zooms out to that width when a text field takes focus. The keyboard leaves Safari's column in place and only shrinks the visual viewport.
- **Duet does:** from the moment a field (`:read-write:focus`, so inputs, textareas and `contenteditable`) takes focus, clips the column layer out of the document width and hides it, before the zoom and the keyboard. The keyboard never changes the mode. `useDuet().keyboard` is true while it is up, and `<Duet>` sets `data-keyboard`. In column mode the controls come back when focus leaves.
- **You do:** nothing. Don't rely on Duet's column controls while the user types.
- **Status:** [#61](https://github.com/JayFarei/duet/issues/61), [PR #63](https://github.com/JayFarei/duet/pull/63).

## Inline controls with the keyboard up

- **You see:** without the handling, on the open screen in a Safari tab, the inline rail slides up as the keyboard rises: "…" goes off the top of the screen and the lower items end up under the keyboard.
- **Cause:** iOS scrolls the layout viewport up by the keyboard's height (109pt on the open Duo) to keep the field in view, and a fixed rail moves with it.
- **Duet does:** hides inline controls while `useDuet().keyboard` is true, as in column mode; they come back when the keyboard closes. Strip mode (Home Screen apps) is unchanged.
- **You do:** nothing. Don't rely on Duet's inline controls while the user types.
- **Status:** [#123](https://github.com/JayFarei/duet/issues/123).

## A short visual viewport after a turn, read as the keyboard

- **You see:** without the handling, after turning the closed Duo from its side to upright (seen with a page dialog open), Duet's column controls stay hidden for good, as if the keyboard were up.
- **Cause:** WebKit can leave `visualViewport.height` short after a turn (466 against a 580pt page) until the next resize, with no keyboard.
- **Duet does:** counts the keyboard as up only while a text field (`:read-write`), a select or an iframe has focus, read through shadow roots, and re-reads on focus changes.
- **You do:** nothing.
- **Status:** [#122](https://github.com/JayFarei/duet/issues/122).

## Column controls under Safari's bar after a turn

- **You see:** without the handling, after the same turn leaves the visual viewport short (466 for a 580pt page), tapping Duet's close in Safari's column does nothing and the page dialog stays open.
- **Cause:** Safari draws its minimized bar at the bottom of the short visual viewport and takes touches from there down. Duet's column band ran to the page bottom, so the close straddled that line (y 439 to 488).
- **Duet does:** while the visual viewport is short with no keyboard up, reports its bottom as `visualBottom` on the context and moves the column band up to end above it, keeping the band's height by taking the lift from the Live Activities allowance first. A Live Activity may then cover the top button. The bar collapsing mid-scroll lags the visual viewport by under 40pt, short of the threshold, so nothing moves then.
- **You do:** nothing.
- **Status:** [#140](https://github.com/JayFarei/duet/issues/140).

## Inline controls as the keyboard goes down

- **You see:** without the handling, on the open screen in a Safari tab, tapping the page outside a focused field draws the inline rail about 107px too high for one frame, with "…" off the top of the screen, before it lands in place.
- **Cause:** focus leaves first, while iOS still holds the layout viewport scrolled up by the keyboard (visual viewport 286 of 618). With no field focused that short viewport no longer counts as the keyboard (#122), so the rail showed at once.
- **Duet does:** a keyboard that was up stays up after focus leaves until the visual viewport grows back, for at most 1s, so a viewport left short with no keyboard cannot hide the controls for good.
- **You do:** nothing.
- **Status:** [#126](https://github.com/JayFarei/duet/issues/126).

## Pinch zoom

- **You see:** nothing changes while the page is zoomed: the mode and placement stay put.
- **Cause:** with `visualViewport.scale` not 1, `innerWidth` is in zoomed px, so the window signature is unreadable.
- **Duet does:** keeps the last context (`confidence: "held"`) until the scale returns to 1. Column mode also requires scale 1, so a page that loads zoomed starts `inline`.
- **You do:** nothing.
- **Status:** see [Which mode](how-duet-decides.md#which-mode).

## Safari's URL bar collapses

- **You see:** `100vh` and `innerHeight` grow and shrink by 18px while the user scrolls, so full-screen sections jump.
- **Cause:** Safari collapses its URL bar on scroll, which changes the page height.
- **Duet does:** reports `useDuet().stableHeight`, the smallest page height seen at this window width and orientation, and sets it as `--duet-vh`. In column mode the page runs on under the floating URL bar, and `--duet-inset-bottom` reserves that space at the end of the scroller.
- **You do:** size full-screen sections with `min-height: var(--duet-vh, 100svh)`.
- **Status:** see [Laying out content](layout.md#laying-out-content).

## Live Activities and the top band

- **You see:** an empty gap at the top of the strip or column, even when no Live Activity runs.
- **Cause:** Live Activities grow the Dynamic Island down the strip and push Safari's buttons with it, and a page can't tell whether any are running.
- **Duet does:** always reserves the worst case measured on device (two activities); nothing rises into that space. Closed landscape was measured with a bare island only.
- **You do:** nothing.
- **Status:** see [Claimable space](how-duet-decides.md#claimable-space).

## Safari's forward button plus Live Activities

- **You see:** without handling, Duet's buttons hide under Safari's in a closed tab once the page has forward history and two Live Activities run.
- **Cause:** forward history grows Safari's back button into a 102.7pt back + forward pill, and the Live Activities push it down. The reader then ends at about 428 and the +/tabs pill starts at 541.6, so the band holds one button.
- **Duet does:** lets a lone group reach to within 5pt of Safari's buttons, so the burger and "…" still fit as one two-item group, centred between them. Where even that has no room (closed landscape), "…" is the only button and its list leads with the places.
- **You do:** nothing. Keep the important actions first, they are the last to fold.
- **Status:** [#97](https://github.com/JayFarei/duet/issues/97).

## In-app preview top bar compacting on scroll

- **You see:** without handling, scrolling a page in the in-app preview (default or full style, closed portrait) moves Duet's controls out of the preview's column into an inline strip across the page.
- **Cause:** the preview's top bar compacts as the page scrolls: the chrome above the page shrinks from 75 to 46px, below both the preview's old chrome range and the column's.
- **Duet does:** takes 44 to 77px of chrome as the preview, and in the preview checks only the column's width, so it stays `column` with the controls in place through the scroll.
- **You do:** nothing.
- **Status:** [#104](https://github.com/JayFarei/duet/issues/104). See [In-app preview](how-duet-decides.md#in-app-preview).

## In-app preview after visiting another app

- **You see:** without handling, leaving an in-app preview for another app and coming back moves Duet's controls out of the preview's column into a strip inside the page, next to the preview's own buttons, and they stay there.
- **Cause:** leaving, iOS snapshots the app at other sizes while the page still reads visible, then hands the preview back changed: a taller top bar for a while (382x548, 130pt of chrome), or the page 52 to 60pt narrower until something lays it out again (314x600 in the sheet's 450x670, 322x603 in the full 466x678). Both fail the preview's checks. Measured on the simulator (iOS 27.1); the timing varies between runs.
- **Duet does:** remembers that the page was the preview, and keeps that verdict through both changes until its bottom inset goes (a tab's is 0, as after Open in Safari). The controls stay in the preview's column and stay shown, and the menu opens from the page's real edge. If the page stays narrower than the window less the column, Duet sets the viewport meta's `width=device-width` to the real width, the only thing that lays it out again, and restores your meta when the window changes (turning, unfolding, Open in Safari).
- **You do:** nothing. A meta without `width=device-width` is left alone, and so is its blank band.
- **Status:** [#211](https://github.com/JayFarei/duet/issues/211), [#225](https://github.com/JayFarei/duet/issues/225). See [In-app preview](how-duet-decides.md#in-app-preview).

## In-app preview buttons and Live Activities

- **You see:** without handling, a Live Activity pushes the preview's close and reader/menu buttons down onto Duet's controls in the gap.
- **Cause:** Live Activities grow the Dynamic Island (one pushes those buttons about 45pt) while back stays put, and a page can't tell whether any are running.
- **Duet does:** sizes the gap for the worst case (two activities, `DUO.island`), about 54pt: one button, "…", centred. Nothing rises into the space the activities can take, so no Duet button sits under a native one.
- **You do:** nothing. Keep the important actions first.
- **Status:** [#104](https://github.com/JayFarei/duet/issues/104).

## Shared with You bar

- **You see:** without handling, a page opened from a link a contact sent in Messages loses the column: the controls drop into the page about a second after load while Safari's own column is still there.
- **Cause:** Safari heads the page with a "From <name>" bar under the status bar until the user closes it. It adds 40pt to the top chrome (98 to 138 on the closed Duo, also in closed landscape and split panes), which fails the column check. Safari's column buttons don't move, the page starts 40pt lower.
- **Duet does:** recognises the 40pt bar outside the full open window, keeps column mode and sets `useDuet().offsetTop` to 40, so every control lands where it does without the bar in screen points. `--duet-inset-bottom` stays the URL bar alone. Folding or splitting under the bar still reads as in transit.
- **You do:** nothing. Unmeasured: the bar at the largest Dynamic Type, in the in-app preview and on scroll.
- **Status:** [#112](https://github.com/JayFarei/duet/issues/112).

## In-app preview with forward history

- **You see:** without handling, after going back once in the in-app preview, Duet's button covers the preview's Back.
- **Cause:** with forward history the preview adds a Forward button where Back was and moves Back up a row (its top from 428 to 374pt), so the free gap ends higher.
- **Duet does:** reads `navigation.canGoForward` (re-read on `currententrychange` and `popstate`) and, in the preview, ends the gap above the raised Back. That gap holds one button with no room left for Live Activities, so with forward history an activity may push the preview's reader/menu button onto Duet's button, never onto Back.
- **You do:** nothing. The Navigation API only sees same-origin entries: coming back from another site, the preview shows Forward but Duet can't know, and its button may cover Back until the next same-origin navigation.
- **Status:** [#117](https://github.com/JayFarei/duet/issues/117), [PR #118](https://github.com/JayFarei/duet/pull/118).

## Controls flash over the in-app preview while it loads

- **You see:** without handling, on a slow connection, Duet's controls show for a moment over the in-app preview's share, reload and Safari buttons on the closed screen, then jump into the gap.
- **Cause:** the preview's bottom inset (34) reads 0 until `viewport-fit=cover` applies, and in the sheet about 100ms later still. The sheet's very first frames, the ones a pre-paint script reads, even report the whole 466x678 screen as the page inside the 450x670 sheet, with no column, and the full screen style's first frame (about 200ms) reports the whole screen as both window and page, with no chrome. Until then its window reads as a Safari tab, so the controls are placed at a tab's places, which are under the preview's buttons, and they stay there until the page hydrates.
- **Duet does:** when the first reading would be the preview once the inset lands, or the window is the sheet's (inside the closed screen on both sides, which no tab is), or the page is the whole closed screen (no tab is, its column and bar are always there), hides the controls for the page's first second (`useDuet().hidden` is `"pending"`), from the first paint with `bootScript` (`html[data-duet-pending]`). They show as soon as the preview is recognised, or after that second as a tab. A tab's bar collapsing into the same window size on a quick scroll never hides them.
- **You do:** nothing. Use `bootScript` so no frame shows them before the first effect.
- **Status:** [#143](https://github.com/JayFarei/duet/issues/143) (sheet), [#155](https://github.com/JayFarei/duet/issues/155) (full screen), e2e `pvl01` and `pvl02` (a load held 1.5s with `?slowjs`, sampled from the first paint).

## Controls flash over the clock unfolding the in-app preview

- **You see:** without handling, unfolding the in-app preview, full screen or default style, Duet's controls show for a frame on the right edge of the open screen, over the clock and the Dynamic Island, before moving into the side band below them.
- **Cause:** the open screen's first frame lays the page out at 951x594 in the 951x669 window before its insets land: the bottom inset still reads 0 (a tab's reading) or the 84pt right inset that holds the status column is not there yet (no band to put the controls in), so they go inline on the right. Unfolding the default style preview also passes, for about 40ms, through a page as wide as the closed screen (466x527 in 466x678, no insets) under a taller bar than any column's, which read as a tab.
- **Duet does:** for a second after the preview's window changes, as after its first load, hides the controls (`useDuet().hidden` is `"pending"`) while the window reads as the preview pending its inset, or as the unfolded wide preview with no side band, which every one measured has, and treats the closed screen's full width page under more than a column's bar as still moving (Safari lays one out only for the full screen preview, with no bar). They show in the band as soon as it lands, or after that second where they would be.
- **You do:** nothing.
- **Status:** [#159](https://github.com/JayFarei/duet/issues/159), e2e `j38-02` and `unf01` (unfold the preview three times, every frame sampled).

## Controls a scroll too high for a frame after a turn

- **You see:** without handling, on a page scrolled down in Safari's column, turning the phone, folding or unfolding showed the column controls for one frame about the scroll offset above their place, off screen or over the page, before they snapped back.
- **Cause:** the column layer is laid out in document coordinates and follows the scroll with a scroll driven animation (`data-follow`). Mid-turn the layer is hidden and the follow is off; the render that shows it again turned the follow back on in a passive effect, which React runs after the browser paints, so that first frame drew the layer unfollowed. Turned on before paint, the follow still missed that frame: a new animation waits for the next frame's animation update.
- **Duet does:** turns the follow on in a layout effect, before the frame that shows the layer, and holds the layer at `translateY(scrollY)` with an inline transform for that frame; the running animation overrides it, and it is dropped two frames later.
- **You do:** nothing.
- **Status:** [#131](https://github.com/JayFarei/duet/issues/131), e2e `scr01` (scroll kept across turn, unfold and fold), and every step now checks the layer before paint on each render that shows or moves it.

## Menus and popovers under Safari's buttons

- **You see:** without the handling, a menu that reaches into the column is drawn under Safari's back, reader or +/tabs buttons.
- **Cause:** Safari's native chrome always paints over the page, so `z-index` can't help.
- **Duet does:** keeps its own menus between `columnTop` and Safari's pill, or opens them wholly over the page when they are too tall.
- **You do:** keep your own popovers that cross the column below `--duet-safe-top-column` (0 outside column mode).
- **Status:** see [Claimable space](how-duet-decides.md#claimable-space).

## Plain layout before mount

- **You see:** on load, the page's column-mode styling (a band bled into the column, controls moved there) appears a moment after the plain layout, longer on a slow connection.
- **Cause:** `data-duet-mode` and the `--duet-*` variables are set from an effect, after the first paint.
- **Duet does:** ships `bootScript` (`duet-ui/boot`), which sets them before the first paint in column mode only.
- **You do:** inline it at the top of `<body>`. See [Pre-paint boot](server-rendering.md#pre-paint-boot).
- **Status:** [#94](https://github.com/JayFarei/duet/issues/94).

## Page modal turns off pointer events

- **You see:** without the handling, the `close` passed to `<Duet>` shows in the column while a Radix or Headless UI sheet is open but does nothing.
- **Cause:** those libraries set `pointer-events: none` on `<body>` while a modal is open, and the column layer inherits it.
- **Duet does:** sets `pointer-events: auto` on `.duet`, like system chrome over the page.
- **You do:** nothing.
- **Status:** [#94](https://github.com/JayFarei/duet/issues/94).

## Column buttons fire on touch down

- **You see:** buttons in Safari's column fire as the finger lands and show no native press state.
- **Cause:** touches in the column reach the page but are not hit-tested to elements outside the viewport, and Safari usually keeps the touch end.
- **Duet does:** listens for `pointerdown`, finds the button under the touch's coordinates and clicks it. In a split pane, the tap also tells Duet which side the pane is on.
- **You do:** nothing. Don't put anything that needs a long press or a drag in the column.
- **Status:** see [Column mode](how-duet-decides.md#column-mode-how-it-works).

## Animations removed by a page reset

- **You see:** in column mode without children, the controls lag behind momentum scroll.
- **Cause:** a reset like `* { animation: none !important }` (common under reduced motion) removes the scroll timeline the layer follows the document on, and so does a browser without scroll-timeline support.
- **Duet does:** falls back to a transform set on every scroll event, which lags in momentum.
- **You do:** exclude `.duet` from the reset, or pass the page as `children` (the steadier choice in any case).
- **Status:** [PR #56](https://github.com/JayFarei/duet/pull/56). See [Column mode](how-duet-decides.md#column-mode-how-it-works).

## Viewport meta and `viewport-fit=cover`

- **You see:** without the handling, Safari zooms a split pane out to fit the widened document, and `strip` mode is never detected.
- **Cause:** Safari shrinks the page to fit wide content unless the viewport meta says `shrink-to-fit=no`, and safe-area insets only reach the page with `viewport-fit=cover`. Frameworks add and rewrite viewport metas after load.
- **Duet does:** appends `shrink-to-fit=no` on import and `viewport-fit=cover` when `<Duet>` mounts, to every viewport meta, and keeps them on metas added or rewritten later. With no viewport meta it adds `width=device-width,initial-scale=1` first.
- **You do:** nothing, but don't set `viewport-fit=contain` or `shrink-to-fit=yes`: Duet only appends absent keys and leaves your values as they are.
- **Status:** 0.2.0, 0.2.1. See [Viewport meta](how-duet-decides.md#viewport-meta).

## Scrolling or typing on a real Duo drops the controls off the column

- **You see:** without the handling, on a real Duo in a closed Safari tab, scrolling up and down (fast or not), or scrolling and typing with the keyboard up, moves the controls out of Safari's column to the page edge, and they stay there.
- **Cause:** the real device reads outside the ranges measured on the simulator. Safari's bottom bar collapses to 59pt while the page scrolls (the simulator's compact bar is 80), and the keyboard shrinks the layout viewport, not only the visual one (382x411 in 466x678). Both failed the column test, and the wrong verdict was committed once the scroll settled.
- **Duet does:** counts the collapsed bar as Safari's column, and reads a page shrunk that far with a text field focused as the keyboard (the column stays, `useDuet().keyboard` is true). Signals that move while the user scrolls or types (page height, visual viewport) never take a tab out of the column, settled or not; moving into it still happens, so a wrong `inline` heals.
- **You do:** nothing.
- **Status:** [#132](https://github.com/JayFarei/duet/issues/132), 0.5.0.

## Mode flips back and forth

- **You see:** without the handling, the controls jump between the column and the page several times a second.
- **Cause:** column mode can feed back into the signals, for example when Safari zooms the page out to fit the wider document, the column signature disappears, `inline` removes the overflow, and the signature returns.
- **Duet does:** after 3 mode changes within 2s at the same window size, pauses column mode for 3s, doubling each time the loop resumes right after the pause, up to 60s. Changes while the window is still settling are not counted.
- **You do:** nothing.
- **Status:** 0.2.1. See [Oscillation guard](how-duet-decides.md#oscillation-guard).

## Mode detection limits

- **You see:** `inline` where you expected the column or the strip, or a Duo layout on a device that is not a Duo.
- **Cause:** iOS gives a web page no API for the device, the fold or Safari's buttons. Duet infers everything from window and screen sizes measured on the Duo, safe-area insets, display mode and the user agent.
- **Duet does:** uses the column only in Safari (not Chrome, Firefox, Edge or other apps' browsers), never in an iframe, and gives in-app web views (a user agent without `Safari/`) `inline`. A Duo whose reported sizes differ (display zoom, a future iOS release) gets `inline`, and an iPad or another device with matching sizes may read as a Duo.
- **You do:** use `useDuet().duo` to switch to a Duo layout, not as proof of the device. Check `useDuet().browser` to tell why a page is `inline`. For server-rendered layouts, see [Server rendering](server-rendering.md#server-rendering-and-hydration).
- **Status:** 0.2.2. See [Is this an iPhone Duo?](how-duet-decides.md#is-this-an-iphone-duo) and [Which mode](how-duet-decides.md#which-mode).

## Sheet X shown twice

- **You see:** on the open screen (or in inline mode) with a sheet open, two close buttons: the sheet's own X and Duet's close in the side controls.
- **Cause:** the recipe hid the sheet's X with `html[data-duet-mode="column"]`, so it only applied in Safari's column on the closed screen, while Duet shows its `close` button in every mode.
- **Duet does:** sets `data-duet-close` on `<html>` whenever its close button is on screen, in every mode. Inline and column controls hide with the keyboard up, so the attribute drops then and the sheet's X is the one left. A turn's few hidden frames keep it, so the sheet's X does not flash.
- **You do:** hide your X with `html[data-duet-close] .sheet-x { display: none; }` instead of the column-mode selector.
- **Status:** [#135](https://github.com/JayFarei/duet/issues/135).

## No close for a sheet in the in-app preview

- **You see:** in the in-app preview on the closed screen (sheet or full screen), a page sheet opened with `close` has no close button at all: Duet shows none and the sheet's own X is hidden.
- **Cause:** the gap holds one centred slot (see [In-app preview buttons and Live Activities](#in-app-preview-buttons-and-live-activities)). The close (a lone `back`) was folded into "…", which close mode never draws, while `data-duet-close` still hid the sheet's X.
- **Duet does:** puts the close itself in that slot, centred in the gap, and sets `data-duet-close` only when the close is placed. Turned sideways, where Duet hides for the preview, the sheet keeps its own X. Turned back upright with the sheet open, WebKit samples the column's edge against the landscape viewport (mid-edge at y 194 of 388) while laying out fixed boxes in the upright one (600 tall), so the edge guard (see [Full-screen `position: fixed` overlay or modal backdrop](#full-screen-position-fixed-overlay-or-modal-backdrop)) missed the sample point, the scrim filled the column for good and the close was neither painted nor tappable. The guard is now 240px tall, covering both midpoints while staying too small to count as an overlay itself.
- **You do:** nothing, with the `html[data-duet-close]` recipe from [Sheet X shown twice](#sheet-x-shown-twice).
- **Status:** [#142](https://github.com/JayFarei/duet/issues/142).

## No close after turning the in-app preview upright

- **You see:** now and then, in the in-app preview on the closed screen, with a page sheet open, turning the phone on its side and back upright leaves no close at all: Duet's close is covered by the sheet's scrim and the sheet's own X is hidden.
- **Cause:** WebKit sometimes keeps laying fixed boxes out against the 578-wide landscape window after the turn, so in the 366-wide upright window the right guard sits at x 570. Safari samples the right edge 4px in from that rect clipped to the document, which the column layer makes 450 wide, so at x 446, which the 16px guard does not cover. The hit test finds the scrim, fills the column with it, and that fill stays.
- **Duet does:** makes the right guard 300px wide, reaching inward from the edge, so it covers the sample point whether laid out in the window or the stale one. It stays under 0.9 of the narrowest window, so Safari still never takes it for a container.
- **You do:** nothing.
- **Status:** [#147](https://github.com/JayFarei/duet/issues/147).

## Overlay stacked level with the controls

- **You see:** with a page overlay (a sheet, a lightbox) at `z-index: 50` appended to `<body>` after `<Duet>`, inline controls sit under it: Duet's `close` shows through the dim but takes no tap.
- **Cause:** Duet's controls are fixed boxes at `z-index: 50` (`.duet-group`, `.duet-blob`, the column layer). Two boxes at the same level stack in document order, so an overlay mounted later wins.
- **Duet does:** keeps its controls at `z-index: 50`, under your own top-level UI by design, so a toast or popover of yours can rise above them.
- **You do:** keep overlays that should leave Duet's controls usable below 50 (`z-index: 40`), or mount them before `<Duet>`. Use 51 and up only for what should cover the controls.
- **Status:** [#191](https://github.com/JayFarei/duet/issues/191), 0.6.1.

## Folded primary runs at once

- **You see:** without the handling, when the primary folds into "…" (the band has no room for its group, as on the closed Duo with a menu and several actions), one tap on its row runs it, while its own capsule asks for a second tap.
- **Cause:** "…" rows ran their `onPress` on the first tap, the primary's row included.
- **Duet does:** applies the capsule's rule to the row (`primaryTap` in the template): the first tap arms it (tinted row, label `confirm`, the list stays open), the second runs it and closes the list. `confirm: false` runs at once. Closing the list, picking another row or tapping outside disarms it.
- **You do:** nothing.
- **Status:** [#191](https://github.com/JayFarei/duet/issues/191), 0.6.1.

## Burger without children

- **You see:** with no `children`, opening the burger shows the sidebar over the page instead of sliding the page aside.
- **Cause:** without an inner scroller the document is the page, and Duet cannot move it without moving Safari's column too.
- **Duet does:** draws the sidebar over the page, under the controls, always on the left edge. With `children`, the inner scroller slides by the screen's width in Safari's column and by up to 40% of the page (at most 340pt) inline, where it stays in view as a card to tap back to.
- **You do:** pass the page as `children` for the sliding card.
- **Status:** [#181](https://github.com/JayFarei/duet/issues/181), 0.6.0.

## One button of room

- **You see:** in the in-app preview, or a band that holds a single button, there is no burger, only "…".
- **Cause:** the burger and "…" need two buttons of room, and every action has to stay reachable.
- **Duet does:** shows "…" alone; its list starts with the page's actions, then a "Menu" section holding the places (checked for the current one). A sheet's `close` takes that one slot instead.
- **You do:** nothing.
- **Status:** [#181](https://github.com/JayFarei/duet/issues/181), 0.6.0.

## An app's own web view (a link opened in X)

- **You see:** on the closed Duo upright, or the open Duo wide, the burger and "…" sit under the clock, wifi and battery at the top right.
- **Cause:** some apps (X among them) open links in their own `WKWebView`, not in Safari's in-app preview, from the screen's top edge: edge to edge, or on the top part with the app's bar and the post below it (466x413 closed). There is no Safari column, no bar above the page and a top inset of 0, so nothing tells the page that the Duo's status column (and Live Activities in the island under it) covers its right edge.
- **Duet does:** a page that is the whole closed screen upright, or an app's web view as wide as it whatever its height, not a Home Screen app, with the controls on the right, keeps them below the status column at its worst (the island with Live Activities, 265pt), where a Home Screen app's strip starts. The same holds on the open screen, wide (951 wide). Open tall the status row heads the page and the controls already start below it.
- **You do:** nothing. Moving the controls left drops the allowance, nothing native is there.
- **Status:** [#194](https://github.com/JayFarei/duet/issues/194).

## X's sheet: a web view that stops before the status column

- **You see:** in X's sheet on the closed Duo upright, the burger and "…" sit inside the page at its top right, and the status column beside them is empty apart from the clock and wifi. The page's content is also narrower than the sheet.
- **Cause:** measured on a real Duo, X's web view is 382pt wide (inner 382x422, outer 382x477, screen 466x678, sheet pulled down 382x587). Unlike a Safari tab (outer 466), its frame stops at the column, and a test page's fixed element is clipped at x=382, whatever it does. No page can draw there.
- **Duet does:** treats the window as not a Duo: `useDuet().duo` is false and `device` is `iphone`, so the page gets what any other phone gets. An app that renders `<Duet>` only where `duo` is true keeps its own navigation; one that always renders it gets `inline`.
- **You do:** nothing, as long as your app handles phones. Only X can give the page the column.
- **Status:** [#243](https://github.com/JayFarei/duet/issues/243). Reproduced by the `xsheet` e2e scenario, whose host uses this frame closed upright. Other sizes in X's sheet are not measured, so they still count as a Duo.

## Square backing behind the open menu

- **You see:** in dark mode, a dark square behind the rounded "…" menu, its corners poking out (most visible bottom left).
- **Cause:** the menu's tint layer had no corner radius of its own and relied on the menu clipping it. WebKit skips that rounded clip once the glass beside it composites (it uses `backdrop-filter`), so the tint drew as the menu's full rectangle. In light mode the tint is transparent, so it did not show.
- **Duet does:** the tint layer inherits the menu's radius at every frame of the morph.
- **You do:** nothing.
- **Status:** [#198](https://github.com/JayFarei/duet/issues/198).

## Call to action hidden in the closed column

- **You see:** without the handling, on the closed Duo in Safari's column with a menu and a primary, there is no call to action: the band holds only the burger and "…", and the primary is a row inside "…", one menu tap away.
- **Cause:** the band is 92pt (104 for a lone group), and the burger group plus the primary's own group need 160.7pt, so the allocator folded the primary first.
- **Duet does:** gives the primary the burger's slot before folding it: the 2-slot group becomes the primary above "…", and the "…" list leads with the primary, a tinted row that arms on the first tap and runs on the second, and closes with the places (`allocate`). Either button morphs the whole capsule, as "…" always does: the primary grows it into a confirmation box (`confirmBox`, beside the column like the "…" menu) holding the icon, `label` and a tinted `confirm` button, on the "…" menu's spring; the button runs `onPress` and the box folds back into the capsule.
- **You do:** nothing. Pass the confirmed state as the next `primary` (label, icon, tint) and it shows in the slot as the box folds.
- **Status:** [#206](https://github.com/JayFarei/duet/issues/206), [#208](https://github.com/JayFarei/duet/issues/208).

## Primary in its own capsule

- **You see:** without the handling, where the primary has its own group (the open screen, the in-app preview filling it), a solid tinted circle with a coloured glow stands apart from the glass controls above it.
- **Cause:** the own group replaced the capsule's glass with the tint, while the form sharing a capsule with "…" drew a tinted button inside glass.
- **Duet does:** draws one form everywhere: a tinted button inside a glass capsule, with the same rim and shadow as the other controls.
- **You do:** nothing.
- **Status:** [#213](https://github.com/JayFarei/duet/issues/213).

## Right split pane holds two buttons

- **You see:** without the handling, Safari in the right split pane shows a lone "…", with a primary inside its list, though the pane has room for two buttons.
- **Cause:** the pane reserved the closed tab's Live Activity worst case (back slot top 265pt). In the pane, music and timer activities only push the back slot to 224pt, and the pane is 9pt shorter than the closed screen, which took the band under two buttons.
- **Duet does:** reserves the pane's measured 224pt, a band of 123.9pt, so two buttons fit at the worst case, clear of Safari's own buttons.
- **You do:** nothing.
- **Status:** [#226](https://github.com/JayFarei/duet/issues/226). e2e scenario `split-right-live`.
