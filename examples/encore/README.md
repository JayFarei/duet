# Encore

Encore is a music player in the style of Apple Music, built on Duet. It has Home, New, Radio, Library and Search places in the menu, album pages, and a mini player that stays docked at the bottom of the page. Album art is drawn in code, every artist and album is invented, and the app picks up a single pinkish red accent and follows the system light or dark setting. Tapping a track starts a quiet WebAudio pad, so you can hear that something is playing. It also installs to the Home Screen as a standalone app with safe areas respected.

Duet features used:

- `menu` with five places, a `badge` on New that clears once you open it, and `tint` for the accent
- a Back action first in `actions` on album pages, with the scroller reset whenever the place or album changes
- `actions` (Add, Favourite, Download, Share) that collapse into "…" when space runs out, alongside the inline side-switch entry
- a sticky in-page mini player (artwork, title, play/pause, skip) docked above the bottom inset, since 0.6 has no accessory bar
- `bleed()` on the Home feature band, the album header, the carousels and the sticky search bar, so they run under the strip while their content stays clear of it
- The inner `.duet-scroller` and `--duet-inset-top` for Home Screen top padding

## Run

```sh
pnpm --filter @duet/example-encore dev
```

Then open http://localhost:3103. To build for production, run `pnpm --filter @duet/example-encore build`.
