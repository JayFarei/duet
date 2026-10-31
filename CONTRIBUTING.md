# Contributing

Use Node 24 and pnpm 10.32.0 (`corepack enable`). In restricted environments set
`export COREPACK_HOME=$HOME/.cache/corepack` before pnpm commands.

Before submitting:

- [ ] Reproduce each bug with a failing regression test before changing production code.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:components`, and `pnpm test:distribution`.
- [ ] Install browsers with `pnpm exec playwright install --with-deps webkit chromium`; run `CI=1 pnpm exec playwright test`.
- [ ] Query interactions by role/name; use DOM geometry selectors only for layout contracts. Check keyboard, focus return, pointer/touch, current-item re-selection and reduced motion.
- [ ] Review screenshot differences in both browsers. Update with `pnpm exec playwright test e2e/quality.spec.ts --update-snapshots` only after reviewing the change, and commit baselines. Never regenerate them to hide a failure.
- [ ] For interactive **or** layout changes, complete a **manual pass on a real iPhone Duo in Safari** using [the matrix](docs/DUO-TEST-MATRIX.md). Include device/iOS/Safari versions, date, tester, tested states, and results in the PR. An emulator is not a substitute. If hardware is unavailable, keep the PR draft and mark this check pending.
- [ ] Manually test keyboard and VoiceOver reading/focus order, text zoom and both themes. Axe catches only machine-detectable issues.
- [ ] Attach mobile and desktop screenshots plus a short screen recording for UX changes. CI records Playwright videos and traces; put small compressed review media in `docs/quality/pr-media/` and link them in the PR.
- [ ] Update [the audit](docs/QUALITY-AUDIT.md), integration guidance and changelog for changed public behaviour.

Run the distribution test **before** starting the dev server: packing rebuilds `dist`. Do not run two Playwright commands sharing `test-results/` concurrently. The Playwright server builds the package and starts the site on :3100; it shuts down when tests finish. Stop any manually started servers.

The quality job must pass before review completion. Repository branch protection is an administrator setting: configure Quality/check as required; this file alone cannot enforce it. Never merge a quality change with the real-device checklist represented as passed without device evidence.
