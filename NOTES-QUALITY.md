# Quality work log

Goal: six deliverables for reliable duet-ui, branch `quality/shadcn-grade`. Never merge or deploy.

## Progress
- Read supplied research and trip diagnoses; these remain hypotheses until reproduced.
- Baseline investigation: layout tests wait for removed `.duet-glass` and selected `.duet-tab` markup. Current controls use `.duet-group` and menu navigation. Repair harness before assessing regressions.
- Source confirms selected menu item returns before `onSelect`; sidebar and pane menu lack Escape/focus lifecycle. Regression tests will precede fixes.

## Validation and outstanding work
Pending: repaired browser baseline, layered tests, posture matrix, audit/integration docs, CI, fresh-package consumer, media and draft PR.
Real Safari chrome/hinge/Island painting cannot be certified by desktop WebKit signal emulation.
- Regression-first: Vitest reproduced selected-item callback suppression, missing sidebar focus/Escape, and missing pane menu focus/arrow/Escape (all failed before fixes). Existing browser drag regression revealed a second stale `.duet-glass` selector in production `useSideDrag`, not just tests; changed to `.duet-group`.
- Added non-modal focus lifecycle and arrow/Home/End navigation; selected items call onSelect without resetting their saved scroll.
- WebKit iframe exposed SSR-only guard nodes missing on client emulation; gate decorative guards until hydration, covered by SSR and browser error assertions.
- Worktree administrative directory is mounted read-only despite shared git directory being writable. Using a copied administrative index under shared `.git/quality-admin` with the same branch refs for commits; no branch change.
- Added 13 signal-driven screenshot/behaviour states in WebKit and Chromium plus transition, axe and document-scroll regressions. Initial WebKit run confirmed all static detector states.
- Reproduced two further bugs before fixing: document-scroll column sidebar opens at y=-898 after scrolling; axe finds sidebar heading contrast 3.28:1 (requires 4.5:1). Pin absolute sidebar to visible document position; use primary ink for its small heading.
- npm distribution has no registry/CLI: tarball export validation and a fresh Vite+TypeScript consumer production build passed. Pin the fixture's packageManager to pnpm 10.32.0.
- Axe additionally reproduced destructive pane-menu text contrast 3.54:1. Separate destructive text from decorative badge red with theme-aware accessible text colours.
- Overflow morph menu had the same focus defect; new role-based regression failed before applying shared focus lifecycle.
- Isolated remaining baseline crash: no-JS/no-external-assets home still crashes WebKit; removing `<video>` tags passes; a minimal single video reproduces the crash. Library reading-column assertions now use `/quality` in both engines. Chromium retains home smoke; WebKit home media smoke explicitly skips with the native backend reason, pending real Safari playback.
- Do not overlap Playwright invocations or rebuild/pack dist while its server runs: an exploratory overlap caused trace deletion and transient module resolution errors. Subsequent validation runs are serialized.
- A follow-up focus regression reproduced lost focus on action selection (the menu unmounted before passive effect cleanup could restore it). Restore to the opener before the app callback, allowing the callback to focus a newly opened dialog.
- Full baseline generation is exercising 64 tests across both engines; checking and reviewing images before a comparison-only run.
- Expanded axe to light/dark and overflow menus. New failures: overflow heading reused the same low-contrast dim colour; dark translucent pane menu over white yielded only 2:1 destructive text contrast. Use primary ink for small menu headings and an opaque theme-aware text-bearing pane menu surface (keep pill glass); test this hostile background explicitly.
- All six expanded axe/review tests pass in both engines. Preserve the public `--duet-dim` heading customization by strengthening its default colours rather than making it ineffective; regenerate/review affected heading snapshots.
