# Edge cases

[Back to the README](../README.md)

Every iOS and Safari quirk Duet handles, what you would see without the handling, and what is left for you to do. Most need nothing from you. "Without children" means a page that renders `<Duet>` without `children`, so the document itself scrolls.

- [The "…" list past the screen's foot in a tall capsule](#the--list-past-the-screens-foot-in-a-tall-capsule)
- [The "…" list in an app that has not opted in to tabs](#the--list-in-an-app-that-has-not-opted-in-to-tabs)
- [The "…" list off the screen after folding a Home Screen app](#the--list-off-the-screen-after-folding-a-home-screen-app)
- [Places below the fold of "…" with one button of room](#places-below-the-fold-of--with-one-button-of-room)
- [An action folding after a Home Screen tabs app paints](#an-action-folding-after-a-home-screen-tabs-app-paints)
- [A burger one place before the tabs table said](#a-burger-one-place-before-the-tabs-table-said)
- [Docs describing the removed docked column](#docs-describing-the-removed-docked-column)
- [Five places behind a burger with room for tabs](#five-places-behind-a-burger-with-room-for-tabs)
- [Tabs then a burger while a Home Screen app launches](#tabs-then-a-burger-while-a-home-screen-app-launches)
- [Wrong layout on a fresh origin's first paint](#wrong-layout-on-a-fresh-origins-first-paint)
- [Controls at the closed screen's places while a Home Screen app launches](#controls-at-the-closed-screens-places-while-a-home-screen-app-launches)
- [Burger over the clock while a Home Screen app turns to wide](#burger-over-the-clock-while-a-home-screen-app-turns-to-wide)
- [Controls glide or hop on a wide Home Screen app](#controls-glide-or-hop-on-a-wide-home-screen-app)
- [Sidebar under Safari's floating buttons in split view](#sidebar-under-safaris-floating-buttons-in-split-view)
- [Page stuck pushed after resizing with the menu open](#page-stuck-pushed-after-resizing-with-the-menu-open)
- [Open sidebar ends short of the screen in split view](#open-sidebar-ends-short-of-the-screen-in-split-view)
- [White strip beside the open sidebar in the right split pane](#white-strip-beside-the-open-sidebar-in-the-right-split-pane)
- [Header in the status bar after rotating a Home Screen app](#header-in-the-status-bar-after-rotating-a-home-screen-app)
- [Blank strip below a Home Screen app](#blank-strip-below-a-home-screen-app)
- [Burger mid-page on a wide window](#burger-mid-page-on-a-wide-window)
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
- [Selected tab in the column](#selected-tab-in-the-column)
- [Light capsule with a white band](#light-capsule-with-a-white-band)
- [Light capsule edge reads as a seam](#light-capsule-edge-reads-as-a-seam)
- [Capsule far from the fingers on the open screen](#capsule-far-from-the-fingers-on-the-open-screen)

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

## Column buttons fire on release

- **You see:** a capsule in Safari's column swells as the finger lands and opens with labels after a hold or a drag, with a lens following the finger. The item under the lens runs on release, and the release fires once.
- **Cause:** touches in the column reach the page but are not hit-tested to elements outside the viewport, so `:active` never shows there. The simulator delivers the moves and the release. Whether every real device does is unverified, and earlier notes say Safari "usually" keeps the touch end.
- **Duet does:** listens on the window, finds the button under the touch's coordinates and drives the press itself. If no release has been seen on the page, a finger with no moves for 1.2s runs its item, so a tap still works if a device keeps the touch end. That tap would run 1.2s late, and a finger held still that long runs its item. Once a release has been seen, a lost finger lets go without running anything. In a split pane, the tap also tells Duet which side the pane is on.
- **You do:** nothing. Don't put anything else that needs a long press or a drag in the column.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). See [Column mode](how-duet-decides.md#column-mode-how-it-works).

## A held column button brings up the text loupe

- **You see:** without the handling, holding a column button starts text selection on the page beneath, with its loupe. The touch is taken from the press, and a ghost lens is left behind.
- **Cause:** the column's touches land on the page, and iOS treats a still finger there as a selection gesture.
- **Duet does:** cancels `touchstart` and `selectstart` while a press is live, and only then, so the page still selects text and scrolls normally.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Seen in the right split pane on the Duo sim.

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
- **Cause:** some apps (X among them) open links in their own `WKWebView`, not in Safari's in-app preview, from the screen's top edge: edge to edge, or (X since 2026-10) on the top 61% with the app's bar and the post below it (466x413 closed). There is no Safari column, no bar above the page and a top inset of 0, so nothing tells the page that the Duo's status column (and Live Activities in the island under it) covers its right edge.
- **Duet does:** a page that is the whole closed screen upright, or an app's web view as wide as it whatever its height, not a Home Screen app, with the controls on the right, keeps them below the status column at its worst (the island with Live Activities, 265pt), where a Home Screen app's strip starts. The same holds on the open screen, wide (951 wide). Open tall the status row heads the page and the controls already start below it.
- **You do:** nothing. Moving the controls left drops the allowance, nothing native is there.
- **Status:** [#194](https://github.com/JayFarei/duet/issues/194).

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

## Column press in a short band

- **You see:** without the handling, a two-item capsule in closed portrait opens with "GitHub" touching the "…" below it, since the band under the Live Activity slot is short.
- **Cause:** the open capsule stayed inside the band reserved at rest, which leaves less pitch than label and icon need.
- **Duet does:** lets the press open up into the Live Activity reach. If an activity is up, Safari's buttons paint over the capsule's top while it is held. If the pitch still cannot clear a label, the capsule opens without labels.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Seen on the closed screen of the Duo sim.

## Column press swell depends on the capsule's height

- **You see:** a still finger grows a five-item capsule by about 16pt but a two-item capsule by about 6pt.
- **Cause:** native scales the capsule about its centre by about 6%, measured on five items, and nothing was measured for two.
- **Duet does:** applies the same 6% to any height through geometry, not `scale`, so the swell runs straight on into the open shape. The items spread with it and the icons grow 6%. The lens stays still on the page while the capsule moves under it.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Two and three items are unverified against native, since the only reference has five.

## Five-item press at full width is inline, not a column

- **You see:** on the Duo's large full-width page, a group of five actions shows six items, the fifth followed by "…" for More, and they sit at the page top. Native's five-item column has no "…" and sits lower.
- **Cause:** open full-width Safari is always inline. Only a split pane is a column, and a split pane's band fits two or three buttons, so five items cannot reach a real column.
- **Duet does:** runs the same press in both modes, so the capsule, labels and lens behave alike. Near the page top, the capsule stops at the top edge and opens downward instead of rising.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Seen on the inner screen of the Duo sim. The press was measured there with a test-only build that drops "…" and a lowered capsule, then checked on the normal build.

## Column lens bend is only on its own copy

- **You see:** the lens bends the accent icons and labels at its rim, but not the capsule's edge or the page behind it, which native does bend. On a page whose CSP has no `data:` images, the accent copy is not bent at all.
- **Cause:** WebKit does not apply a displacement filter to a backdrop, only to an element's own content. The displacement map is a `data:` PNG, and a filter whose image is missing would blank the copy.
- **Duet does:** bends a magnified accent copy of the items, and uses the filter only once the map has loaded, so a blocked map leaves the copy clear and unbent.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Backdrop bending cannot be matched from the web.

## Selected tab in the column

- **You see:** the selected item of `tabs` sits on a darker bubble with its icon in the tint. Tapping another item lifts the bubble into a clear lens, carries it over, and settles it as the bubble again on the new item, with a brief dip in the icon.
- **Cause:** native's selection is one object that moves. Tinting the new item and fading the old one would show two states at once and lose the travel.
- **Duet does:** sets `aria-current` on the selected tab. A tap on an `actions` item in the same capsule fires it with the plain lens and leaves the bubble where it was. While the lens is up it carries the tint and the capsule's items stay plain. The swap back to the bubble is a single frame, because fading first would show the plain item through the lens's hole.
- **You do:** pass `tabs={{ items, selected, onSelect }}` and move `selected` in `onSelect`.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251). Measured against Apple News+ in dark mode on the Duo. The light mode values are a judgment call, with no native reference recorded.

## Light capsule with a white band

- **You see:** without the handling, on a light page, a capsule has a hard white band about 5pt wide inside its edge, with a greyer panel inside that.
- **Cause:** the rim ring brightens its backdrop to suggest native's refracted edge. On dark glass that reads as a soft edge. On light glass it clips to white, 255 against 248 inside, with a hard step where the ring ends.
- **Duet does:** turns off the ring's backdrop filter in light mode (`--duet-rim-filter`). Safari's own light buttons have no band: measured on the Duo, they have a thin edge line and a soft shade.
- **You do:** nothing.
- **Status:** [#251](https://github.com/JayFarei/duet/issues/251).

## Light capsule edge reads as a seam

- **You see:** without the handling, on a light page, a capsule has a washed out fill, a pale seam at its top and bottom caps, and an edge line that is thicker on the left. On a saturated page the colour drains, red fill G 173 falling to 155 at the side against native's flat 152.
- **Cause:** three things. The line was a box shadow in one flat colour, so it could not darken each page colour the way native's does. The rim was added light, which greys a saturated page. Its 5pt mask band also cut off native's long shade at the caps, and its shadows also lit the sides.
- **Duet does:** in light mode, draws the line with a new ring under the glass (`.duet-edge`), whose backdrop filter darkens the page itself, and insets the glass 0.6pt so that ring sees the page. The rim uses `color-dodge` with a 16pt band, which brightens each colour in its own hue. Negative spread keeps the sides at zero. Dark mode opts out of all of this.
- **You do:** nothing.
- **Status:** [#256](https://github.com/JayFarei/duet/issues/256). Measured against Safari's own column on the closed Duo on 8 flat colours: total error 15340 before, 8658 after. Remaining: caps on near white pages are brighter than native (254 to 255 against 248 to 253), and the line lacks native's soft outer pixel. The press lens and selection bubble are unchanged, with no native light reference found.

## Capsule far from the fingers on the open screen

- **You see:** without the handling, on the Duo's inner screen in full screen Safari or a split pane, the capsule floats mid-page, well above where a thumb rests. Native apps keep theirs near the foot.
- **Cause:** the controls centred in their band. In full screen Safari all its bars are at the top, so the band runs to the screen's bottom edge and its middle is a long reach.
- **Duet does:** ends the stack at the foot of the band: 23.7pt above the screen's bottom in full screen, like native capsules, whatever the home indicator inset, and just above Safari's +/tabs pill in a split pane. A lone burger stays at the head of the page. Safari's column on the closed Duo stays centred, and a stack too tall for its band still centres.
- **You do:** nothing. The room is unchanged from the [#110](https://github.com/JayFarei/duet/issues/110) contract, only the position inside it moved.
- **Status:** [#254](https://github.com/JayFarei/duet/issues/254). Verified on the Duo in full screen and split left, with the capsule open under a press. Split right and the burger plus capsule layout are covered by unit tests only.

## The "…" list past the screen's foot in a tall capsule

- **You see:** a `menu.tabs` capsule holding five places and "…": the open list runs off the foot of the page, over Safari's buttons in Split View.
- **Cause:** the morph kept the capsule's height when that was taller than the list. It only ever grew before tabs made a capsule that tall.
- **Duet does:** in a `menu.tabs` app, the morph ends at the list's height, from a taller capsule as from a shorter one.
- **You do:** nothing.
- **Status:** seen on the Duo simulator, see the release's evidence: Safari wide, Home Screen tall, Split View left. A capsule shorter than its list has the path it had.

## The "…" list in an app that has not opted in to tabs

- **You see:** without the handling, upgrading changes an app that did not ask for anything: its open "…" list is shorter on iPhone, iPad and desktop, 82pt instead of the capsule's 152pt, and sits somewhere else.
- **Cause:** the fix for a tall `menu.tabs` capsule changed the morph for every app.
- **Duet does:** only `menu.tabs` apps end at the list's height. Any other app keeps the capsule's height when that is taller, as in 0.8.0-rc.2, on every device, the Duo included. So its list can still leave blank room, or reach past the page's foot on a small screen.
- **You do:** nothing. To get the shorter list, opt in with `menu.tabs`.
- **Status:** same list rectangle as 0.8.0-rc.2 on the Duo simulator in Safari wide and tall, with and without a `tabs` capsule, and in Playwright WebKit at phone, iPad and desktop sizes, not on those devices.

## The "…" list off the screen after folding a Home Screen app

- **You see:** "…" open in a closed Home Screen app, then unfold: the list stays open at its old place, clipped by the right edge, and again on folding back.
- **Cause:** an open list's geometry is fixed when it opens. Safari's fold changed tabs to burger and so closed it. A Home Screen app reads the same room in both windows, so nothing closed it.
- **Duet does:** on a Duo, a new mode or window width closes "…" and any open confirmation. A height change does not, so Safari's bar collapsing leaves it open. Other devices keep what they did.
- **You do:** nothing.
- **Status:** seen on the Duo simulator, unfolding and folding.

## Places below the fold of "…" with one button of room

- **You see:** closed Safari turned, a `menu.tabs` app with actions: only "…", and its list opens with the actions, so a fifth place is below the fold.
- **Cause:** the band holds one button. A burger there would lose the actions, so "…" holds everything.
- **Duet does:** a `menu.tabs` app lists the places first in that one button, since they are what the burger would have been. Without actions the burger shows. Other apps keep "This page" first.
- **You do:** nothing.
- **Status:** seen on the Duo simulator at 594x368.

## An action folding after a Home Screen tabs app paints

- **You see:** a Home Screen tabs app wide, after a rotation or launch: the capsule shows two actions and "…", then one action folds into "…" about 700ms later.
- **Cause:** the places decision read the strip's room from the start, the action allocation read the inline band that holds until the inset lands.
- **Duet does:** a `menu.tabs` app allocates from the strip's room as well, in the same windows. An app without `menu.tabs` keeps its allocation.
- **You do:** nothing.
- **Status:** seen on the Duo simulator, rotation and cold launches, by a frame trail.

## A burger one place before the tabs table said

- **You see:** a `menu.tabs` app without actions, full-screen Safari at 951x543 with 9 places or at 669x825 with 15: a burger and "…", where the table in the docs said tabs fit.
- **Cause:** the table counted those windows with no "…". Inline windows, which include a Home Screen app's, always list "Move controls" there, so "…" always takes a slot.
- **Duet does:** superseded, see "A \"…\" with nothing in it but Move controls". "…" no longer counts unless something is in it, and a test holds the table to the rule.
- **You do:** nothing.
- **Status:** seen on the Duo simulator without actions, at each limit and one above, in Safari wide and tall, Home Screen wide and tall and closed Home Screen.

## A "…" with nothing in it but Move controls

- **You see:** an app that does not want its controls moved still has a "…" holding only "Move controls left", and that "…" costs a tab its room. A side stored by an earlier visit keeps the controls on that side.
- **Cause:** every inline window listed the row and honoured the stored side, with no way to opt out.
- **Duet does:** moving the controls is the `moveControls` prop, off by default. Off, there is no row, no drag and no stored side.
- **You do:** pass `moveControls` if your users should be able to move the controls.
- **Status:** seen on the Duo simulator, wide Safari, before and after.

## "Move controls left" that does nothing on a Home Screen app

- **You see:** a Home Screen app, wide on the Duo, with `moveControls`: tap "Move controls left", the menu closes and the controls stay.
- **Cause:** the row was listed by the frame's kind, and a strip's frame is inline too, but a strip's side comes from its safe-area inset, not from the user's choice.
- **Duet does:** lists the row and allows the drag only where `canMoveControls` holds: inline and not a strip, including a Home Screen app whose inset has not landed yet.
- **You do:** nothing.
- **Status:** seen on the Duo simulator, Home Screen at 951x669, before and after.

## Docs describing the removed docked column

- **You see:** [Pre-paint boot](server-rendering.md#pre-paint-boot) linked to a section that no longer exists and named an attribute the boot script no longer sets.
- **Cause:** the column's removal missed that page.
- **Duet does:** the page describes what `bootScript` does now, and a test keeps the removed names out of the docs.
- **You do:** nothing. Remove any CSS you keyed on the old attribute.
- **Status:** `test/places-tabs.test.mjs`. The boot's `data-duet-pending` was seen on the Duo simulator.

## Five places behind a burger with room for tabs

- **You see:** without the handling, an app chooses `tabs` or `menu` once. Tabs fold into "…" one at a time where room runs out, and a burger hides five places on a screen with room for all of them.
- **Cause:** tabs merged into the actions, so nothing could turn them into a burger.
- **Duet does:** with `menu.tabs`, `placesFit` shows every place as a tab or none: a burger with its sidebar otherwise. Actions and primary fold first. An item without an icon keeps the burger. See [Tabs or burger](how-duet-decides.md#tabs-or-burger) for the measured counts.
- **You do:** pass `tabs: true` with an icon on every item, and inline `bootScript`.
- **Status:** `test/places-tabs.test.mjs`, and on the Duo simulator at 2, 3, 5, 6 and 7 places in Safari wide and tall, Home Screen wide and tall, Split View both sides, closed Safari and closed Home Screen. An open sidebar closes on unfolding into tabs. A rotation at the margin (7 places on the Home Screen) shows the old form for one frame, under 5ms, as the window lands. Live Activities are modelled. Not yet seen on a device.

## Tabs then a burger while a Home Screen app launches

- **You see:** without the handling, a Home Screen app with 7 places shows tabs for about 600ms, then a burger.
- **Cause:** the strip's insets land late. The first readings are inline with more room, and `stable()` holds that mode for 550 to 600ms.
- **Duet does:** on a Duo Home Screen app, except the inner screen upright, `placesFit` reads the strip's room from the start, from the screen's fixed height, so it gives the same answer at launch, after rotation and once the insets land.
- **You do:** nothing.
- **Status:** `test/places-tabs.test.mjs`, and on the Duo simulator: first visible at t=153-190ms in the final form, closed and open, with the same rects when the strip commits at about 800ms.

## Wrong layout on a fresh origin's first paint

- **You see:** without the handling, a first visit paints the closed Duo's layout until hydration, or until `<DuoCookie>` reloads.
- **Cause:** the server cannot measure the window, so it renders a closed snapshot, and a cookie only helps from the second visit.
- **Duet does:** `bootScript` reads the window, screen and user agent before the first paint and sets `data-duet-pending` on the inner screen, so the controls wait for the mounted chrome. With `menu.tabs` the nav also waits for hydration everywhere, so neither a burger nor tabs show before the right one.
- **You do:** inline `bootScript` as the first child of `<body>`.
- **Status:** tested against stubbed browsers (8.7KB, budget 10KB in `test/boot.test.mjs`), and on the Duo simulator on fresh host names in closed Safari, and in Home Screen launches with no cookie. Not yet seen on a device.

## Burger over the clock while a Home Screen app turns to wide

- **You see:** without the handling, turning an open Duo's Home Screen app from tall to wide leaves the burger at the inline top, over the status clock and Wi-Fi, for about 900ms, then glides it to its strip place over about 450ms.
- **Cause:** the wide window comes about 370ms before the strip's 84pt inset, and without the inset the page reads as inline. Inline committed in that window, so the inset landing was held to the settle, and the commit at the settle was "sure", which turned transitions back on.
- **Duet does:** hides the controls, committing nothing, while a window not yet shown reads inline in a turn of a Duo's wide Home Screen app. The inset landing commits the strip at once, while transitions are still off. If no inset comes, inline commits at the settle, at most 2s, and later events do not hide it again. A page that opts out of `viewport-fit=cover` never gets an inset, see [Controls glide or hop on a wide Home Screen app](#controls-glide-or-hop-on-a-wide-home-screen-app). The match needs standalone, a Duo, and a window wider than tall and at least 600pt wide, so Safari, the iPad, phones and desktop are unchanged.
- **You do:** nothing.
- **Status:** `test/first-paint.test.mjs`, and on the Duo simulator at 30fps, burger and tabs forms, both directions: controls absent for 12 frames (390ms) going to wide, 8 of them the rotation itself, then in place with no movement. Going to tall was already at once. Not fixed, because iOS sets it: the rest of the wait for the inset. A launch in wide was not exercised on the simulator here, only in the tests. Not yet seen on a device.

## Controls glide or hop on a wide Home Screen app

- **You see:** without the handling, two things on an open Duo. A page with `viewport-fit=auto` or `contain` turned from tall to wide hides its controls for about 1s, then the tall tabs capsule morphs to the burger over about 480ms. A wide launch shows the controls at x=794 for 1 or 2 frames of the launch fade, sometimes as the inline burger at the top, then they hop 84pt to x=878.
- **Cause:** the turn's hold waits for a strip inset that never comes to a page that opts out of cover, so inline committed only at the settle, which turns transitions back on. On a launch of any other page, iOS reads 867 inside the 951 window for 60 to 90ms, with inset 0 or 84, and that reading was taken as the final window.
- **Duet does:** reads the viewport meta. With an explicit `viewport-fit=auto` or `contain`, it ends the hold when iOS narrows the page to 867, so the controls appear in place with no transition, and a launch shows at 867 as before. Without that, a wide launch waits at 867 for the 951 window, capped at 1s. A viewport meta with no `viewport-fit` counts as cover, since Duet adds it at mount. The match needs a standalone Duo, so Safari, the iPad, phones and desktop are unchanged, and final places are unchanged.
- **You do:** nothing.
- **Status:** `test/first-paint.test.mjs`, and on the Duo simulator, 30fps recordings. Turn with `viewport-fit=auto`: hidden about 350ms, then in place at [794,11], no glide. Before, about 1s and a 480ms glide. Wide launch with cover: 9 of 9 show the controls once at [878,265], no hop. Before, 9 of 9 showed a reading at x=794 first. Tall launches, and the wide to tall turn, are unchanged. A launch that stays at 867 on a page with cover has its controls hidden for up to 1s; that case is covered by tests only, since it was not seen on the simulator. Not yet seen on a device.

## Controls at the closed screen's places while a Home Screen app launches

- **You see:** without the handling, an unfolded Duo's Home Screen app first paints the burger and controls at the closed screen's places, over content at half width, for about 200 to 300ms, in landscape and portrait.
- **Cause:** iOS starts the app with a 466x678 viewport inside an open outer window (951x669 or 669x951), then reports `visualViewport.scale` 2.04 at 466x669 with the insets landed, then 951x669, then the strip inset. The boot script and `stable()` read the first of these as a closed screen, and a reading held at scale 2.04 dropped the hidden state.
- **Duet does:** treats those launch readings as pending, so the controls stay hidden until the window lands. A reading held at another scale keeps the hidden state until the 1000ms cap. The match needs standalone, an open outer window, a screen under 700pt on its short side, and an inner width near 466 or 951 with no side inset yet, so a closed Duo, an iPad, Safari and desktop are unchanged.
- **You do:** nothing.
- **Status:** `test/first-paint.test.mjs`, and on the Duo simulator: controls hidden until t=196-247ms, then in place. Not fixed, because iOS sets it: page content is still laid out at half width for about 200ms, a launch with no band can wait up to the 1s cap, and the white launch splash comes before the document loads. Not yet seen on a device.

## Sidebar under Safari's floating buttons in split view

- **You see:** without the handling, in a split pane the burger's sidebar opens from the document's left edge, so Safari's buttons in its left column, and the burger, sit over its rows.
- **Cause:** the document spans the left column and is scrolled across it, and the sidebar started at document x 0. The page keeps clear by an inset, the sidebar did not.
- **Duet does:** on a Duo, sets `--duet-sidebar-inset` to the page's left inset, pads the rows by it and widens the sidebar to match, so they keep their width.
- **You do:** nothing.
- **Status:** seen on the Duo simulator: sidebar from x -84, burger clear of the rows. Other devices are unchanged.

## Page stuck pushed after resizing with the menu open

- **You see:** without the handling, open the burger in Split View and drag the divider to full: the page stays pushed 340pt to the right beside a menu that no longer belongs, and the actions capsule is gone.
- **Cause:** the open state outlived the layout it was opened in. The window crossed the 600pt split width, and the push is only right for that layout.
- **Duet does:** on a Duo, closes the sheet when the layout changes (`sheetLayout`: mode and split). The bar compacting, or a resize within one layout, leaves it open.
- **You do:** nothing.
- **Status:** seen on the Duo simulator, left and right pane, 951x543 after the drag: scroller x 340 before, 0 after, title x 356 before, 16 after, capsule back. Other devices are unchanged, the sheet stays open across their resizes.

## Open sidebar ends short of the screen in split view

- **You see:** without the handling, the open sidebar stops at the viewport's foot, 571pt, with a band of page colour down to the screen's foot behind Safari's URL pill.
- **Cause:** a split pane's viewport ends above the bar, the bar floats over the page, and the sidebar is only as tall as the viewport.
- **Duet does:** in a column, the open sidebar carries its colour 240pt further down with a box shadow. Its height stays the viewport's, so the last rows stay above the bar, and a shadow adds no scrollable overflow.
- **You do:** nothing. After scrolling, Safari compacts its bar and paints it itself from 589pt down, in the page's `theme-color`. Forcing the root background to the sidebar's colour did not change it, so a theme colour unlike the sidebar's shows as a band there.
- **Status:** seen on the Duo simulator, both panes: the pixels at 580pt and 660pt are the sidebar's colour, before they were the page's. The compacted bar's band remains. The closed screen's column has the same rule, not checked with the sidebar open there.

## White strip beside the open sidebar in the right split pane

- **You see:** without the handling, with Safari in the right pane, the open sidebar leaves Safari's 84pt column beside it white, on a dark page too.
- **Cause:** not the canvas. The document spans a column on each side, starting 84pt left of the viewport, and the page cannot tell which pane it is in. The page slid by the screen's width landed at x 385, still over the strip, carrying its card background, `Canvas`, which is white without a dark `color-scheme`.
- **Duet does:** in a column, the page also slides by the left inset, `--duet-sidebar-inset`, the sidebar's shadow carries its colour across the right edge by the same inset, and the moving card takes `--duet-page`, falling back to the sidebar's colour instead of `Canvas`. The inset is 0 outside a split pane, so those columns paint as before, apart from the card's fallback colour while it leaves.
- **You do:** nothing. Set `--duet-page` if the moving card should be your page's colour.
- **Status:** seen on the Duo simulator, both panes, dark and light: (875,300) was white, it is now the sidebar's colour, and the burger closes the sheet. The strip no longer holds a tappable card in the right pane. A frame scan of the slide shows the fallback colour during the move; a closed screen column with the sheet open was not reached.

## Header in the status bar after rotating a Home Screen app

- **You see:** launched wide then rotated to tall, a page's header sits in the clock and Wi-Fi row, blurred by iOS. The burger is clear, and a relaunch looks right.
- **Cause:** the rotated app has a safe top of 61pt (82 with `black-translucent`), launched tall it has 0. `--duet-inset-top` stays 0 there, because it holds only the blur iOS does not report, so a page padding by it alone gets 0.
- **Duet does:** nothing changes: the burger follows the safe area, and `--duet-inset-top` keeps adding to it. Putting the safe top in the variable would double it for pages and the pane bar that add the two (title at y 134 instead of 73).
- **You do:** pad by `calc(env(safe-area-inset-top) + var(--duet-inset-top, 0px))` with `viewport-fit=cover`. See [Keeping the top clear](layout.md#keeping-the-top-clear).
- **Status:** observed on the Duo simulator: variable alone, title y 12; the sum, title y 73, below the status bar, y 12 launched tall.

## Blank strip below a Home Screen app

- **You see:** an empty strip below the page that does not scroll: 82pt launched tall, 21pt rotated to tall or wide.
- **Cause:** the icon was added with `black-translucent`. The viewport starts at the screen's top and ends short of its foot. The other styles do not do this.
- **Duet does:** nothing it can: the style is read when the icon is added, and it is not Duet's meta.
- **You do:** use `default` and add the icon again. If you keep `black-translucent`, the `html` and `body` background paints the strip. See [Status bar style](layout.md#status-bar-style-for-home-screen-apps).
- **Status:** observed on the Duo simulator, bare page and fixture. Manifest display modes through a real Add to Home Screen were not tested.

## Burger mid-page on a wide window

- **You see:** on an unfolded Duo, the burger at the closed screen's position, about 393pt across, with no error.
- **Cause:** the page has not hydrated, so `useDuet()` still holds its server snapshot. `next dev` causes this over a LAN or VPN name without `allowedDevOrigins`.
- **Duet does:** with `bootScript`, hides those controls until the chrome mounts, so a page stuck there shows none.
- **You do:** fix hydration. See [Server rendering](server-rendering.md).
- **Status:** the hiding is tested against stubbed browsers.
