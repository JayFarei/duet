# Feature map

Where each screen and control of the site lives, and how to reach it in a test. Update the entry when you change a screen.

## Home page (`apps/site/app/home.tsx`, `apps/site/app/forms.tsx`)

On desktop the page scrolls inside `.duet-scroller`, not the window, and sections fade in on scroll. In Playwright, call `element.scrollIntoView()` and wait about 900ms before a screenshot.

| Part | Selector | What it does |
|---|---|---|
| Hero | `#top` | Title, lede, install line. |
| Stage | `.stage` | The live Duo running the skeleton app. Moments are driven by a `duet:moment` CustomEvent with detail `fit`, `fold`, `folded` or `burger`. |
| How it works | `#rules .steps` | Three tiles: your places, Duet measures the room, Duet draws the largest controls that fit. |
| Form cards | `#rules .rule` (3) | Every place is a tab (440pt), Tabs and More (350pt), A menu (150pt). Each draws a `Device` and has a `.rule-show` "Show on the Duo" button that fires its stage moment. |
| Rule notes | `.rule-notes` | Selection inside More, with a "Show on the Duo" link for `folded`. |
| Drag the room | `.room`, `#room` range (110 to 480pt) | Live fit model: `data-testid="room-value"` shows pt and taps, `data-testid="room-form"` the form name. Presets: Unfolded Safari 470, Closed Home Screen 350, Closed Safari upright 150. On phone the device sits right under the slider. |
| Integrate | `#code` | The code sample. |
| Where the controls go | `#examples` | Side controls, bottom bar, column. |

The fit model in `forms.tsx` (`fit(room)`): slots = floor((room - 24) / 40); 10 or more slots is all tabs, 4 to 9 is tabs and More, fewer is a menu. It is a simplified picture of duet-ui's fit, used only for the illustrations.

Tests: `e2e/home-forms.spec.ts`.
