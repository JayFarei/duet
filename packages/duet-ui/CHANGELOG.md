# Changelog

## 0.4.0-rc.1

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
