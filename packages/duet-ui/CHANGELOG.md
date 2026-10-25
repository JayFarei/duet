# Changelog

## 0.1.0

First release.

- `<Duet>`: back, `leading`, `actions` (collapsing into "…", destructive last), `primary`, `tabs` with search, `searchButton`, `close`, `accessory`, `minimizeOnScroll`, island and morph menus, light and dark
- Modes picked from the window: `strip` (Home Screen app), `column` (Safari's empty column), `inline` (unfolded, split view, landscape, in-app preview), with a draggable, remembered side
- `useDuet().duo` and `isDuo()`: true only on an iPhone Duo, to show a Duo layout there and nowhere else
- Full-width layout: the page runs under the controls, `column()` and `bleed()` keep text clear, insets as CSS variables
- `<DuetPanes>`, `usePanes()` and `<DuetPaneBar>`: a path of screens that follows the fold, with a full-screen toggle
