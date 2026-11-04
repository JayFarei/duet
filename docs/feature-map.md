# Feature map

Where each screen and control of the site lives, and how to reach it in a test. Update the entry when you change a screen. Names are the glossary: Group, Navigation (Tabs, Tabs + More, Sidebar), More, Actions, Primary, Close, Pane bar, and the modes Strip, Column, Inline.

Public pages: `/`, `/examples` (index), `/examples/inbox`, `/examples/checkout`, `/examples/reader`. The site suite is `playwright.site.config.ts` (`e2e/site/*.spec.ts`, WebKit and Chromium at 390x844 and 1440x900, port 3510); its shared names and probes are in `e2e/site/site.ts`.

## Nav (`apps/site/app/site-nav.tsx`)

| Part | Selector | What it does |
|---|---|---|
| Top bar | `header.nav` | Duet mark, links to How it works (`/#how`), Examples (`/#examples`) and Install (`/#install`), GitHub. Plain links off a Duo. On a Duo (`html[data-duet-mode]`) the links, GitHub and the theme toggle hide and the bar keeps the centred mark. |
| Duo controls | `apps/site/app/site-duet.tsx`, `[data-duet-control]` | Only when `isDuo(readSignals())`. Duet with no children: places are the sections (Try it, How it works, Examples, Install), following the section under the top third and scrolling to it on select; actions are GitHub and the theme. Off a Duo it renders nothing. |
| Theme toggle | `header.nav button[aria-label="Dark mode"]` (or `"Light mode"`) | Flips light and dark, stored in `localStorage` `duet-theme`. The simulator's screens follow. |

## Home page (`apps/site/app/home.tsx`)

One short page, four sections in order under an intro (`main > section[id]`): the simulator, how it works, the examples, install. No videos. The page scrolls the window.

| Part | Selector | What it does |
|---|---|---|
| Intro | `[data-testid="hero"]` | Title, lede, install line, copy prompt for coding agents, version and install stats. |
| Simulator | `#simulator`, `[data-testid="simulator"]` | The live 3D Duo (`Duo embed src="/skeleton"`) with the skeleton site in Safari and its own controls, as on prod: turns, fold and lock, then Device, Surface, Layout and System UI, then With or Without Duet. No presets. The device box keeps one height (`min(width × 0.85, 600, 62% of the window)`), so the controls under it hold still as the posture changes. It stops drawing off screen (`window.__duoFrames` stops). Without WebGL 2 it falls back to the flat WebDuo (`[data-testid="web-duo"]`). |
| How it works | `#how` | Four steps (`ol.how`): wrap your app, Duet measures, it draws what fits, it steps aside. Then the glossary `table.glossary`, one row per noun in glossary order. |
| Examples | `#examples article` | One card per example, led by a looping demo (`.exd[data-demo]`, `apps/site/app/ex-demo.tsx`, keyframes in `site.css` "Example demos") of what its controls do: inbox Tabs to Tabs + More to Sidebar, checkout Pay to Confirm to Paid, reader Pane bar Full screen and Close. Still under reduced motion. Open goes to `/examples/<name>`, Show code (`details.ex-src`) opens its one source file. |
| Install | `#install` | Install line, copy prompt, the usage code, links to the API reference, How Duet decides and GitHub. |

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
