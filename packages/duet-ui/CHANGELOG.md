# Changelog

## Unreleased

- The primary's tap grows its button into a confirmation box beside the column (icon, `label`, a tinted `confirm` button), on the "…" spring; the button runs it and the box folds back.
- The primary stays on screen in a slot: where its own group does not fit, it takes the burger's slot above "…", and the places move to the top of the "…" list. It folds into "…" only where one button is all that fits.
- Breaking: the pure export `pillRect` is replaced by `confirmBox(frame, from)`; the box grows from the whole capsule, and with the primary in the capsule, "…" lists it too.
- Site: every mailbox in the panes demo opens its own list (#204); the Column notes sheet runs under Safari's address bar to the screen's bottom with a lighter top blur (#205); the book demo opens on a class page, its Book button in the controls, then "Book with N credits" in the box (#206, #208).

## 0.6.1

Everything from 0.6.1-rc.1 to 0.6.1-rc.3.

## 0.6.1-rc.3

- X's current in-app browser (a web view on the screen's top 61%, X's bar and the post below it, 466x413 closed): the controls no longer sit under the status column's clock, wifi and battery. rc.2 matched only a web view filling the whole screen. Any app web view as wide as the screen, closed upright or open wide, now gets `clearTop` below the status column, whatever its height (#194).
- The open "…" menu in dark mode: no square backing behind its rounded corners. Its tint layer now inherits the menu's radius; WebKit dropped the menu's rounded clip on it once the glass beside it composited (#198).
- e2e: host style `xsheet`, an X-like sheet, and suite `xsheet`.

## 0.6.1-rc.2

- An app's own web view (a link opened in X), on the closed Duo upright and on the open Duo wide: the controls no longer sit under the status column's clock, wifi and battery. The page is the whole 466x678 screen with no chrome and a top inset of 0, which read as a plain full-width page, inline right at the top. Such a page now gets `clearTop` below the status column at its worst (the island with Live Activities, 265pt), like a Home Screen app's strip. Open wide (951x669, window = screen) the status column heads the right edge the same way and gets the same `clearTop`. Open tall the status row heads the page and the controls already start below it; turned closed, no status bar shows (#194).

## 0.6.1-rc.1

- A primary folded into "…" arms on the first tap (its row takes the tint and reads `confirm`, the list stays open) and runs on the second, like its own capsule. It ran at once. Closing the list disarms it. A folded primary that ran in one tap now takes two; pass `confirm: false` to keep one. New pure export `primaryTap(armed, confirm)` (#191).
- The armed capsule's accessible name is its `confirm` text ("Cancel booking"), as shown; it kept the plain label.
- Column controls after a fast flick up then down in a closed Safari tab (#191): not reproduced. The report's own captures show the controls in place in every Safari frame (the one capture without them is the Home Screen), and repeated runs of the exact flick keep them. New e2e suite `scr06` guards it.
- README: the folded primary, the `z-index: 50` stacking of the controls (an overlay at the same level mounted later covers the inline close), `<DuoCookie>`'s one reload on an unseen device, and the panes example without the removed `back` prop.

## 0.6.0

The templated column (#181). Breaking: the chrome is rebuilt around one template, the same on every layout.

- New `menu={{ items, selected, onSelect }}` (`DuetMenuItem<T>`): the burger heads the controls and opens the app's places in a sidebar, sliding the page (the inner scroller) aside by the screen's width in Safari's column and by min(340, 40% of the page) inline. Without `children` the sidebar comes over the page. Each place keeps its scroll position.
- `menu.burger: false`: no burger; the places lead "…" under "Menu", as in the preview.
- `duet-ui/package.json` is exported, so a site can show the installed version.
- The template: burger, then actions while they fit, then "…" closing the group, the primary in its own group (at the thumb inline). "…" grows into its list on one interruptible spring (open 300/30, close 380/37, list and tint clear in 110ms) and any tap outside closes it. The in-app preview shows only "…", its list led by a "Menu" section, then "This page". Inline, "…" lists "Move controls left/right".
- `primary` arms on the first tap into a 214pt tinted pill and runs on the second. `DuetPrimary` is now `DuetItem & { confirm?: string | false }`: the pill's label, or `false` to run at once. `prominent` and `expanded` are gone.
- Glass ported from the column prototype: a sharp backdrop layer, a blended base (darken in light, lighten in dark) and a rim. Column groups follow the system appearance, menus the page's. Largely supersedes the measured strip and inline rim of 44b0719.
- Removed: `tabs`, `back`, `leading`, `searchButton`, `accessory`, `minimizeOnScroll`, `menuStyle`, the island menu, `DuetTab`, and from `geometry`: `plan`, `Plan`, `Spec`, `islandBox`, `islandFits`, `morphBox`. New pure layout exports: `template`, `allocate`, `frame`, `place`, `menuBox`, `pillRect`, `groupHeight`, `TEMPLATE`.
- Kept: `useDuet`, `DuoCookie`, the column layer and its tap routing, page insets and `<html>` margins, the viewport patch, the edge guards, side drag, `GlassProvider`, `columnBand`, `DuetPanes`.

## 0.5.0

Everything from 0.5.0-rc.2.

## 0.5.0-rc.2

- Column mode, on a scrolled page: turning the phone, folding or unfolding no longer, now and then, shows the controls for one frame about the scroll offset above their place. The render that shows the layer again after a turn turned its scroll follow back on after the paint, and a new scroll driven animation only applies from the next frame anyway. The follow now turns on before paint, with an inline transform holding the layer in place until the animation runs (#131).
- In-app preview, unfolded: the controls no longer flash for a frame over the clock and the Dynamic Island as the full screen preview unfolds. The open screen's first frame lays the page out before its bottom or right inset lands, so it read as a tab or as the preview with no side band, both inline on the right. After a preview's window changes, those readings now hide the controls for up to a second, as on its first load, and a hidden reading no longer holds back the band once it lands. Unfolding the default style preview's passing frame, the closed screen's full width page under a taller bar than a column's, now reads as still moving instead of a tab (#159).
- In-app preview on the closed screen, full screen style: the controls no longer flash over the preview's Back and Share while a page loads. Its first frame reads the whole 466x678 screen as both window and page, with no chrome, no column and inset 0, which read as no known window, so `bootScript` left the server-rendered controls at a tab's places until hydration. That reading now counts as a preview pending its layout too (#155).
- In-app preview on the closed screen: turning the phone on its side and back upright with a page sheet open no longer, now and then, leaves no close. WebKit could keep laying fixed boxes out against the landscape window (right guard at x 570 in a 366-wide window) while sampling the edge 4px in from the 450-wide document, which the 16px guard missed, so the scrim filled the column over the close. The right guard is now 300px wide, reaching inward (#147).
- In-app preview on the closed screen: a page sheet's `close` shows, centred in the gap above the preview's bar. It was folded into a "…" close mode never draws while the sheet's X stayed hidden, so there was no close at all. `data-duet-close` is now set only when the close is placed. The edge guard is 240px tall instead of 64px: turned back upright with the sheet open, the preview samples the edge at the landscape viewport's midpoint, which the short guard missed, so the scrim filled the column and hid the close (#142).
- In-app preview on the closed screen: the controls no longer flash over the preview's share, reload and Safari buttons while a page loads. A page whose first reading would be the preview once its late bottom inset lands, or that sits in the sheet's window before its page is laid out, keeps them hidden for up to a second (new `hidden: "pending"`, `html[data-duet-pending]` from `bootScript`) (#143).
- Column mode: after a turn leaves the visual viewport short with no keyboard (466 for a 580pt page), the column band ends above it, so Duet's close no longer sits under Safari's minimized bar, which takes touches from the visual viewport's bottom down. New `Context.visualBottom` (#140).
- Column mode without children: the controls no longer sit up to 18pt too high after a flick to the end of the page while Safari's toolbar grows back. The scroll timeline's range is now `scrollHeight - 100dvh`, which CSS keeps live through the toolbar change, instead of a value measured in JavaScript that went stale with no event to refresh it (#100).
- Call to action: `primary` takes `prominent: true` (new `DuetPrimary` type) to make it the page's call to action. Where there is room it is a tinted pill with icon and label by the thumb; in a closed Safari tab it keeps the thumb slot and the tabs (or search) fold into "…" as a radio group instead. Its label, icon and tint can change at runtime: the pill's width springs to the new label and the tint crossfades (#101). It starts closed, as the round tinted button; `expanded: true` opens it into the labelled pill on the same spring.
- `folded: true` on a `leading` or action item keeps it in "…" even where the strip has room, so a page can fold its secondary actions and change that at runtime (#101).
- Page transitions: controls that appear scale up out of a blur, controls that go away shrink into one (kept 450ms so they can), and the rest slide to their new places on the same spring. Reduced motion crossfades instead (#101).
- Site: a call to action example at `/book`, a class list and a class page with "Book · 2 credits" (#101).
- Column mode: a page opened from a link shared in Messages keeps Safari's column under the Shared with You bar ("From <name>", +40pt top chrome). Before, the controls fell into the page. `offsetTop` is 40 there and every control lands where it does without the bar (#112).
- Unfolding from the in-app preview no longer flashes the closed screen's strip or Safari's column on the open screen: signals are also re-read on each layout (`ResizeObserver` on a viewport-sized box), since WebKit holds `resize` back while the window animates, and a column-wide page in the full open window counts as in transit (#115).

## 0.4.1

- New `duet-ui/boot` export: `bootScript`, an inline script for the top of `<body>` that marks Safari's column on the closed Duo before the first paint (`data-duet-mode="column"`, `--duet-column`, `--duet-vh`, `--duet-inset-bottom` on `<html>`), so column styling no longer flashes the plain layout on load. Nothing is set on any other browser or device, and `useDuet()` takes it back if the mounted reading is not column. New `--duet-column` variable: the column's width, 0px outside column mode (#94).
- Column mode: the controls take taps while a page modal sets `pointer-events: none` on `<body>` (Radix, Headless UI), so the `close` passed for a sheet works (#94).
- A control that arrives while the window settles (the sheet's close as the keyboard goes down) no longer fades in a second time once settled (#94).
- Column mode without children: the in-document scroller keeps its width before the inset variables are set (#94).
- Column mode, closed tab with forward history and two Live Activities: Duet's buttons no longer hide under Safari's. The band holds one button there, so "…" and the selected tab (or search) share a two-item rail centred between Safari's buttons; where even that has no room (closed landscape), the selected tab alone holds a merged menu. An island menu wider than the screen opens as a morph. Safari's back + forward pill is 102.7pt tall (`SAFARI.forward`, was 2pt short) (#97).

## 0.4.0

Everything from 0.4.0-rc.1 and 0.4.0-rc.2.

- Column mode without children in a split view pane, or on the closed Duo turned left: Duet now places the page beside Safari's column (`margin-left` of the column width on `<html>`, marked `data-duet-reserve`), so the page is no longer clipped by 84px with the controls drawn over it. Don't set `margin` on `<html>` or reset `scrollX`. `<Duet reserve={false}>` opts out (#77).
- README: an Edge cases section lists every iOS and Safari quirk Duet handles, what it does and what is left to you (#81).
- Column mode: a page's full-screen `position: fixed` overlay (a modal scrim, `inset: 0`) no longer hides the controls in Safari's column, close button included. A small invisible fixed guard on the column's edge keeps Safari from filling the column with the overlay's colour. `<dialog>.showModal()` is not covered (#79).
- Column mode without children: the controls no longer ride the rubber band at the top or bottom of the page, where they slid over Safari's own column buttons or vanished until the bounce settled. The document no longer rubber-bands while the controls follow it, like a page with children. A page's own `overscroll-behavior` still wins.
- Turning or folding no longer flashes the controls at the wrong edge: while the window is caught halfway they hide (`hidden: "moving"`, `confidence: "moving"`) and reappear where the landed window wants them once it has held for 150ms (`LAND_HOLD`). The full screen in-app preview turned sideways (no page column, 75pt chrome, inset 34) is now recognised as the preview.
- In-app Safari preview: the controls now sit in the free gap of the preview's own column, between its reader and back buttons ("…" and the selected tab), so the page keeps its full width. Turned sideways, where that gap is too small, they hide (`useDuet().hidden` is `"preview"`) and the page keeps its full width. The preview sheet is now recognised turned too.
- Theming: `tint` (accent, like iOS's tintColor), `appearance` (`"auto"`, `"light"` or `"dark"`, replacing `dark`, which still works) and `icons` (`size`, `tabSize`, `weight`, `color`). Each writes a documented `--duet-*` token that plain CSS can set too.
- Your icons are now sized by context (22px in buttons and menus, 24px in tabs) and stroked at weight 2, like SF Symbols in a native bar. Set `icons` or the vars to change it. The chrome's own glyphs keep their sizes.
- `badgeTone: "neutral"` on an item: a grey badge for plain counts like a balance.
- Column mode: menus follow the page's appearance; the buttons keep following the system, like Safari's own.
- While hidden mid-turn or mid-unfold, the page keeps its last insets, so `--duet-inset-*` no longer jump (they reached 296px on a turn and -485px on an unfold).
- The preview is also recognised as a page sheet inside the closed screen (450x670 on a real Duo, 662x458 turned). The default and full styles turned sideways use the 84px strip inset; unfolded, the preview goes inline.

## 0.3.0

- New `useDuet().device` (`"duo"`, `"iphone"`, `"ipad"`, `"android"` or `"desktop"`) and `deviceOf()`.
- New `useDuet().standalone`: true when opened from the Home Screen as a web app.

## 0.2.5

- Column mode: a sideways swipe no longer pans the whole page, controls included, into Safari's column on the Duo's inner screen. Carousels and code blocks still scroll sideways.

## 0.2.4

- Docs only: the README now documents how the Duo is detected, how each mode is picked, column mode's reliance on WebKit behaviour, split view, server rendering and every prop.

## 0.2.3

- Island and morph menus open and close about 20% faster, and their items appear with half the stagger.

## 0.2.2

- `useDuet().duo` and `isDuo()` also require an iOS user agent (iPhone, iPod, or a Mac user agent with touch), so a desktop window at a Duo size no longer counts.
- Column mode only in Safari: Chrome, Firefox, Edge and in-app web views draw their own chrome there and get `inline`.
- New `useDuet().browser`, `browserOf()` and `isIOS()`.

## 0.2.1

- A Safari tab never takes `strip`: strip mode requires a Home Screen app.
- Column mode requires the Duo or split-view heuristic instead of the closed tab's height, and accepts a chrome height of 68 to 102px, so windowed Safari and compact split panes get the column.
- The oscillation guard only counts mode flips at the same window size, and doubles its pause only when the loop resumes right after it lifts.
- Every viewport meta is patched and kept patched.
- In column mode the page runs on under Safari's URL bar (`--duet-inset-bottom`).
- Tabs minimize in 0.24s and expand in 0.26s.

## 0.2.0

- `<DuoCookie>`: keep a `duet-duo` cookie in step with the browser, to choose a Duo layout on the server.
- `DuetTab<T>`: `as const` tab ids type `onSelect` without a cast.
- Each tab keeps its own scroll position; tapping the selected tab scrolls to the top.
- `viewport-fit=cover` is added when `<Duet>` mounts.

## 0.1.1

- Package metadata only, first publish through the release workflow. No library changes.

## 0.1.0

First release.

- Switching the inline controls to the other side moves every control in the same frame, and closes the menu at once, so "…" is never left hidden.
- The island opens and closes about 25% faster.
- Split view draws the controls in Safari's column on both sides, and remembers its own inline side (`useDuet().split`, `isSplit()`): no web API tells the left pane from the right, so moving the controls next to Safari's column once keeps them there, without moving them in full screen.
- The tab lens is a glass bubble about 1.2x the rail's width that pokes past both edges, and stretches along the rail while it travels, matched frame by frame to Apple News and Music.
- `<Duet>`: back, `leading`, `actions` (collapsing into "…", destructive last), `primary`, `tabs` with search, `searchButton`, `close`, `accessory`, `minimizeOnScroll`, island and morph menus, light and dark
- Modes picked from the window: `strip` (Home Screen app), `column` (Safari's empty column, in a closed tab or on both sides of a split-view pane), `inline` (unfolded, landscape, in-app preview), with a draggable, remembered side
- `useDuet().duo` and `isDuo()`: a screen and window size heuristic for the iPhone Duo, to show a Duo layout there
- Full-width layout: the page runs under the controls, `column()` and `bleed()` keep text clear, insets as CSS variables
- `<DuetPanes>`, `usePanes()` and `<DuetPaneBar>`: a path of screens that follows the fold, with a full-screen toggle
- Tab rail behaves like Apple News: a tap glides the lens to the new tab with the rail at rest; a hold (250ms) or drag swells the whole rail with labels, and the lens stays inside it
- Held, the rail grows for real (16pt wider, 12pt taller) so labels clear its round ends; letting go eases the rail and lens back together without overshoot
- Side drag needs a deliberate sideways swipe (24pt, mostly horizontal) and the magnet is stiffer: a 16pt dead zone, 10pt of give, released at 120pt
- Island and morph menus open about twice as fast with a springier stretch, and close in ~0.35s so the button is back sooner
- The top band assumes the worst-case Live Activity island, measured on device
- The inline side pin expires, and `primary` folds into "…" where the band holds only two buttons
