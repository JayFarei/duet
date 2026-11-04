# API

[Back to the README](../README.md)

Props, theming, the Primary, `useDuet()` and the lower-level exports.

## `<Duet>`

| Prop | Type | What it does |
| --- | --- | --- |
| `menu` | `{ items, selected, onSelect, burger?, tabs? }` | The app's places (`DuetMenuItem[]`), drawn as Navigation. By default the Sidebar button heads the Group and opens the places in a sidebar, sliding the page aside. Each place keeps its scroll position. `tabs: true` draws the largest fit: Tabs when all fit, Tabs + More when at least three fit, else the Sidebar button, see [Navigation fit](#navigation-fit) |
| `moveControls` | `boolean` | Default `false`: the controls stay on the default side, a side stored by an earlier visit is ignored, and More gets no "Move controls" row, so with nothing else to fold there is no More at all. `true` lists the row and allows the drag across the page where the controls can change edge (`canMoveControls`: inline, not a Home Screen strip) |
| `tabs` | `{ items, selected, onSelect }` | Destinations (`DuetMenuItem[]`), one always showing. They head the Group; the selected one sits in a bubble in `tint`, and a tap on another sends the bubble over and calls `onSelect`. Use `actions` for commands, which fire and leave nothing selected. |
| `actions` | `DuetItem[]` | Actions: icon buttons in the Group after the Navigation while they fit, the rest in More. `destructive: true` items only show in More, last, in red; `folded: true` items only in More |
| `primary` | `DuetPrimary` | The Primary, the page's main job, always on screen: a tinted button showing its icon, in a slot of the controls. It has its own Group under the others (at the thumb inline), or takes the Sidebar button's slot above More where that does not fit. A tap grows it into a confirm box whose button runs it, see [Primary](#primary). Folds into More only where one button is all that fits |
| `close` | `false \| { label?, onPress }` | Close: a sheet or card is open, so the controls shrink to a single X until it is cleared |
| `appearance` | `"auto" \| "light" \| "dark"` | Light or dark, like `overrideUserInterfaceStyle`. Default `"auto"`: follow the system. `dark` (boolean) still works but is deprecated |
| `tint` | `string` | Accent for the selected place, the Primary and checked rows in More, like iOS's `tintColor`. Default: system blue |
| `icons` | `{ size?, weight?, color? }` | How your icons are drawn. See [Theming](#theming) |
| `reserve` | `boolean` | Default `true`: the page keeps clear of the controls (`--duet-inset-*`, `<html>` margins). `false` lets it run under them |
| `children` | `ReactNode` | Page content, in an inner scroller so the document never scrolls and the controls stay still |

`DuetItem` is `{ id, label, icon, onPress?, badge?, badgeTone?, tint?, destructive?, folded? }`: `badge` is a number or short text in a badge, red by default; `badgeTone: "neutral"` makes it grey. `DuetMenuItem<T>` is `{ id: T, label, icon?, badge?, badgeTone? }`. `DuetPrimary` is a `DuetItem` plus `confirm?: string | false`: the confirmation box's button label (default `label`), or `false` to run on the first tap.

## The template

One template on every layout, the same in Safari's column, the strip, inline and split view: the Navigation first (Tabs, or the Sidebar button), then the Actions while they fit, then More (the "…" button), which closes the Group, and the Primary in its own Group. Where the band shrinks, Actions move into More one at a time; then the Primary takes the Sidebar button's slot above More, whose list ends with a "Places" section, and only where one button is all that fits does it fold into More itself. The in-app preview's gap holds one button, so it shows only More, whose list leads with an "Actions" section, then a "Places" section. More grows into its list on one interruptible spring, open and close; any tap outside closes it. The pure layout is exported (`template`, `allocate`, `frame`, `place`, `placeTabs`, `placesFit`, `menuBox`, `confirmBox`) for tests and custom chrome.

## Navigation fit

Pass `tabs: true` on `menu` and Duet draws the Navigation at the largest fit, shown on the controls as `data-duet-fit`:

- `tabs` (**Tabs**): every place is its own button at the head of the Group.
- `tabs-more` (**Tabs + More**): the first places stay tabs, at least three, and the rest fold into More.
- `sidebar` (**Sidebar**): fewer than three tabs would fit, so one Sidebar button slides the page aside to list every place.

Icons are required, and an item without one keeps the Sidebar button. Without `tabs: true` the fit is `sidebar`. Where the places sit in More alone (a band of one button, or the in-app preview), `data-duet-fit` is absent.

```tsx
<Duet menu={{ items, selected, onSelect, tabs: true }} actions={actions} primary={primary}>{page}</Duet>
```

- Put the primary places first: the order is yours, and tabs never reorder or swap on selection. 9 places on a wide Home Screen are 7 tabs and More holding the other 2.
- More lists only the folded places, under "Places", ahead of folded Actions and destructive items under "Actions". When the selected place is folded, More shows the selected bubble and the list marks the place. The set never splits between tabs and sidebar.
- The app's Actions and Primary fold into More first. The Sidebar button takes over only where fewer than three tabs would show, closed Safari and the right of Split View.
- Where the band holds one button (closed Safari turned, in Safari's column), a page with Actions shows only More, with the places first in its list. Without Actions it shows the Sidebar button.
- Tabs behave like the `tabs` prop: the selected one sits in a bubble in `tint`, with the same press.
- `placeTabs(context, places, rest)` is the rule, pure and exported, `rest` meaning something else needs More. It returns `{ shown, pitch }`, or undefined for the Sidebar button. `placesFit` is whether every place is shown. See [Navigation fit](how-duet-decides.md#navigation-fit) for the room each mode has.
- On the Duo, inline `bootScript`: the controls stay hidden until the chrome has mounted, so neither form shows before the right one, with no cookie or reload. See [Pre-paint boot](server-rendering.md#pre-paint-boot). On every device the nav stays hidden until hydration.
- Every button carries `data-duet-control`, the same in any arrangement, shared capsule or its own: `navigation` (a tab), `sidebar` (the Sidebar button), `more` ("…"), `actions` (an Action), `primary`, `close`. Tests and app styles key on it, never on `aria-label`, which changes with labels and translation: `nav.duet [data-duet-control="primary"]`.
- An open sidebar closes when tabs take over. The switch across rotation, Split View and folding goes through the usual hidden move.
- On an iPad, phone or desktop the same rule runs on the inline template: tabs when they fit the window's height, else the Sidebar button. An app that does not pass `tabs: true` is unchanged everywhere.

## Theming

Deliberately small, like iOS: an accent, an appearance and your icons. The glass itself stays native.

```tsx
<Duet appearance="auto" tint="#ff2d55" icons={{ size: 21, weight: 1.75 }} menu={...}>
```

- `tint` colours only what is active: the selected place, the checked row in More, the Primary. Everything else stays ink (black in light, white in dark).
- `appearance` sets the page theme. The More list and the sidebar follow it. In Safari's column the buttons keep following the system, so they match Safari's own; the More list opens over the page, so it keeps `appearance`.
- `icons` sizes and weighs your icons, the way the system sizes SF Symbols in a native bar: `size` (round buttons, Groups, the More list, default 22px), `weight` (stroke width of SVG line icons such as Lucide, default 2) and `color` (unselected icons, default ink). SVGs are resized directly; font icons take the size as `font-size`, so give them `font-size: 1em` or leave it unset. The chrome's own glyphs (Sidebar, Close, More) keep their native sizes.

Every prop writes a CSS custom property on `.duet`, so plain CSS can set the same tokens instead, globally or per appearance. These are stable:

| Token | What it is | Default |
| --- | --- | --- |
| `--duet-tint` | Accent: selected place, Primary | `#0088ff` |
| `--duet-ink` | Text and icon colour | black / white |
| `--duet-icon` | Unselected icon colour | `--duet-ink` |
| `--duet-icon-size` | Icons in round buttons, Groups and the More list | `22px` |
| `--duet-tab-icon-size` | Unused since 0.6 (no separate tab bar), kept so older CSS stays valid | `24px` |
| `--duet-icon-weight` | Stroke width of SVG line icons | `2` |
| `--duet-badge`, `--duet-badge-neutral`, `--duet-badge-ink` | Badge fills (alert, neutral) and text | red, grey, white |
| `--duet-solid` | Opaque surface: the More list in Safari's column, the badge ring | near white / near black |
| `--duet-frost`, `--duet-menu` | Glass veil of the controls and of the More list | sampled from iOS |
| `--duet-sel`, `--duet-lift` | Selection and press highlight | sampled from iOS |

```css
:root .duet { --duet-tint: #ff2d55; --duet-icon-size: 21px; }
:root[data-lg-theme="dark"] .duet { --duet-tint: #ff6482; }
```

## Primary

A page with one thing to do (book, buy, join) passes it as its Primary, and folds what else it offers:

```tsx
<Duet
  actions={[
    { id: "share", label: "Share", icon: <Share />, onPress: share, folded: true },
    { id: "fav", label: "Favourite", icon: <Heart />, onPress: fav },
  ]}
  primary={{ id: "book", label: "Book", confirm: `Book with ${credits} credits`, icon: <CalendarCheck />, onPress: book }}
/>
```

- The Primary is a tinted button in a slot of the controls, 49pt like every other, showing its icon. Its `label` is its accessible name and shows when it opens. Controls never leave the column, so nothing sits over the page at rest.
- A tap grows the button into a confirm box beside the column, on the same spring as More: the icon and `label`, then a tinted button reading `confirm` (or `label`). The button runs `onPress` and the box folds back into the button, which now shows whatever the page passes next (a green Booked check, say). A tap anywhere else closes the box. `confirm: false` runs on the first tap, with no box.
- Where its own Group does not fit (the closed column with places), it takes the Sidebar button's slot, above More in one Group, and the places move into the More list, in a "Places" section after the "Actions" one. With `menu.tabs` the section comes first. Where one button is all that fits, it folds into More.
- Folded into More (no room for its own Group), it arms the same way: the first tap tints its row and turns its label to `confirm`, the list stays open, the second tap runs it and closes the list. Closing the list disarms it. See [Folded primary runs at once](edge-cases.md#folded-primary-runs-at-once).
- `tint` on the Primary overrides the accent for it alone. Change `label`, `icon`, `tint` or `folded` at any time, from state like any prop.

Between pages the controls move like a native bar: a group that appears scales up out of a blur, one that goes away shrinks into one and is kept for 450ms so it can, and the rest slide to their new places on the same spring. With reduced motion, controls crossfade in place.

## `useDuet()`

Returns the current `Context`: `mode`, `side`, `duo`, `browser`, `layout` (`"wide"` when `innerWidth` is at least 600px, else `"narrow"`), `split`, `preview` and `keyboard` (when true), `hidden` (`"moving"`, `"preview"` or `"pending"` when the controls are not drawn), `confidence`, `width` and `height` (the page viewport), `stableHeight` (the smallest page height seen at this window width and orientation, like CSS `svh`: it does not grow when Safari's URL bar collapses), plus the screen size and insets the placement uses. It works outside `<Duet>`. Until hydration it returns the server snapshot, which describes the closed Duo, see [Server rendering](server-rendering.md).

## Lower-level exports

`isDuo`, `isIOS`, `isSplit`, `browserOf`, `detect`, `columnBand`, `magnet`, `panes`, `backFrom` and the measured constants (`DUO`, `INLINE_WIDTH`, `MAGNET`, `WIDE`) are exported for your own signals and tests, along with `isPreview`. The column template is exported too: `template`, `allocate`, `frame`, `place`, `menuBox`, `confirmBox`, `groupHeight`, `placeTabs`, `placesFit` and `TEMPLATE`. `duet-ui/geometry` exports the geometry module alone, without React.

`readSignals()` returns the current `Signals` from the window, the same reading the chrome uses (browser only). `watchSignals(cb)` calls `cb` whenever they may have changed, with the triggers and settle polling described in [Which mode](how-duet-decides.md#which-mode), and returns the unsubscribe. Together with `detect` they let a page act on the mode before React mounts:

```ts
import { readSignals, watchSignals, detect } from "duet-ui";
const off = watchSignals(() => { document.documentElement.dataset.mode = detect(readSignals()).mode; });
```
