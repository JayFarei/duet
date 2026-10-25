# Changelog

## 0.1.0

First release.

- Switching the inline controls to the other side moves every control in the same frame, and closes the menu at once, so "…" is never left hidden.
- The island opens and closes about 25% faster.
- `<Duet>`: back, `leading`, `actions` (collapsing into "…", destructive last), `primary`, `tabs` with search, `searchButton`, `close`, `accessory`, `minimizeOnScroll`, island and morph menus, light and dark
- Modes picked from the window: `strip` (Home Screen app), `column` (Safari's empty column), `inline` (unfolded, split view, landscape, in-app preview), with a draggable, remembered side
- `useDuet().duo` and `isDuo()`: true only on an iPhone Duo, to show a Duo layout there and nowhere else
- Full-width layout: the page runs under the controls, `column()` and `bleed()` keep text clear, insets as CSS variables
- `<DuetPanes>`, `usePanes()` and `<DuetPaneBar>`: a path of screens that follows the fold, with a full-screen toggle
- Tab rail behaves like Apple News: a tap glides the lens to the new tab with the rail at rest; a hold (250ms) or drag swells the whole rail with labels, and the lens stays inside it
- Held, the rail grows for real (16pt wider, 12pt taller) so labels clear its round ends; letting go eases the rail and lens back together without overshoot
- Side drag needs a deliberate sideways swipe (24pt, mostly horizontal) and the magnet is stiffer: a 16pt dead zone, 10pt of give, released at 120pt
- Island and morph menus open about twice as fast with a springier stretch, and close in ~0.35s so the button is back sooner
