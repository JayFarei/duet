# Feature map

Where each screen and control of the site lives, and how to reach it in a test. Update the entry when you change a screen.

## Home page (`apps/site/app/home.tsx`)

Three parts: the hero with the live Duo, how it works (principles, where the controls go, how big they are), then docs and examples.

On desktop the page scrolls inside `.duet-scroller`, not the window, and sections fade in on scroll. In Playwright, call `element.scrollIntoView()` and wait about 900ms before a screenshot.

| Part | Selector | What it does |
|---|---|---|
| Hero | `#top` | Title, lede, copy prompt, install line, stats. |
| Stage | `.stage` | The live 3D Duo running the skeleton app. Moments are driven by a `duet:moment` CustomEvent with detail `fit`, `fold`, `folded` or `burger`. A `duet:example` CustomEvent with detail `{src, moment}` loads that page on the Duo at that moment. |
| How it works | `#rules .steps` | Three tiles: your places, Duet measures the room, Duet draws the largest controls that fit (chips: Tabs, “…”, Menu). |
| Where the controls go | `#rules .tiles` (first) | Strip, Column, Inline: Duo simulator recordings from `tools/media/compose.sh`. |
| The controls | `#rules .control` (6) | Tabs, “…”, Menu, Buttons, Main button, Close, credited by name. Each shows a 3D Duo still (`/media/form-{tabs,more,menu}.webp`, `/media/control-{menu,main,close}.webp`), a `.rule-show` button that plays it on the stage (`duet:moment`, or `duet:example` for `/book` and `/sheet`), and a `.rule-link` to the docs. |
| Docs | `#docs` | Code sample with tint picker, then examples, then what's included, then "Read the docs". |
| Examples | `#docs .example` (3) | Mail (panes), Notes (sheets), Classes (main button). Each shows `/media/example-{panes,sheet,book}.webp`, a "Play on the Duo" button that fires `duet:example`, and an "Open" link to the page. |
| Also included | `#docs .lib-item` (4) | One linked card each: Panes, useDuet, Colors, Server rendering. |

The form, control and example stills come from `node tools/media/duo3d-stills.mjs [port]` against a local `pnpm start`. The `control-*` stills tap the page inside the Duo first (open the menu, the confirm box, a sheet). Rerun it when the stage, the skeleton app, the example pages or duet-ui's controls change.

The example pages (`/panes`, `/sheet`, `/book`) render `<Duo src>`, so they show the 3D Duo when WebGL 2 is available.

Tests: `e2e/home-forms.spec.ts`.
