# Quality work log

Goal: six deliverables for reliable duet-ui, branch `quality/shadcn-grade`. Never merge or deploy.

## Progress
- Read supplied research and trip diagnoses; these remain hypotheses until reproduced.
- Baseline investigation: layout tests wait for removed `.duet-glass` and selected `.duet-tab` markup. Current controls use `.duet-group` and menu navigation. Repair harness before assessing regressions.
- Source confirms selected menu item returns before `onSelect`; sidebar and pane menu lack Escape/focus lifecycle. Regression tests will precede fixes.

## Validation and outstanding work
All six deliverables are implemented; see the final report below for results, remaining hardware checks and draft PR.
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
- Final comparison-only browser run: 65 pass, 1 explicit WebKit media skip; 38 baselines compare, no axe violations in both themes/engines.
- Final keyboard edge check found another defect before fix: Tab dismissed an unmounted menu then restarted at the page's first control. Return to opener before allowing native Tab progression. Added app-owned focus regression to ensure action callbacks can intentionally focus an editor.
- Closing-transition regression failed in both browsers: releasing the absolute sidebar's pin as soon as `open` became `closing` jumped it back to document top. Retain the pin through the closing phase and release only when fully closed.

## Final report — 31 October 2026

Draft PR: https://github.com/JayFarei/duet/pull/248
Branch: `quality/shadcn-grade`, pushed against `main`. No merge, release or deployment performed.

### Six deliverables

1. [QUALITY-AUDIT](docs/QUALITY-AUDIT.md) records every requested quirk class, root-cause evidence, fixed/covered/hypothesis status and remaining native checks.
2. [Written matrix](docs/DUO-TEST-MATRIX.md), `e2e/postures.ts` and existing `playwright.config.ts` cover 13 static states, both engines, fold/turn transitions, hinge centre assertions, split view, URL bar/banner/keyboard, phone/desktop fallback, and navigation/focus. 38 committed screenshots include both themes and menu states.
3. Retained pure geometry tests; added Vitest/Testing Library/user-event role tests, real-browser behaviours, axe failures, visual comparison, node-only SSR rendering, npm export validation and an isolated installed-tarball consumer typecheck/production build. No registry/CLI exists, so registry validation is explicitly not applicable; its future introduction requires a registry/CLI gate.
4. GitHub Actions runs all automated layers and uploads browser evidence. CONTRIBUTING and the PR template require a documented **real Duo Safari pass for interactive/layout changes**, plus VoiceOver/manual checks. Maintainers still need to configure branch protection to require Quality/check.
5. Verified/fixed bugs: current-item callbacks swallowed; dead drag initiation; scrolled column sidebar opening off screen and jumping on close; sidebar/pane/overflow focus and keyboard handling; lost focus after action selection; Tab restarting at the page's first control; low-contrast sidebar/overflow headings and destructive text; dark translucent menu contrast over a white background; iframe hydration guard mismatch. Regression tests reproduced the interaction/layout/contrast defects before their fixes; the SSR assertion also protects the observed browser hydration failure.
6. [Integration guidance](docs/QUALITY-INTEGRATION.md), README links and Unreleased changelog explain re-selection compatibility, inner/document scrolling, stable horizontal targets, insets, safe areas, SSR, themes, non-modal focus and performance footguns.

### Validation results

| Layer | Result |
| --- | --- |
| Existing Node geometry/signal/template tests | **251 pass, 0 fail** |
| Vitest role/user-event component tests + node SSR | **8 pass, 0 fail** |
| Workspace typechecks + quality harness typecheck | **Pass** |
| Packed npm exports + fresh pnpm 10.32.0 Vite/TypeScript consumer | **Pass**, production bundle built from installed tarball |
| Full Playwright comparison run | **65 pass, 0 fail, 1 explicit skip** in WebKit + Chromium; **38 visual baselines match** |
| Later focus/drag follow-up | **4 pass** across both engines |
| Later sidebar closing-position regression | Failed in both engines before fix; **2 pass** after fix |
| Axe | **Pass**, both engines, light/dark, closed/sidebar/pane/overflow menu states; no rule suppression |
| GitHub Actions | Build, typecheck, unit, component/SSR and distribution steps passed on the first pushed revision; browser run in progress when this report was written. See PR checks for the final revision. |
| Physical Duo Safari / VoiceOver | **Not run; required before leaving draft** |

The single skip is the **Linux WebKit home-media smoke**, with an explicit test reason. Reduction: minimal `<video src="/media/strip.mp4">` crashes the media backend without app JS; removing video elements lets the home load. The library reading-column test now runs on the small network-free consumer in both engines; Chromium retains the home smoke. This is not represented as a product fix or a physical Safari failure.

Browser evidence: [mobile](docs/quality/pr-media/mobile.png), [desktop](docs/quality/pr-media/desktop.png), [compressed Playwright recording](docs/quality/pr-media/menu-keyboard.mp4). These are Linux WebKit captures, not hardware captures. Review media totals about 150 KiB; full baseline corpus about 2 MiB. Automated browsers test layout under injected signals, not whether native Safari will emit those signals or paint undocumented overflow the same way.

### Still needs a real-device check

- Both fold/turn directions and intermediate hinge angles, slow/fast transitions, laptop keyboard and actual crease hit targets.
- Both split panes, divider resize/swap/exit, safe areas and Dynamic Island/Live Activities including landscape growth.
- Safari tab switching/BFCache, expanded/collapsed URL bar, Shared with You banner, in-app preview/Open in Safari, app switching and keyboard dismissal/caret retention.
- Outer column ring/shadow/press-swell clipping; smooth scroll cancellation only when sideways drift triggers `follow()` correction; momentum, rubber-banding and toolbar tint. These remain hypotheses or native risks, not claimed fixed.
- Trip menu-opening performance with Web Inspector: custom scroll transforms, large blur surfaces, root invalidation and layout animation. Supplied video cannot identify the exact tapped target.
- Existing preview-with-sticky-header app-return disappearance (#235), VoiceOver, external keyboard, increased text size and custom theme contrast.

Keep PR #248 **draft** until the manual matrix has hardware evidence. No speculative delayed scroll retry or geometry redesign was shipped.

### Workspace environment note

The managed sandbox mounts this worktree's administrative directory read-only, while the shared `.git` is writable. Commits/pushes used a separate index/admin copy referencing the **same branch refs**:

```sh
export GIT_DIR=/workspace/duet-repo/.git/quality-admin
export GIT_WORK_TREE=/workspace/repos/wt/duet-quality
```

The original administrative index could not be refreshed in this sandbox, so plain `git status` without these variables can show stale staged changes even though the branch commits and files agree. Outside this sandbox, after confirming all work is committed, `git reset --mixed HEAD` refreshes that original index without changing working files. `.quality-inputs/`, task/log files and generated results were not committed.

- GitHub caught cross-distro visual drift: local Debian resolves Arial to Arimo and system-ui to Noto Sans, while the runner uses different fonts. Pin a small SIL OFL licensed font subset and native-input/focus styling **inside the fixture only**, then regenerate/review baselines. Do not add screenshot tolerance or disable comparisons.
- Fixed CI visual reproducibility without reducing the comparator: bundle a 13 KiB licensed Latin font, normalize only fixture inputs/focus, pin Ubuntu 24.04, and run PR CI once rather than duplicate branch+PR jobs. All 36 quality tests pass while regenerating the affected baselines; mobile/desktop/video evidence refreshed.
- Final source review added a folded-primary keyboard regression: the first tap arms a confirmation rather than closing the menu, so generic click focus restoration must not move focus back to More. It failed before the correction. Restore after the app handler only when a removed/inert menu left focus on body; retain confirmation focus and any intentional app focus.
