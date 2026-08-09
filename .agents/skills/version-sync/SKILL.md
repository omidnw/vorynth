---
name: version-sync
description: Bump the Vorynth version everywhere it lives, using the script-driven single-source-of-truth workflow. Use whenever a version changes — release, hotfix, or pre-release bump. Trigger automatically when the task mentions bumping version, releasing, or "version sync". The changelog skill delegates its version step here.
---

# Version Sync — Vorynth

## Purpose

Bump the Vorynth version everywhere it lives, script-driven, with exactly one source of truth (root `package.json`).

The version has exactly **one source of truth**: root `package.json`. Everything else is written by script — never by hand.

## When to use

- Bumping version for a release (usually via `/changelog`)
- Any task where the version string must change or be verified

## Workflow

1. **Decide the new version** (see `/changelog` for semver rules; if this is a release, write the changelog entry first).
2. **Bump root `package.json`** — edit `"version": "X.Y.Z"` by hand. This is the single source of truth.
3. **Sync everything**:

   ```bash
   pnpm version:sync
   ```

   The script rewrites all targets (must all match):

   ```
   packages/types/src/index.ts               → VORYNTH_VERSION constant
   apps/core-engine/package.json
   apps/desktop/package.json
   apps/desktop/src-tauri/tauri.conf.json     → "version"
   apps/desktop/src-tauri/Cargo.toml          → version = "..."
   ```

4. **Manually update the files the script doesn't cover:**

   - `README.md` — "Version **X.Y.Z**" line
   - `.agents/skills/changelog/references/codenames.md` — move the codename from "Suggested" to "Already used" (only on releases)

   The landing page needs no version edit: it derives its version from `@vorynth/types` (`apps/landing/src/content.ts`). If the release ships a new codename, update the `CODENAME` string there too.

5. **Rebuild `@vorynth/types`** if you touched it: `pnpm --filter @vorynth/types build` — `nest start --watch` does NOT hot-reload workspace deps; a stale constant makes the Changelog page and engine `/status` point at the wrong release.

## Rules

- Root `package.json` is edited by hand; **everything else via the script** — never edit the 5 targets directly.
- The landing page is auto-synced via `@vorynth/types` — never hardcode a version in `apps/landing`; only the `CODENAME` string is hand-maintained.
- No version change is too small to sync — drift is how stale versions get shipped.

## Common mistakes (gotchas)

- Editing `tauri.conf.json` or `Cargo.toml` by hand → script fails or silently skips on next run.
- Forgetting `README.md` / the codenames file → the repo and landing hero show an old version or codename.
- Forgetting to rebuild `@vorynth/types` → engine reports the old version even though files say the new one.

## Validation

```bash
pnpm version:check     # exits non-zero on drift — run this last
```

Then confirm the engine reports it:

```bash
curl -s http://127.0.0.1:34117/status | grep -o '"version":"[^"]*"'
```
