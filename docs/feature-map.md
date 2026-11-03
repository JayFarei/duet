# Feature map

Where each screen and control of the site lives, and how to reach it in a test. Update the entry when you change a screen.

## Home page (`apps/site/app/home.tsx`)

Three parts: the hero with the live Duo, how it works (principles, where the controls go, how big they are), then docs and examples.

On desktop the page scrolls inside `.duet-scroller`, not the window, and sections fade in on scroll. In Playwright, call `element.scrollIntoView()` and wait about 900ms before a screenshot.

| Part | Selector | What it does |
|---|---|---|
| Hero | `#top` | Title, lede, copy prompt, install line, stats. |
| Stage | `.stage` | The live 3D Duo running the skeleton app. Moments are driven by a `duet:moment` CustomEvent with detail `fit`, `fold`, `folded` or `burger`. |
| How it works | `#rules .steps` | Three tiles: your places, Duet measures the room, Duet draws the largest controls that fit. |
| Where the controls go | `#rules .tiles` (first) | Strip, Column, Inline: Duo simulator recordings from `tools/media/compose.sh`. |
| How big they are | `#rules .rule` (3) | Every place is a tab, Tabs and More, A menu. Each shows `/media/form-{tabs,more,menu}.webp`, a still of the stage's 3D Duo, and a `.rule-show` button that plays `fit`, `folded` or `burger` on the stage. |
| Rule notes | `.rule-notes` | Selection inside More, the order of More's list, `moveControls`. |
| Docs and examples | `#docs` | Code sample with tint picker, links to the README and the panes, sheets and call to action examples. |

The form stills come from `node tools/media/duo3d-stills.mjs [port]` against a local `pnpm start`. Rerun it when the stage, the skeleton app or duet-ui's controls change.

Tests: `e2e/home-forms.spec.ts`.
