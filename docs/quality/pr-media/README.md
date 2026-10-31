# PR evidence

Captured by `real-browser menu keyboard contract and review recording` in `e2e/quality.spec.ts`, Linux Playwright WebKit, 31 October 2026. These are browser consumer screenshots, **not physical Duo screenshots**.

- `mobile.png`: 390×844, sidebar open and Journey focused with End.
- `desktop.png`: 1280×800, sidebar open after viewport resize.
- `menu-keyboard.mp4`: Playwright recording of sidebar/pane/overflow keyboard focus and Escape, mobile → desktop. Transcoded to H.264 at width 640, CRF 32 without audio to keep review media small.

Full-size posture baselines are in `e2e/baselines/{webkit,chromium}/quality.spec.ts/`. CI uploads original Playwright videos, traces and failures for 14 days. The manual Duo Safari pass is pending hardware access.
