# Quality work log

Goal: six deliverables for reliable duet-ui, branch `quality/shadcn-grade`. Never merge or deploy.

## Progress
- Read supplied research and trip diagnoses; these remain hypotheses until reproduced.
- Baseline investigation: layout tests wait for removed `.duet-glass` and selected `.duet-tab` markup. Current controls use `.duet-group` and menu navigation. Repair harness before assessing regressions.
- Source confirms selected menu item returns before `onSelect`; sidebar and pane menu lack Escape/focus lifecycle. Regression tests will precede fixes.

## Validation and outstanding work
Pending: repaired browser baseline, layered tests, posture matrix, audit/integration docs, CI, fresh-package consumer, media and draft PR.
Real Safari chrome/hinge/Island painting cannot be certified by desktop WebKit signal emulation.
