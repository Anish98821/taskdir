---
name: release
description: Cut and publish a taskdir release — version bump, changelog, dev→main flow, tag-triggered npm publish, and local reinstall. Use when the user asks to release, publish, bump the version, or ship to npm.
---

# Releasing taskdir

Publishing to npm happens **only** when a `v*` tag is pushed — `.github/workflows/release.yml` then verifies the tag against package.json, builds (via `prepack`), publishes to npmjs, and creates a GitHub Release. Pushing to main alone never publishes.

## 0. Pick the version (SemVer)

- Bug fixes only → patch (x.y.Z)
- New features, behavior changes, or removals → minor (x.Y.0)
- Ask the user if the changes straddle the line.

## 1. Preflight

```bash
git status --short          # start clean or know exactly what ships
npx tsc --noEmit
npm test
npx eslint src
```

## 2. Bump the version — it lives in TWO places

1. `package.json` → `"version"`
2. `bin/taskdir.ts` → `const VERSION = "..."` (hardcoded; drives `taskdir --version` and the web-runtime cache path)

If these disagree, the CI tag check still passes but the shipped CLI reports the wrong version.

## 3. Finalize the changelog

In `CHANGELOG.md`, rename `## Unreleased` to `## X.Y.Z — YYYY-MM-DD`. Keep Keep-a-Changelog sections (Added/Changed/Fixed/Removed).

## 4. Commit through dev, merge to main

The repo convention is: commit on `dev`, push, fast-forward `main`.

```bash
git checkout dev
git merge main --ff-only        # catch up if main is ahead
git add -A && git commit        # release message summarizing the changelog
git push origin dev
git checkout main
git merge dev --ff-only
git push origin main
```

(If uncommitted work blocks `git checkout dev`, stash → switch → pop.)

## 5. Tag to publish

Tag the main head **after** both version bumps are in it:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

Watch it: `gh run list --workflow release.yml --limit 1`, then
`gh run watch <run-id>`. Confirm with `npm view @anish98821/taskdir version`.

## 6. Refresh the local install

The global `taskdir` on this machine is a **symlink to this repo** (`npm ls -g @anish98821/taskdir`), and its entrypoint runs prebuilt bundles — so the installed CLI is stale until dist/ is rebuilt:

```bash
npm run build:cli && npm run build:web
taskdir --version               # must report the new version
```

`next build` (inside build:web) conflicts with a running `pnpm dev` on this repo — stop the dev server first, restart it after.

## Gotchas seen in past releases

- 0.8.0: `bin/taskdir.ts` VERSION constant missed in the release commit — needed a follow-up commit before tagging.
- The tag must point at a commit where package.json matches, or the workflow's version check fails and nothing publishes.
- Re-cutting a release (0.6.1) means a new patch version — npm won't accept a republished version number.
