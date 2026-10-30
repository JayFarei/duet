# API

[Back to the README](../README.md)

Props, theming, the call to action, `useDuet()` and the lower-level exports.

## `<Duet>`

| Prop | Type | What it does |
| --- | --- | --- |
| `menu` | `{ items, selected, onSelect }` | The app's places (`DuetMenuItem[]`). The burger heads the controls and opens them in a sidebar, sliding the page aside. Each place keeps its scroll position |
| `actions` | `DuetItem[]` | Round buttons under the burger while they fit, the rest in "…". `destructive: true` items only show in "…", last, in red; `folded: true` items only in "…" |
| `primary` | `DuetPrimary` | The screen's main action, always on screen: a tinted button showing its icon, in a slot of the controls. It has its own group under the others (at the thumb inline), or takes the burger's slot above "…" where that does not fit. A tap grows it into a confirmation box whose button runs it, see [Call to action](#call-to-action). Folds into "…" only where one button is all that fits |
| `close` | `false \| { label?, onPress }` | A sheet or card is open: the controls hold only a close button until it is cleared |
| `appearance` | `"auto" \| "light" \| "dark"` | Light or dark, like `overrideUserInterfaceStyle`. Default `"auto"`: follow the system. `dark` (boolean) still works but is deprecated |
| `tint` | `string` | Accent for the selected place, the primary button and checked menu rows, like iOS's `tintColor`. Default: system blue |
| `icons` | `{ size?, weight?, color? }` | How your icons are drawn. See [Theming](#theming) |
| `reserve` | `boolean` | Default `true`: the page keeps clear of the controls (`--duet-inset-*`, `<html>` margins). `false` lets it run under them |
| `children` | `ReactNode` | Page content, in an inner scroller so the document never scrolls and the controls stay still |

`DuetItem` is `{ id, label, icon, onPress?, badge?, badgeTone?, tint?, destructive?, folded? }`: `badge` is a number or short text in a badge, red by default; `badgeTone: "neutral"` makes it grey. `DuetMenuItem<T>` is `{ id: T, label, icon?, badge?, badgeTone? }`. `DuetPrimary` is a `DuetItem` plus `confirm?: string | false`: the confirmation box's button label (default `label`), or `false` to run on the first tap.

## The template

One template on every layout, the same in Safari's column, the strip, inline and split view: the burger first, then the actions while they fit, then "…", which closes the group, and the primary in its own group. Where the band shrinks, actions move into "…" one at a time; then the primary takes the burger's slot above "…", whose list ends with a "Menu" section (the places), and only where one button is all that fits does it fold into "…" itself. The in-app preview's gap holds one button, so it shows only "…", whose list leads with "This page", then a "Menu" section (the places). "…" grows into its list on one interruptible spring, open and close; any tap outside closes it. The pure layout is exported (`template`, `allocate`, `frame`, `place`, `menuBox`, `confirmBox`) for tests and custom chrome.

## Theming

Deliberately small, like iOS: an accent, an appearance and your icons. The glass itself stays native.

```tsx
<Duet appearance="auto" tint="#ff2d55" icons={{ size: 21, weight: 1.75 }} menu={...}>
```

- `tint` colours only what is active: the selected place, the checked menu item, the primary button. Everything else stays ink (black in light, white in dark).
- `appearance` sets the page theme. Menus follow it. In Safari's column the buttons keep following the system, so they match Safari's own; menus open over the page, so they keep `appearance`.
- `icons` sizes and weighs your icons, the way the system sizes SF Symbols in a native bar: `size` (round buttons, groups, menus, default 22px), `weight` (stroke width of SVG line icons such as Lucide, default 2) and `color` (unselected icons, default ink). SVGs are resized directly; font icons take the size as `font-size`, so give them `font-size: 1em` or leave it unset. The chrome's own glyphs (burger, close, "…") keep their native sizes.

Every prop writes a CSS custom property on `.duet`, so plain CSS can set the same tokens instead, globally or per appearance. These are stable:

| Token | What it is | Default |
| --- | --- | --- |
| `--duet-tint` | Accent: selected menu item, primary button | `#0088ff` |
| `--duet-ink` | Text and icon colour | black / white |
| `--duet-icon` | Unselected icon colour | `--duet-ink` |
| `--duet-icon-size` | Icons in round buttons, groups and menus | `22px` |
| `--duet-tab-icon-size` | Unused since 0.6 (no tab pill), kept so older CSS stays valid | `24px` |
| `--duet-icon-weight` | Stroke width of SVG line icons | `2` |
| `--duet-badge`, `--duet-badge-neutral`, `--duet-badge-ink` | Badge fills (alert, neutral) and text | red, grey, white |
| `--duet-solid` | Opaque surface: menus in Safari's column, the badge ring | near white / near black |
| `--duet-frost`, `--duet-menu` | Glass veil of controls and of menus | sampled from iOS |
| `--duet-sel`, `--duet-lift` | Selection and press highlight | sampled from iOS |

```css
:root .duet { --duet-tint: #ff2d55; --duet-icon-size: 21px; }
:root[data-lg-theme="dark"] .duet { --duet-tint: #ff6482; }
```

## Call to action

A page with one thing to do (book, buy, join) passes it as its primary, and folds what else it offers:

```tsx
<Duet
  actions={[
    { id: "share", label: "Share", icon: <Share />, onPress: share, folded: true },
    { id: "fav", label: "Favourite", icon: <Heart />, onPress: fav },
  ]}
  primary={{ id: "book", label: "Book", confirm: `Book with ${credits} credits`, icon: <CalendarCheck />, onPress: book }}
/>
```

- The primary is a tinted button in a slot of the controls, 49pt like every other, showing its icon. Its `label` is its accessible name and shows when it opens. Controls never leave the column, so nothing sits over the page at rest.
- A tap grows the button into a confirmation box beside the column, on the same spring as "…": the icon and `label`, then a tinted button reading `confirm` (or `label`). The button runs `onPress` and the box folds back into the button, which now shows whatever the page passes next (a green Booked check, say). A tap anywhere else closes the box. `confirm: false` runs on the first tap, with no box.
- Where its own group does not fit (the closed column with a menu), it takes the burger's slot, above "…" in one capsule, and the places move to the top of the "…" list. Where one button is all that fits, it folds into "…".
- Folded into "…" (no room for its own group), it arms the same way: the first tap tints its row and turns its label to `confirm`, the list stays open, the second tap runs it and closes the list. Closing the list disarms it. See [Folded primary runs at once](edge-cases.md#folded-primary-runs-at-once).
- `tint` on the primary overrides the accent for it alone. Change `label`, `icon`, `tint` or `folded` at any time, from state like any prop.

Between pages the controls move like a native bar: a group that appears scales up out of a blur, one that goes away shrinks into one and is kept for 450ms so it can, and the rest slide to their new places on the same spring. With reduced motion, controls crossfade in place.

## `useDuet()`

Returns the current `Context`: `mode`, `side`, `duo`, `browser`, `layout` (`"wide"` when `innerWidth` is at least 600px, else `"narrow"`), `split`, `preview` and `keyboard` (when true), `hidden` (`"moving"`, `"preview"` or `"pending"` when the controls are not drawn), `confidence`, `width` and `height` (the page viewport), `stableHeight` (the smallest page height seen at this window width and orientation, like CSS `svh`: it does not grow when Safari's URL bar collapses), plus the screen size and insets the placement uses. It works outside `<Duet>`.

## Lower-level exports

`isDuo`, `isIOS`, `isSplit`, `browserOf`, `detect`, `columnBand`, `magnet`, `panes`, `backFrom` and the measured constants (`DUO`, `INLINE_WIDTH`, `MAGNET`, `WIDE`) are exported for your own signals and tests, along with `isPreview`. The column template is exported too: `template`, `allocate`, `frame`, `place`, `menuBox`, `confirmBox`, `groupHeight` and `TEMPLATE`. `duet-ui/geometry` exports the geometry module alone, without React.

`readSignals()` returns the current `Signals` from the window, the same reading the chrome uses (browser only). `watchSignals(cb)` calls `cb` whenever they may have changed, with the triggers and settle polling described in [Which mode](how-duet-decides.md#which-mode), and returns the unsubscribe. Together with `detect` they let a page act on the mode before React mounts:

```ts
import { readSignals, watchSignals, detect } from "duet-ui";
const off = watchSignals(() => { document.documentElement.dataset.mode = detect(readSignals()).mode; });
```
