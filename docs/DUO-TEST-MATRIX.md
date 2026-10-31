# Duo test matrix

The source of automated cases is `e2e/postures.ts`. Run both WebKit and Chromium through the existing `playwright.config.ts`. `e2e/quality.spec.ts` uses a same-origin parent/iframe and the library's existing `duet:signals` preview protocol. The fixtures are deterministic inputs, **not a Safari browser UI emulator**. Fixture typography uses a bundled 13 KiB SIL OFL Arimo Latin subset, with normalized input/focus styles, so Debian/Ubuntu system-font differences cannot invalidate image comparisons. Production component typography remains unchanged. CI pins Ubuntu 24.04. Coordinates come from existing measured geometry fixtures and the supplied diagnoses; unknown Live Activity and hinge behaviour remains a device check.

| Case | Page / window CSS px | Expected behaviour | Automated evidence |
| --- | --- | --- | --- |
| Folded portrait, URL bar expanded | 382×580 / 466×678 | column; actions fit between native rows | behaviour + screenshot |
| Folded landscape, left and right turns | 594×368 / 678×466, angles 90/270 | column on corresponding edge; overflow reachable | behaviour + screenshot each |
| Unfolded landscape | 951×543 / 951×669 | inline, wide panes | behaviour + screenshot |
| Unfolded tall, both turns | 669×825 / 669×951, angles 0/180 | inline; retained draft | behaviour + screenshot each |
| Split view | 385×571 / 469×669 | column; both possible edge copies | behaviour + screenshot; pane navigation tests |
| URL bar collapsed | 382×598 / 466×678 | column remains; stable page height | behaviour + screenshot + transition |
| Shared with You banner | 382×540 / 466×678 | column without native overlap | behaviour + screenshot |
| Keyboard visible | visual height 272, page 382×580 | layout retained; column controls hidden | behaviour + screenshot + transition |
| Home Screen / safe area | 382×657 / 466×678, right inset 84 | strip; clear Island budget | behaviour + screenshot |
| Ordinary iPhone | 390×740 / 390×844, safe top 47/bottom 34 | inline fallback | behaviour + screenshot |
| Desktop | 1280×800 | inline fallback | behaviour + screenshot |
| Fold/turn in one page | folded → open → both tall → both landscape → folded → collapsed bar → keyboard → folded | mounted draft survives, mode follows signals | behaviour + Playwright video |
| Hinge / crease | open wide vertical midline; tall horizontal midline | controls do not straddle centre; no draft reset during fold | geometry assertion + transition; hardware crease check below |
| Document scrolling | scrolled >300px in folded column | sidebar opens within visible page, including active item | regression behaviour |
| Navigation | active and different item; narrow/wide panes; back; fullscreen | callbacks fire, drafts persist, destructive actions last | role tests + panes e2e |
| Focus | sidebar, overflow menu, pane menu | first item focused; arrows/Home/End; Escape return; Tab exits | Vitest + real browser |
| SSR | no window/document globals, then hydrate | deterministic server tree; no hydration errors | node render + browser pageerror assertion |

## Manual real-device pass (required for interactive/layout changes)

Record tester, date, device, iOS and Safari build. Repeat navigation and focus checks in each posture, in both directions. Test with long content at the top, middle and bottom, and with the menu already open before changing posture.

1. Folded portrait → unfolded landscape → unfolded tall, both turns → folded landscape, both turns → portrait. Pause at intermediate hinge angles and fold slowly/quickly. Check no hit target sits on an unusable crease, and no icons blink, move under native UI or become untappable. The browser exposes no dependable physical hinge exclusion region here; do not invent one from viewport width.
2. Safari URL bar expanded and collapsed, tab switch/back-forward cache restore, forward history, Shared with You banner and in-app Safari preview → Open in Safari. Check first paint and scroll restoration.
3. Dynamic Island bare, recording, music/timer and simultaneous Live Activities; check both landscape directions. Existing budgets deliberately reserve worst measured growth; unknown activity sizes must be recorded.
4. Keyboard up/down via input focus, Next/Done, programmatic blur, fold/rotate with keyboard visible, and laptop posture. Confirm draft/caret remain, page stays reachable, and controls return when keyboard dismisses.
5. Split view left and right panes, resize divider, swap sides, exit split view, and repeat a long smooth jump with sideways scroll restored. Check left/right controls and page reservations.
6. Open menu after scrolling; tap current item and a different item. Tap outside, press Escape on an external keyboard, Tab/Shift+Tab out, swipe along the strip, then deliberately drag across the centre. A drag must not invoke an action.
7. Check rings, shadows and press swell at the outer column edge; toolbar tint, rubber-banding, overscroll and smooth navigation. Desktop WebKit cannot certify Safari overflow painting or momentum timing.
8. VoiceOver: labels, order, menu state, return focus, inactive panes excluded. Repeat with text size increased and Reduce Motion; inspect light/dark contrast over real backgrounds.

Attach mobile + desktop screenshots and a short recording. Mark each row pass/fail/not tested, with reproduction steps for failures. **Current real-device status: not run in this environment.**
