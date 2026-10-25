# Releasing duet-ui

Pushing a `vX.Y.Z` tag publishes `packages/duet-ui` to npm through [`release.yml`](../.github/workflows/release.yml). npm trusts that workflow by name (Trusted Publishing), so no npm token is stored anywhere.

```sh
cd packages/duet-ui && npm version patch --no-git-tag-version && cd ../..
git commit -am "duet-ui 0.1.1" && git tag v0.1.1 && git push && git push origin v0.1.1
```

The workflow fails if the tag and `package.json` version differ. Use `minor` while the API is still settling and breaking changes ship, `patch` for fixes.

## One-time setup

1. First publish by hand (npm only trusts a workflow for a package that exists): `npm login`, then `npm publish --access public` in `packages/duet-ui`.
2. npmjs.com, duet-ui, Settings, Trusted publishing, GitHub Actions: user `JayFarei`, repository `duet`, workflow `release.yml`, no environment. It expires unless a workflow publish succeeds within 48 hours.
3. Settings, Publishing access: "Require two-factor authentication and disallow tokens".

Provenance is only attached once the repository is public.
