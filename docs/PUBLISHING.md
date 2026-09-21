# Package publication readiness

Framewave is a four-package npm release. Publishing remains intentionally disabled until the namespace and authentication decisions below are complete.

## Current verification

Run:

```bash
npm ci
npm run typecheck
npm test
npm run verify:packages
```

`verify:packages` builds all workspaces, creates the four npm tarballs in a temporary directory, checks each one for its JavaScript entry point, type declarations, README, and licence, installs the tarballs together as a clean consumer, and imports the umbrella package. It never publishes.

## Release order

The internal dependencies require this order:

1. `@framewave/core`
2. `@framewave/gpu`
3. `@framewave/export`
4. `framewave`

Publish every package at the same version before moving to the next release.

## Decisions required before the first npm release

- Authenticate an npm account with two-factor authentication or configure npm trusted publishing.
- Confirm that the publisher owns the `@framewave` npm scope. If not, choose an owned scope and update the three scoped package names and internal dependencies together.
- Decide whether to migrate the deprecated `mp4-muxer` and `webm-muxer` dependencies to their recommended successor before `0.1.0`, or document their temporary use and schedule the migration.
- Re-run the full checks from a clean clone and inspect each dry-run tarball.
- Publish only after an explicit release decision; the GitHub `v0.1.0` release does not mean the npm packages have been published.

## Registry snapshot

On 2026-09-21, public registry lookups returned `404 Not Found` for `framewave`, `@framewave/core`, `@framewave/gpu`, and `@framewave/export`. That indicates no public package was visible under those names at that moment; it does not establish ownership of the `@framewave` scope.
