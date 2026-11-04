# Feature map

Where each screen and control of the site lives, and how to reach it in a test. Update the entry when you change a screen. Names are the glossary: Group, Navigation (Tabs, Tabs + More, Sidebar), More, Actions, Primary, Close, Pane bar, and the modes Strip, Column, Inline.

Public pages: `/`, `/components`, `/examples` (index), `/examples/inbox`, `/examples/checkout`, `/examples/reader`. The site suite is `playwright.site.config.ts` (`e2e/site/*.spec.ts`, WebKit and Chromium at 390x844 and 1440x900, port 3510); its shared names and probes are in `e2e/site/site.ts`.

## Nav (`apps/site/app/site-nav.tsx`)

| Part | Selector | What it does |
|---|---|---|
| Top bar | `header.nav` | Duet mark, links to Components, Examples and Docs (`/#docs`), GitHub. Plain links, no Duet controls. |
| Theme toggle | `header.nav button[aria-label="Dark mode"]` (or `"Light mode"`) | Flips light and dark, stored in `localStorage` `duet-theme`. Every loop then loads its `-dark` or `-light` file and the stage's screens follow. |

## Home page (`apps/site/app/home.tsx`, `tour.tsx`)

Four parts: the hero with the live stage and its tour, the examples, our apps, then the docs. The page scrolls the window.

| Part | Selector | What it does |
|---|---|---|
| Hero | `[data-testid="hero"]` | Title, lede, copy prompt for coding agents, install line, install stats. |
| Stage | `[data-testid="tour-stage"]` | The live 3D Duo (`Duo` with `idle`), sticky while the tour scrolls under it. It sways slowly while idle (`window.__duoYaw`), stops drawing off screen (`window.__duoFrames` stops), and takes no touches until the reader unlocks it, so a swipe over it scrolls the page; the lock button resets the view. `data-ready` is set once a screen has sent its first measure. Without WebGL 2 it falls back to the flat WebDuo (`[data-testid="web-duo"]`). |
| Tour | `#tour`, steps `#tour-<slug>` | Seven steps, each puts the stage in a scene (page, posture, Safari or Home Screen, an optional press). Ticks `[data-testid="tour-tick"]` jump to a step and mark the current one with `aria-current="step"`. Caption `[data-testid="tour-caption"]`. Counters `[data-testid="tour-free"]` and `[data-testid="tour-fit"]` show the free space and the fit the stage's screens measure (`duet:measure` events). |
| Examples | `#examples .cards` (first) | Inbox, Checkout, Reader: each card plays its `example-<name>` loop and links to `/examples/<name>`. |
| In real apps | `#examples .cards` (second) | RegTail (badge "Demo data"), Dashboard and Wealth (badge "Mock data") in `.card-k`: loops `app-{regtail,dashboard,wealth}` recorded from each app's local mock server only. |
| Docs | `#docs` | Install, usage code with a tint picker, Modes (Strip, Column, Inline, each a `mode-<name>` loop), then links to `/components` and the API reference. |

The tour steps, in order (`STEPS` in `tour.tsx`, `TOUR` in `e2e/site/site.ts`):

| # | Caption | Anchor | Stage | What it shows |
|---|---|---|---|---|
| 1 | Places | `#tour-places` | Inbox, open, Safari | Nine folders, all of them Tabs on the open Duo (fit `tabs`). |
| 2 | Free space | `#tour-free-space` | Inbox, closed, Home Screen | The column gets short; the free space counter drops. |
| 3 | Navigation | `#tour-navigation` | Inbox, closed, Home Screen | Some folders stay Tabs, the rest wait in More (fit `tabs-more`). |
| 4 | More | `#tour-more` | Inbox, closed, Home Screen, More pressed | More opens its list: Places, then Actions. Leaving the step closes it. |
| 5 | Actions + Sidebar | `#tour-actions` | Inbox, closed, Safari | The folders move into the Sidebar, Compose, Archive and Flag stay as Actions (fit `sidebar`). |
| 6 | Primary | `#tour-primary` | Checkout, open, Safari, Primary pressed | Pay grows into its confirm box. |
| 7 | Close, Modes | `#tour-close` | Inbox, closed, Safari, a row pressed | A message opens and the controls shrink to Close only. Leaving the step presses Close. |

## `/components` (`apps/site/app/components/components.tsx`)

One page, one section per noun in glossary order: Group, Navigation, More, Actions, Primary, Close, Pane bar. Sidebar `[data-testid="components-nav"]`, sections `section#<id>` with an `h2` each.

| Part | Selector | What it does |
|---|---|---|
| Preview and Code | `.cmp-bar [role="tablist"]` | Preview plays the variant's recorded loop with a free space counter (`.loop-count`, read from the clip's `.cues.json` against the video time) and a cue line (`.cmp-cue`). Code shows the props that produce it. |
| Variants | `[data-testid="variant-navigation"]`, `[data-testid="variant-primary"]` | Navigation: Tabs, Tabs + More, Sidebar. Primary: Confirm, Direct, Folded. Each picks its own clip. |
| Props | `table.props` | The props of that noun. |
| See it live | `.cmp-live` | Jumps to the noun's tour step on `/`, or to `/examples/reader` for the Pane bar. |

No live stage here: every preview is a recorded loop, so the page has no WebGL context.

## Examples (`apps/site/app/examples/`)

`/examples` lists the three. Each example is one source file (`<name>/app.tsx`) wrapped in `block.tsx`. `?plain` renders the app alone: the stage's screens load that, and so does "Open in new tab".

| Part | Selector | What it does |
|---|---|---|
| Posture | `[data-testid="posture"]` (768px and wider) | Closed, Open, Laptop, Sideways: drives the live 3D Duo running the app. Sideways is the closed device turned, a band one button long. |
| Preview and Code | `.ex-bar [role="tablist"]` | The live stage, or the source file. Below 768px Preview plays the `example-<name>` loop instead of the stage. |
| Open in new tab | `.ex-open` | `/examples/<name>?plain`, the app with Duet running on its own. |
| Other examples | `.ex-more` | The other two examples' loops, linking to them. |

| Example | Nouns it exercises |
|---|---|
| `/examples/inbox` | Navigation in all three fits (Closed gives `sidebar`, Open gives `tabs`), Actions, More, and Close over an opened message (`[data-testid="inbox-row"]`). |
| `/examples/checkout` | Pay as a Primary with a confirm box. Sideways folds the Primary into More: the first press arms it, the second pays. Remove waits in More as a destructive Action. |
| `/examples/reader` | Two panes with the Pane bar (Close, Full screen), and Next book as a Direct Primary. |

## Recorder mode (`/duo3d?clip=<name>`)

`apps/site/app/duo3d/clips.ts` lists every clip: its page, posture, presses and length. `/duo3d?clip=<name>&theme=<light|dark>&chrome=0` plays that clip once on the 3D Duo with nothing else on the page. With `&mark=<loopback url>` it posts its start, its end and each measure of what Duet drew, which the recorder uses to trim and to write the cues. App clips (`app-*`) carry an `upstream` mock server.

## Media pipeline (`tools/media/`)

Every loop on the site is `apps/site/public/media/clip/<name>-<light|dark>.{mp4,webp,cues.json}`, for each name in `clips.ts`. The order is record, then build, then start:

1. Start the site from a build on 3511, then `node tools/media/record.mjs [clip ...]` (root script `pnpm media`). It plays each clip at `/duo3d?clip=<name>` in Safari on two Duo Lab e2e clone sims, light and dark at once, records with `simctl io recordVideo`, trims to the marks, and `tools/media/compose.sh clip` crops, loops and encodes it with a poster and cues into `.tmp/media/clip`. `--encode-only` reruns only the encoding from `.tmp/media/raw`.
2. Review every frame, stop the 3511 server, copy `.tmp/media/clip` into `apps/site/public/media/clip` while no `next start` runs from that build, then rebuild.
3. `pnpm --filter @duet/site check:media` (`tools/media/check-media.mjs`) starts the build on 3519 and checks that every page's media answers 200 with the right type and that every clip on the list is on disk in both themes. `build:site` runs it after `next build`.

The `app-*` clips serve each app and the site under one loopback origin (ports 3513 to 3518), so the Duo's screens accept the app. They need each app running locally on fake data only: RegTail's demo server (port 8795), the Dashboard with `DASHBOARD_PREVIEW=1`, a synthetic `MONITORING_DB` and a preload that blocks the network (port 3591), and the Wealth backend on a synthetic database (port 8292). The recorder skips an app that does not answer. Never point them at real data.

## Harness routes

`/lab`, `/mockup`, `/workbench`, `/scroll`, `/probe`, `/column`, `/panes`, `/book`, `/sheet` and `/api/*` stay for the Duo e2e suites and tools (`HARNESS` in `e2e/site/site.ts`), and no public page links them (`e2e/site/gone.spec.ts`).
