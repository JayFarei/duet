# Duet

Native-feeling controls for React web apps on the foldable iPhone (the "iPhone Duo"). Your page and its control strip, playing together.

```sh
npm i duet-ui
```

| Strip | Column | Inline |
| --- | --- | --- |
| ![Strip: a Home Screen app with the island menu](docs/media/strip.webp) | ![Column: Safari's empty column holds the controls, morph menu](docs/media/column.webp) | ![Inline: unfolded, the strip drags to either side](docs/media/inline-drag.webp) |

Recorded on the iPhone Duo simulator, framed by [`tools/media`](tools/media).

## What it does

On the closed Duo, iOS puts navigation in a vertical strip at the screen's edge, not a bottom tab bar. A Home Screen web app gets that strip as a safe-area inset. In a Safari tab, Safari owns the strip for its own buttons and leaves part of it empty. A web page that ignores this ends up with its own bar fighting Safari's, or its buttons under the camera.

`<Duet>` draws your back button, actions, primary action, tabs, search and accessory where a native app would, picks one of three layouts (`strip`, `column`, `inline`) from the window geometry, keeps every control inside the space it may use, and folds what does not fit into a "…" menu. `<DuetPanes>` shows one screen of a path when the page is narrow and two side by side when it is wide. `useDuet()` tells your own code what Duet decided, including whether this looks like an iPhone Duo.

Everything is inferred from web signals (window and screen sizes, safe-area insets, display mode, user agent). iOS gives a web page no API for the device model, the fold, Safari's buttons or the Dynamic Island, so detection is a heuristic built from measurements, and column mode relies on WebKit behaviour that is not a supported API. See [Limitations](#limitations).

## Requirements

- React and React DOM 18.3 or newer (peer dependencies).
- A bundler that handles CSS imported from a package (Next.js, Vite): the components import their own stylesheet. It is also exported as `duet-ui/styles.css`.
- Duet's components and hooks are client components (`"use client"` in the Next.js App Router).
- The type definitions use `NoInfer`, so TypeScript 5.4 or newer.

## Quick start

```tsx
"use client";
import { useState } from "react";
import { House, Link, Search } from "lucide-react";
import { Duet, column, type DuetTab } from "duet-ui";

const TABS = [
  { id: "home", label: "Home", icon: <House size={24} /> },
  { id: "search", label: "Search", icon: <Search size={24} /> },
] as const satisfies readonly DuetTab[];

type Tab = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <Duet
      tabs={{ items: TABS, selected: tab, onSelect: setTab }}
      actions={[{ id: "copy", label: "Copy link", icon: <Link size={22} />, onPress: () => navigator.clipboard.writeText(location.href) }]}
      minimizeOnScroll
    >
      <main style={column(680)}>
        <h1>{tab === "home" ? "Home" : "Search"}</h1>
      </main>
    </Duet>
  );
}
```

Icons are yours, from any library (this example uses `lucide-react`): 24pt in tabs and 21 to 22pt on round buttons match the system. `as const` types the tab ids, so `onSelect` takes `setTab` without a cast. Each tab keeps its own scroll position, and tapping the selected tab scrolls back to the top. Pass the page as `children`: it then scrolls in an inner scroller, which keeps the controls still during momentum scroll. Without `children` the document scrolls and the controls follow it (see [Column mode](#column-mode-how-it-works)).

On phones and browsers that are not an iPhone Duo in Safari or a Home Screen app, the same code renders the `inline` layout, so you may want to render `<Duet>` only where `useDuet().duo` is true (see [Server rendering](#server-rendering-and-hydration)).

## How Duet decides

### Is this an iPhone Duo?

`useDuet().duo` (and `isDuo(signals)`) is a heuristic. It is true when both hold:

1. The screen size (`screen.width` x `screen.height`) or the window size (`outerWidth` x `outerHeight`) matches, within 1px and in either orientation, one of the sizes measured on the Duo: 466x678 (closed screen; Safari keeps reporting it as `screen.*` after unfolding), 669x951 (open screen) or 469x669 (a Safari split-view pane).
2. The user agent says iOS: it contains `iPhone` or `iPod`, or it contains `Macintosh` and `navigator.maxTouchPoints` is greater than 1 (Safari's "Request Desktop Website"). Signals without a user agent, such as ones you build yourself for `isDuo()`, skip this check.

Possible false positives: an iPad (which also sends a Mac user agent with touch) or another iOS device whose screen or window happens to match one of these sizes. Possible false negatives: anything that changes the reported sizes, such as a different display zoom setting, a future iOS release, or a window size that was not measured. Use it to switch to a Duo layout, not as proof of the device.

### Which mode

Duet re-reads the signals on resize, orientation change (including `screen.orientation` change: turning from one landscape to the other keeps the window size), visual viewport resize, `pageshow` and `visibilitychange` (so a page handed from the in-app preview to a Safari tab re-reads). The window size and insets settle late (after a fold `outerWidth` can land up to ~2s after the viewport, with no event), so after each event Duet polls every 100ms until the sizes hold for 500ms, re-reading on every change, for at most 2s. It picks the first mode that matches:

| Order | Mode | Conditions (all must hold) | Controls |
| --- | --- | --- | --- |
| 1 | `strip` | Running as a Home Screen app (`navigator.standalone` or `display-mode: standalone`) on a Duo (`duo` true), and the left or right safe-area inset is at least 76px (the Duo's strip is 84; an iPhone's landscape sensor inset is 59, an Android cutout 62). The right side wins if both are. Also the in-app Safari preview turned sideways in its default or full style (below): closed screen, 678x466 window, an 84px safe-area inset on the turned side. | In the strip iOS gives the app, beside the page (in the preview, in the inset below its top bar) |
| 2 | `column` | Not a Home Screen app; not inside an iframe; not the in-app Safari preview turned sideways (below); the browser is Safari (below); `outerWidth - innerWidth` is 80 to 88px; `outerHeight - innerHeight` is 68 to 102px; portrait (`innerHeight > innerWidth`), or landscape in a window the size of the closed screen (678x466 within 1px) with `screen.orientation.angle` 90 or 270; the page is not zoomed (`visualViewport.scale` 1); the oscillation guard has not paused column mode; and either the window is a split-view pane (`outerWidth` x `outerHeight` 469x669 within 1px, iOS user agent) or `duo` is true | Painted into the part of Safari's column (or the in-app preview's) its own buttons leave empty, so the page keeps its full width |
| 3 | `inline` | Everything else: unfolded at full width, landscape of unknown turn, other browsers, in-app web views, the in-app Safari preview unfolded, other phones, desktops | An 84px strip inside the page, on the side the user picks |

"Safari" means the user agent has `Version/x Safari/` and none of the tokens of other iOS browsers and apps (`CriOS`, `FxiOS`, `EdgiOS`, `OPiOS`, `GSA/`, `Ddg/`); an in-app web view drops the `Safari/` token. `useDuet().browser` reports the result: `"safari"`, `"chrome"`, `"firefox"`, `"edge"`, `"webview"` or `"other"`. Other browsers draw their own chrome where Safari has its column, so they always get `inline`.

There is no fold signal. The mode follows the geometry: folding or unfolding changes the window size, and the mode follows on the next read.

How a new reading is committed:

- **Keyboard.** The keyboard does not change the mode. `useDuet().keyboard` is true while the visual viewport is shorter than the page, and `<Duet>` sets `data-keyboard`; in `column` mode the controls hide until it closes (it covers the lower column).
- **Zoom.** While the page is zoomed (`visualViewport.scale` not 1, for example Safari zooming out when an input takes focus) the window signature is unreadable, so Duet keeps the last context.
- **Drift.** While the window is still settling, a mode change at the same window size, page width and turn is held until the sizes stop moving; a change of window size, page width or turn commits at once.
- **Loops.** A mode that flips twice in 2s at a stable window is pinned for 3s, doubling on each repeat up to 60s.
- `useDuet().confidence` says how the context was reached: `"sure"` (settled signals), `"settling"` (the window is still moving) `"held"` (the last context, kept through zoom or drift) or `"moving"` (a turn or fold caught halfway, controls hidden).

### Column mode: how it works

Column mode infers from the window geometry that Safari's column is there; it never sees Safari's buttons. The 80 to 88px width difference is Safari's column (84px measured), the height difference is Safari's chrome below the page.

- `position: fixed` content is clipped to the page viewport, but WebKit paints in-document content that overflows the layout viewport into Safari's column. Duet renders the controls in an absolute layer at the top of the document, widens the document by the column's width, keeps the document itself from scrolling (the page scrolls in the inner scroller) and sets `touch-action: pan-y` on `<html>` so the page does not pan sideways. This is observed WebKit behaviour, not a supported API.
- Without `children` the document itself scrolls, and the layer follows it on a CSS scroll timeline (`animation-timeline: scroll(root)`). Safari runs the timeline with the scroll, so the controls hold through momentum and through smooth programmatic scrolls (`scrollIntoView({ behavior: "smooth" })`, `scrollTo({ behavior: "smooth" })`): you need no scroll listener and no `behavior: "auto"` workaround. Measured on the simulator: within 1px through flings and at rest, and one frame of up to 7pt at the end of a smooth scroll (a transform set on scroll ran up to 300pt off there). The keyframe ends at `scrollHeight - innerHeight`, Safari's own timeline range, which follows its URL bar as it collapses. Without scroll-timeline support, or when a page reset like `* { animation: none !important }` removes it, Duet falls back to a transform set on scroll, which lags in momentum. Children mode stays the steadier choice.
- The widened document can pan sideways when a swipe runs off the end of a horizontal scroller (a chip row), since `touch-action` stops at that scroller. Duet pins `scrollX` (0, or the column width when the document spans a left column) on every scroll and sets `overscroll-behavior-x: contain` on all elements at zero specificity (`:where()`), so your own value wins.
- Touches in the column reach the page but are not hit-tested to Duet's buttons, and Safari usually keeps the touch end. Duet listens for `pointerdown`, finds the button under the touch's coordinates and clicks it, so a column button fires on touch down.
- Placement comes from constants measured on the iPhone Duo simulator (iOS 27.1) and checked on a device: Safari's back and reader rows at the top of the column, its +/tabs pill at the bottom. A Safari update that moves its buttons or changes this painting behaviour needs new measurements.

### Split view

A Safari split-view pane (469x669 window, 385x571 page) has Safari's column on the pane's outer edge, but no web signal says whether the pane is on the left or the right. In column mode Duet widens the document by a column on each side and draws the controls in both; each pane only shows its own column, and a tap there tells Duet which side it was. When a split pane falls back to `inline`, its side is remembered separately from the full-window side, so the user can move the controls next to Safari's column once. `useDuet().split` is true in a split pane.

### Side

`useDuet().side` is the edge the controls are on. It is only detected in `strip` mode (from which safe-area inset is large). In `column` mode it is Safari's column on the closed Duo: `"right"` in portrait; turned sideways, the side the camera is on, `"left"` at angle 90 (turned anticlockwise) and `"right"` at 270. A left column widens the document on the left and keeps it scrolled across, as in split view. In a split pane it is nominal, since both edges are drawn. In `inline` mode it is the user's choice: drag the controls across the middle of the page, or use "Move controls" in "…". The choice is stored in `localStorage` per site (`duet-side`, or `duet-side-split` in split view). Without one, it is `"right"`. In the in-app preview turned sideways (`strip`) it is the side of the safe-area inset: `"left"` at angle 90, `"right"` at 270.

### In-app preview

Links opened from social and mail apps can open in the in-app Safari preview (`SFSafariViewController`). On the closed Duo the preview has a column like a Safari tab's, holding its own buttons: close and reader/menu at the top, back and a share/reload/Safari pill below. In portrait Duet uses `column` and puts its controls into the free gap between the reader/menu button and the back button (146pt, screen y 282 to 428, the same in the sheet and full screen on the simulator and a real Duo), so the page keeps its full width. The gap holds two buttons: "…" and the selected tab (the tab pill minimized); everything else folds into "…". Turned sideways, the preview's layout depends on its style. The sheet keeps a column on the side the Duo is turned to, with a gap of about 26pt, too small for a button: there Duet hides its controls (`useDuet().hidden` is `"preview"`, the controls get `visibility: hidden` and no inset) instead of drawing an inline strip across the page, so the page keeps its full width and the preview's own close, back, share and "Open in Safari" stay usable. The default and full styles move every native button into a top bar (window y 24 to 68) and give the page an 84px safe-area inset on the turned side (left at 90, right at 270) that nothing draws in: Duet uses `strip` there, its controls in that inset from below the top bar to above the home indicator, and the page keeps its width. Turning back to portrait, or opening the page in Safari, brings the column back. A strip across page content was flagged in review and is never used. Duet sets `useDuet().preview` in both. The gap was measured with a bare Dynamic Island; how Live Activities move the preview's buttons is not yet known. Duet takes a Safari window that is not standalone to be the preview when it is either:

- the closed screen's 466x678 window with the column signature, at most 77px of chrome below the page (the preview has 75, a Safari tab 98, or 80 with the compact URL bar) and a bottom safe-area inset (34 in the preview, 0 in a tab), or
- a page sheet: a window inside the closed 466x678 screen, in either orientation (450x670 on a real Duo, 662x458 turned) with the column signature and a bottom safe-area inset, or
- exactly 375x667 at `devicePixelRatio` 3, the size earlier builds gave the preview.

No Safari tab on the Duo is smaller than the screen (a split pane is 469 wide, the screen 466), and iOS has no windowed Safari or Stage Manager, so a window inside the screen is the sheet.

The verdict is sticky: a page that loaded as a tab stays a tab while its page height and insets move (scrolling collapses the URL bar to 80px of chrome), and is only re-decided when the window size, page width, turn, standalone or framing changes, or on `pageshow` or when the page becomes visible again. In a window's first second the verdict may still rise to preview, since the sheet's inset reads 0 on the first sample and 34 about 100ms later. A preview that stops matching becomes a tab at once.

While the Duo turns or folds, the window passes through sizes no landed window has (inner and outer orientations disagree, or the chrome around the page is not Safari's). Duet keeps the last placement and hides the controls (`hidden` is `"moving"`) until the window lands and holds there for 150ms, so nothing flashes at the wrong edge mid-turn, not even the closed portrait window an unfold from landscape passes through for a frame or two.

Unfolded, the preview is a sheet centred on the open screen (653x661 wide, 653x869 tall) with its bars above and below the page and no column: Duet reads it as the preview (`preview` true) and goes `inline` on the user's side, as in full width Safari. Limits: When "Open in Safari" hands the page to a tab, the `pageshow`/`visibilitychange` re-read switches to `column`. The [/probe page](https://getduet.dev/probe) logs every signal the rule reads, every 100ms. Measurements are in [docs/research-notes.md](docs/research-notes.md).

### Oscillation guard

Column mode can feed back into the signals (for example if Safari zooms the page out to fit the wider document, the column signature disappears, `inline` removes the overflow, and the signature returns). If the mode changes 3 times within 2 seconds while the outer window size stays the same, Duet pauses column mode for 3 seconds, then tries again. If the loop resumes as soon as the pause lifts, the next pause doubles. A change of window size resets the guard, and changes while the window is still settling after an event (the 2s polling above, as during a fold) are not counted: they are the transition, not a loop.

### Viewport meta

Duet appends `shrink-to-fit=no` to every `<meta name="viewport">` when `duet-ui` is imported, and `viewport-fit=cover` when `<Duet>` mounts, and keeps both on metas the framework adds or rewrites later. If there is no viewport meta it adds `width=device-width,initial-scale=1` first. It only appends a key that is absent: an existing `viewport-fit` or `shrink-to-fit` value is left as it is. Safe-area insets only reach the page with `viewport-fit=cover`, so with `viewport-fit=contain` `strip` mode cannot be detected. Without `shrink-to-fit=no`, Safari zooms a split pane out to fit the widened document.

### Claimable space

Each mode has a band the controls may use, and Duet keeps every control inside it, so you never position anything yourself:

- **Above:** the status bar and Dynamic Island, and in Safari its own back and reader buttons at the top of the column. Live Activities grow the island down the strip and push Safari's buttons with it, and a page can't tell, so the band always assumes the worst case measured on device (two activities). That space stays empty even when none are running. A split-view pane on the right sits under the same status column, so it gets the same band as a closed tab, while the left pane uses the full column.
- **Below:** Safari's +/tabs pill, or the bottom edge.
- **Closed landscape:** Safari moves its back and reader rows and its pill on each side (left column: back slot top 81.5pt, pill top 327pt; right column: 23.5pt and 279pt), and Duet takes the gap between. Measured with a bare island; how Live Activities grow it sideways is not yet known.
- **What does not fit folds into "…"**, in this order: actions, then `leading`, then back. Tabs shrink to the selected one first. "…" always gets a slot: where the band holds only two buttons (a closed Safari tab), `primary` folds too, as the menu's first item.
- **The free middle of Safari's column:** before `leading` or `primary` fold, they may rise into the space the island only takes with Live Activities (up to 91.7pt above the band, in a closed portrait tab and the right split pane), and the stack packs down onto the tabs so it rises as little as it can. Back, actions and "…" never do. With no activity running the item sits clear of Safari's reader button; with two activities the reader can cover part of it.
- **Safari's column buttons are an exclusion zone for menus too.** Native chrome always paints over the page, so z-index can't help. A menu that reaches into the column keeps its top at or below `columnTop` (the reader button's worst-case bottom plus 11pt) and its bottom above Safari's pill, opening flush with the column like Safari's own menus. A morph list too tall for that band opens wholly over the page, beside the column, where it may rise to the top of the page. One too tall even there caps its height and scrolls inside. `plan()` returns `columnTop` and `columnBottom` in `column` mode, and Duet sets `--duet-safe-top-column` on `<html>` for your own popovers (0 outside `column` mode).

## Server rendering and hydration

The server can't measure anything, so on the server and during hydration `useDuet()` returns a fixed snapshot: `mode: "column"`, `duo: true`, `browser: "safari"`, `layout: "narrow"`, `side: "right"` (a closed Safari tab). The real values arrive right after hydration. So `useDuet().duo` is `true` in the server HTML on every device: a page that renders a Duo layout or a desktop layout from it switches once after hydration on non-Duo devices.

To choose the layout on the server, `<DuoCookie>` keeps a `duet-duo` cookie (`"1"` on a Duo) in step with the browser. Read the cookie on the server, render from it, and pass what you rendered as `rendered`. After hydration, if the browser's answer differs, `<DuoCookie>` updates the cookie and calls `onChange` (default: `location.reload()`), so a new device switches layout once. It renders nothing and works outside `<Duet>`. In the Next.js App Router:

```tsx
// app/page.tsx, a server component. DuoApp and DesktopApp are your own components.
import { cookies } from "next/headers";
import { DuoCookie } from "duet-ui";

export default async function Page() {
  const duo = (await cookies()).get("duet-duo")?.value === "1";
  return (
    <>
      <DuoCookie rendered={duo} />
      {duo ? <DuoApp /> : <DesktopApp />}
    </>
  );
}
```

Pass `onChange={() => router.refresh()}` from a client component to re-render without a reload.

## Props

### `<Duet>`

| Prop | Type | What it does |
| --- | --- | --- |
| `back` | `false \| { label?, onPress }` | Back button at the top of the strip |
| `leading` | `DuetItem[]` | Its own group under back, like SwiftUI `.topBarLeading` |
| `actions` | `DuetItem[]` | Like `.primaryAction`; folds into "…" when it would reach the tabs. Items with `destructive: true` only show in "…", last, in red |
| `primary` | `DuetItem` | The screen's main action (compose, new), a tinted round button. Narrow: just above the tabs. Wide: under back. Folds into "…" last |
| `tabs` | `{ items, selected, onSelect, search? }` | Tab pill at the bottom. `search` is a `DuetTab` added as the last tab. Each tab keeps its scroll position |
| `searchButton` | `() => void` | A round search button at the bottom, when there are no tabs |
| `close` | `false \| { label?, onPress }` | A sheet or card is open: the strip holds only a close button, where back goes, until it is cleared |
| `accessory` | `ReactNode` | A view docked by the tabs, like `.tabViewBottomAccessory` (a mini player) |
| `minimizeOnScroll` | `boolean` | Scrolling down shrinks the tabs to the selected one, like `.tabBarMinimizeBehavior(.onScrollDown)`. Follows the inner scroller and any pane |
| `menuStyle` | `"island" \| "morph"` | How "…" and the minimized tab open their menu. Default `"island"` |
| `appearance` | `"auto" \| "light" \| "dark"` | Light or dark, like `overrideUserInterfaceStyle`. Default `"auto"`: follow the system. `dark` (boolean) still works but is deprecated |
| `tint` | `string` | Accent for the selected tab, the active menu item and the primary button, like iOS's `tintColor`. Default: system blue |
| `icons` | `{ size?, tabSize?, weight?, color? }` | How your icons are drawn. See [Theming](#theming) |
| `children` | `ReactNode` | Page content, in an inner scroller so the document never scrolls and the controls stay still |

`DuetItem` is `{ id, label, icon, onPress?, badge?, badgeTone?, tint?, destructive? }`: `badge` is a number or short text in a badge, red by default; `badgeTone: "neutral"` makes it grey, for plain counts like a balance. `tint` overrides the strip's tint for that tab or primary button. `DuetTab<T>` is a `DuetItem` whose `id` is `T`.

### Theming

Deliberately small, like iOS: an accent, an appearance and your icons. The glass itself stays native.

```tsx
<Duet appearance="auto" tint="#ff2d55" icons={{ size: 21, tabSize: 24, weight: 1.75 }} tabs={...}>
```

- `tint` colours only what is active: the selected tab, the checked menu item, the primary button. Everything else stays ink (black in light, white in dark).
- `appearance` sets the page theme. Menus follow it. In Safari's column the buttons keep following the system, so they match Safari's own; menus open over the page, so they keep `appearance`.
- `icons` sizes and weighs your icons, the way the system sizes SF Symbols in a native bar: `size` (round buttons, groups, menus, default 22px), `tabSize` (tab pill, default 24px), `weight` (stroke width of SVG line icons such as Lucide, default 2) and `color` (unselected icons, default ink). SVGs are resized directly; font icons take the size as `font-size`, so give them `font-size: 1em` or leave it unset. The chrome's own glyphs (back, close, "…", search) keep their native sizes.

Every prop writes a CSS custom property on `.duet`, so plain CSS can set the same tokens instead, globally or per appearance. These are stable:

| Token | What it is | Default |
| --- | --- | --- |
| `--duet-tint` | Accent: selected tab, active menu item, primary button | `#0088ff` |
| `--duet-ink` | Text and icon colour | black / white |
| `--duet-icon` | Unselected icon colour | `--duet-ink` |
| `--duet-icon-size` | Icons in round buttons, groups and menus | `22px` |
| `--duet-tab-icon-size` | Icons in the tab pill | `24px` |
| `--duet-icon-weight` | Stroke width of SVG line icons | `2` |
| `--duet-badge`, `--duet-badge-neutral`, `--duet-badge-ink` | Badge fills (alert, neutral) and text | red, grey, white |
| `--duet-solid` | Opaque surface: menus in Safari's column, the badge ring | near white / near black |
| `--duet-frost`, `--duet-menu` | Glass veil of controls and of menus | sampled from iOS |
| `--duet-sel`, `--duet-lift` | Selection and press highlight | sampled from iOS |

```css
:root .duet { --duet-tint: #ff2d55; --duet-icon-size: 21px; }
:root[data-lg-theme="dark"] .duet { --duet-tint: #ff6482; }
```

### Menu styles

- `"island"` (default): the button stretches sideways into a pill of icons, like the Dynamic Island. Best when the icons speak for themselves.
- `"morph"`: the button grows into a labelled list, like a context menu. Best when items need their names.

Both are live on the [site](https://getduet.dev): scroll until the tabs shrink, tap the button, and switch styles in the Menus card.

### `useDuet()`

Returns the current `Context`: `mode`, `side`, `duo`, `browser`, `layout` (`"wide"` when `innerWidth` is at least 600px, else `"narrow"`), `split`, `preview` and `keyboard` (when true), `hidden` (`"moving"` or `"preview"` when the controls are not drawn), `confidence`, `width` and `height` (the page viewport), `stableHeight` (the smallest page height seen at this window width and orientation, like CSS `svh`: it does not grow when Safari's URL bar collapses), plus the screen size and insets the placement uses. It works outside `<Duet>`.

### Lower-level exports

`isDuo`, `isIOS`, `isSplit`, `browserOf`, `detect`, `plan`, `columnBand`, `morphBox`, `islandBox`, `magnet`, `panes`, `backFrom` and the measured constants (`DUO`, `INLINE_WIDTH`, `MAGNET`, `WIDE`) are exported for your own signals and tests, along with `isPreview`. `duet-ui/geometry` exports the geometry module alone, without React.

`readSignals()` returns the current `Signals` from the window, the same reading the chrome uses (browser only). `watchSignals(cb)` calls `cb` whenever they may have changed, with the triggers and settle polling described in [Which mode](#which-mode), and returns the unsubscribe. Together with `detect` they let a page act on the mode before React mounts:

```ts
import { readSignals, watchSignals, detect } from "duet-ui";
const off = watchSignals(() => { document.documentElement.dataset.mode = detect(readSignals()).mode; });
```

## Laying out content

The page spans the whole window and the controls float over it, so backgrounds run on under them and the layout is asymmetric, like a native app. Only text and buttons keep clear.

- `column(maxWidth, pad)`: a centred reading column. It centres on the whole window and moves aside from the controls only as far as it must. The `duet-column` class does the same in CSS (`--duet-max`, `--duet-pad`).
- `bleed(pad)`: a full-width band (hero, sticky bar, list row). The band runs under the controls, its content is padded back beside them. `bleed(false)` runs content itself edge to edge (a map, an image). The `duet-bleed` class does the same in CSS.

Duet sets the insets on `<html>` as `--duet-inset-left`, `--duet-inset-right` (the controls' width on their edge; in `column` mode without children the page does not run under a right-hand column, so that inset is 0), `--duet-inset-top` (28px in `strip` mode, for iOS's top blur in Home Screen apps, else 0) and `--duet-inset-bottom` (in `column` mode, Safari's chrome below the page: the page runs on under Safari's floating URL bar, and the scroller ends with that much space so the last content scrolls clear) and `--duet-safe-top-column` (in `column` mode, the top of the part of Safari's column clear of its back and reader buttons: keep popovers that cross the column below it). `--duet-vh` is `stableHeight` in px: size full-screen sections with `min-height: var(--duet-vh, 100svh)` so they keep their height while the URL bar collapses and expands. Inside `<DuetPanes>` each pane gets its own left and right insets: only a pane on the controls' edge is inset. `<html data-duet-mode>` holds the current mode for CSS.

## Panes

Apps with a path of screens (mailboxes, inbox, message) follow the fold with `<DuetPanes>`: when `layout` is `"narrow"` one pane shows, when it is `"wide"` the focused pane and the one before it show side by side. Going deeper slides the pair along the path instead of opening a modal. Every pane stays mounted (off-screen panes are inert), so drafts and scroll positions survive the fold.

```tsx
"use client";
import { Duet, DuetPaneBar, DuetPanes, usePanes } from "duet-ui";

const PATH = ["mailboxes", "inbox", "message"];

export function Mail() {
  const nav = usePanes(PATH);
  return (
    <Duet back={nav.back}>
      <DuetPanes path={PATH} at={nav.at} expanded={nav.expanded} panes={{
        mailboxes: <button onClick={() => nav.go("inbox")}>Inbox</button>,
        inbox: <button onClick={() => nav.go("message")}>First message</button>,
        message: (
          <article>
            <DuetPaneBar onClose={nav.close} onToggle={nav.toggle} expanded={nav.expanded} />
            <p>Hello from the message pane.</p>
          </article>
        ),
      }} />
    </Duet>
  );
}
```

- `<DuetPanes path at expanded? panes>`: `panes` maps each id in `path` to its content. `expanded` gives the focused pane the whole window.
- `usePanes(path, initial?)` returns `at`, `go(id)` (focus a pane, leaving full screen), `layout`, `expanded`, `toggle()` (full screen on and off), `close` (focus the previous pane, `undefined` at the root) and `back`, ready for `<Duet back>`: it leaves full screen first, then steps back along the path, and is `false` when that would change nothing on screen.
- `<DuetPaneBar onClose? onToggle? expanded? more?>` is the pane's header pill: close, a full-screen toggle (only when `layout` is `"wide"`) and "…" with the pane's own `DuetItem`s, destructive ones last. It renders nothing when it has no buttons.

Try it on the [site](https://getduet.dev/panes).

## Limitations

- **Duo detection is a heuristic** from screen and window sizes plus the user agent (see above). It can misfire on devices with matching sizes and miss a Duo whose reported sizes differ.
- **Column mode depends on unsupported WebKit behaviour** (painting in-document content outside the layout viewport) and on measured positions of Safari's buttons. A Safari or iOS update can break or shift it. Duet falls back to `inline` whenever any column check fails, but it cannot detect a Safari layout that still passes the checks while its buttons moved.
- **Column taps are routed by coordinates** on `pointerdown`: they fire on touch down and show no native press state.
- **Live Activities and the Dynamic Island are invisible to the page**, so the top band always reserves the worst case, which leaves empty space when no activity runs.
- **Split-view panes can't tell their side**: column mode draws both edges, inline mode relies on the user's choice.
- **Server rendering** starts from a fixed Duo snapshot (see [Server rendering](#server-rendering-and-hydration)).
- Other iOS browsers, in-app web views, iframes, landscape other than the closed Safari tab and the open screen at full width all get `inline`.
- Measured on the iPhone Duo simulator (iOS 27.1) and checked on a device in October 2026.

## Examples

| App | Shows | Run |
| --- | --- | --- |
| [Almanac](examples/almanac) | Reading app on `<DuetPanes>`: the list beside the story unfolded, a pane bar, tabs with search, morph menus, sticky title with `bleed` | `pnpm --filter @duet/example-almanac dev`, port 3101 |
| [Encore](examples/encore) | Music player: badges, mini player `accessory`, island menus, carousels with `bleed` | `pnpm --filter @duet/example-encore dev`, port 3103 |
| [Meridian](examples/meridian) | Transit map on Vite: `leading`, a full-screen map with `bleed(false)` | `pnpm --filter @duet/example-meridian dev`, port 3102 |

`pnpm dev` from the root builds the library and starts the site and every example.

## Repo

| Path | What |
| --- | --- |
| [`packages/duet-ui`](packages/duet-ui) | The library ([changelog](packages/duet-ui/CHANGELOG.md)) |
| [`apps/site`](apps/site) | Docs site at [getduet.dev](https://getduet.dev). On a desktop it runs itself inside a web Duo you can fold, rotate and scrub through the fold (with ¼ speed), sending the page emulated signals through `postMessage` |
| [`examples`](examples) | Example apps |
| [`tools/simulator`](tools/simulator) | Driving the iPhone Duo simulator |
| [`tools/media`](tools/media) | Framing simulator recordings for docs |
| [`e2e`](e2e) | Playwright tests |
| [`docs`](docs) | [Releasing](docs/releasing.md), and the dated [research notes](docs/research-notes.md) behind column mode |

```sh
pnpm install
pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e
```

## License

MIT. Not affiliated with Apple.
