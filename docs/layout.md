# Layout and panes

[Back to the README](../README.md)

Keeping content clear of the controls, and showing one or two screens of a path.

## Laying out content

The page spans the whole window and the controls float over it, so backgrounds run on under them and the layout is asymmetric, like a native app. Only text and buttons keep clear.

- `column(maxWidth, pad)`: a centred reading column. It centres on the whole window and moves aside from the controls only as far as it must. The `duet-column` class does the same in CSS (`--duet-max`, `--duet-pad`).
- `bleed(pad)`: a full-width band (hero, sticky bar, list row). The band runs under the controls, its content is padded back beside them. `bleed(false)` runs content itself edge to edge (a map, an image). The `duet-bleed` class does the same in CSS.

Duet sets the insets on `<html>` as `--duet-inset-left`, `--duet-inset-right` (the controls' width on their edge; 0 in `column` mode without children, see below), `--duet-inset-top` (28px in `strip` mode, for iOS's top blur in Home Screen apps, else 0) and `--duet-inset-bottom` (in `column` mode, Safari's chrome below the page: the page runs on under Safari's floating URL bar, and the scroller ends with that much space so the last content scrolls clear) and `--duet-safe-top-column` (in `column` mode, the top of the part of Safari's column clear of its back and reader buttons: keep popovers that cross the column below it). `--duet-vh` is `stableHeight` in px: size full-screen sections with `min-height: var(--duet-vh, 100svh)` so they keep their height while the URL bar collapses and expands. Inside `<DuetPanes>` each pane gets its own left and right insets: only a pane on the controls' edge is inset. `<html data-duet-mode>` holds the current mode for CSS.

### Column mode without children: Duet places the page

In `column` mode the controls sit in Safari's column, outside the layout viewport, so a page has nothing to keep clear of. Without `children` Duet places the page itself, so any page, including one that never calls `column()` or `bleed()`, starts just clear of the controls, keeps centred content centred in the space left and is never clipped:

- The insets are 0 and the page's layout viewport is exactly the part of the window beside Safari's column.
- Where the document spans a left column (split view, the closed Duo turned to 90), Duet keeps it scrolled across and gives `<html>` `margin-left` of the column width and the matching negative `margin-right`, so the page lands in the visible part of the window instead of under the column. `<html data-duet-reserve>` marks this. Do not set `margin` on `<html>` yourself, and do not reset `scrollX`: Duet owns it.
- `<Duet reserve={false}>` opts out: the page runs under the column as before, and `--duet-inset-left` / `--duet-inset-right` hold the column's width for `column()`, `bleed()` or your own padding.

With `children`, in `inline` and `strip` mode and in the emulated column, the page still runs under the controls and keeps clear through the insets above.

## Panes

Apps with a path of screens (mailboxes, inbox, message) follow the fold with `<DuetPanes>`: when `layout` is `"narrow"` one pane shows, when it is `"wide"` the focused pane and the one before it show side by side. Going deeper slides the pair along the path instead of opening a modal. Every pane stays mounted (off-screen panes are inert), so drafts and scroll positions survive the fold.

```tsx
"use client";
import { ArrowLeft } from "lucide-react";
import { Duet, DuetPaneBar, DuetPanes, usePanes } from "duet-ui";

const PATH = ["mailboxes", "inbox", "message"];

export function Mail() {
  const nav = usePanes(PATH);
  return (
    <Duet actions={nav.back ? [{ id: "back", label: "Back", icon: <ArrowLeft size={22} />, onPress: nav.back.onPress }] : []}>
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
- `usePanes(path, initial?)` returns `at`, `go(id)` (focus a pane, leaving full screen), `layout`, `expanded`, `toggle()` (full screen on and off), `close` (focus the previous pane, `undefined` at the root) and `back` (`{ onPress }`, or `false`), for a Back action of your own: it leaves full screen first, then steps back along the path, and is `false` when that would change nothing on screen.
- `<DuetPaneBar onClose? onToggle? expanded? more?>` is the pane's header pill: close, a full-screen toggle (only when `layout` is `"wide"`) and "…" with the pane's own `DuetItem`s, destructive ones last. It renders nothing when it has no buttons.

Try it on the [site](https://getduet.dev/panes).
