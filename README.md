# Duet

Native-feeling controls for React web apps on the foldable iPhone (the "iPhone Duo"). Your page and its control strip, playing together.

```sh
npm i duet-ui
```

| Strip | Column | Inline |
| --- | --- | --- |
| ![Strip: a Home Screen app with the burger menu](docs/media/strip.webp) | ![Column: Safari's empty column holds the controls, burger and "…"](docs/media/column.webp) | ![Inline: unfolded, the strip drags to either side](docs/media/inline-drag.webp) |

Recorded on the iPhone Duo simulator, framed by [`tools/media`](tools/media).

## What it does

On the closed Duo, iOS puts navigation in a vertical strip at the screen's edge, not a bottom tab bar. A Home Screen web app gets that strip as a safe-area inset. In a Safari tab, Safari owns the strip for its own buttons and leaves part of it empty. A web page that ignores this ends up with its own bar fighting Safari's, or its buttons under the camera.

`<Duet>` draws your menu (a burger opening a sidebar), actions and primary action where a native app would, picks one of three layouts (`strip`, `column`, `inline`) from the window geometry, keeps every control inside the space it may use, and folds what does not fit into a "…" menu. `<DuetPanes>` shows one screen of a path when the page is narrow and two side by side when it is wide. `useDuet()` tells your own code what Duet decided, including whether this looks like an iPhone Duo.

Everything is inferred from web signals (window and screen sizes, safe-area insets, display mode, user agent). iOS gives a web page no API for the device model, the fold, Safari's buttons or the Dynamic Island, so detection is a heuristic built from measurements, and column mode relies on WebKit behaviour that is not a supported API. See [Limitations](docs/how-duet-decides.md#limitations).

## Requirements

- React and React DOM 18.3 or newer (peer dependencies).
- A bundler that handles CSS imported from a package (Next.js, Vite): the components import their own stylesheet. It is also exported as `duet-ui/styles.css`.
- Duet's components and hooks are client components (`"use client"` in the Next.js App Router).
- The type definitions use `NoInfer`, so TypeScript 5.4 or newer.

## Quick start

```tsx
"use client";
import { useState } from "react";
import { House, Link, Plus, Search } from "lucide-react";
import { Duet, column, type DuetMenuItem } from "duet-ui";

const PLACES = [
  { id: "home", label: "Home", icon: <House size={22} /> },
  { id: "search", label: "Search", icon: <Search size={22} /> },
] as const satisfies readonly DuetMenuItem[];

type Place = (typeof PLACES)[number]["id"];

export function App() {
  const [place, setPlace] = useState<Place>("home");
  return (
    <Duet
      menu={{ items: PLACES, selected: place, onSelect: setPlace }}
      actions={[{ id: "copy", label: "Copy link", icon: <Link size={22} />, onPress: () => navigator.clipboard.writeText(location.href) }]}
      primary={{ id: "new", label: "New note", icon: <Plus size={22} />, onPress: create }}
    >
      <main style={column(680)}>
        <h1>{place === "home" ? "Home" : "Search"}</h1>
      </main>
    </Duet>
  );
}
```

Icons are yours, from any library (this example uses `lucide-react`): 21 to 22pt on round buttons match the system. `as const` types the menu ids, so `onSelect` takes `setPlace` without a cast. Each place keeps its own scroll position. `menu={{ ..., burger: false }}` drops the burger and lists the places in "…" under "Menu". Pass the page as `children`: it then scrolls in an inner scroller, which keeps the controls still during momentum scroll and lets the burger slide it aside. Without `children` the document scrolls and the controls follow it (see [Column mode](docs/how-duet-decides.md#column-mode-how-it-works)).

On phones and browsers that are not an iPhone Duo in Safari or a Home Screen app, the same code renders the `inline` layout, so you may want to render `<Duet>` only where `useDuet().duo` is true (see [Server rendering](docs/server-rendering.md#server-rendering-and-hydration)).

## Go further

| You want to | Read |
| --- | --- |
| See every prop, theme it, add a call to action, or read `useDuet()` | [API](docs/api.md) |
| Keep content clear of the controls, or show two panes when unfolded | [Layout and panes](docs/layout.md) |
| Render on the server without a flash, or use the pre-paint boot | [Server rendering](docs/server-rendering.md) |
| Add a sheet or modal in column mode | [Modals and sheets](docs/how-duet-decides.md#modals-and-sheets-in-column-mode) |
| Understand which layout you get and why | [How Duet decides](docs/how-duet-decides.md) |
| Know what Duet cannot guarantee | [Limitations](docs/how-duet-decides.md#limitations) |
| Debug something odd on a device | [Edge cases](docs/edge-cases.md) |
| Avoid integration footguns | [Quality integration guide](docs/QUALITY-INTEGRATION.md) |
| Review quality coverage and limitations | [Quality audit](docs/QUALITY-AUDIT.md) and [Duo matrix](docs/DUO-TEST-MATRIX.md) |
| Contribute a reliable change | [Quality checklist](CONTRIBUTING.md) |

## Examples

| App | Shows | Run |
| --- | --- | --- |
| [Almanac](examples/almanac) | Reading app on `<DuetPanes>`: the list beside the story unfolded, a pane bar, a menu of places, sticky title with `bleed` | `pnpm --filter @duet/example-almanac dev`, port 3101 |
| [Encore](examples/encore) | Music player: badges, an in-page docked mini player, carousels with `bleed` | `pnpm --filter @duet/example-encore dev`, port 3103 |
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
