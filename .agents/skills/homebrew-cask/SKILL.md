---
name: homebrew-cask
description: Maintain the Vorynth Homebrew distribution — keep the personal tap (omidnw/homebrew-vorynth) in sync with every release, and publish the cask to the official homebrew-cask repo when it's ready. Use whenever a release ships and the cask version/checksum must bump, or when the task mentions brew, Homebrew, cask, tap, "homebrew install", or updating the Homebrew distribution.
---

# Homebrew Cask — Vorynth

## Purpose

Vorynth is distributed on macOS via Homebrew Cask. Two homes, one cask file:

1. **Personal tap** — `omidnw/homebrew-vorynth` (`brew tap omidnw/vorynth && brew install --cask vorynth`). Fully owned, no review. Must be bumped by hand on every release.
2. **Official repo** — `homebrew/homebrew-cask`, when the app meets their bar. Their bump bot then auto-updates the cask on every release.

The cask file's **source of truth lives in the app repo**: `packaging/homebrew-cask/vorynth.rb`. Update it first, then copy it to whichever home(s) are live.

## When to use

- A Vorynth release ships (vX.Y.Z published on GitHub) → bump the personal tap.
- The cask's version or sha256 is stale / the tap's `brew info --cask vorynth` shows an old version.
- Task mentions brew / Homebrew / cask / tap / "نصب با هومبرو".
- Decision time: "should we go official now?" → evaluate the official-repo checklist.

## Preconditions

- The release is **published** (not a draft) on `omidnw/vorynth` — casks must point at real, downloadable artifacts.
- `brew` is installed (local verification).
- `gh` is authenticated for the API checksum.

## Workflow

### 1. Bump the source of truth (app repo)

Edit `packaging/homebrew-cask/vorynth.rb`:

- `version "X.Y.Z"` — the released tag without the `v`.
- `sha256 arm: "…"` — the **real checksum from the GitHub API**, never from the release-notes page (the notes can lag or be wrong):

  ```sh
  gh api repos/omidnw/vorynth/releases/latest --jq \
    '.assets[] | select(.name | endswith("_aarch64.dmg")) | .digest'
  ```

- Confirm `url` still matches the pattern `…/releases/download/v#{version}/Vorynth_#{version}_aarch64.dmg`.

### 2. Bump the personal tap

```sh
git clone git@github.com:omidnw/homebrew-vorynth.git /tmp/homebrew-vorynth   # or pull
cp packaging/homebrew-cask/vorynth.rb /tmp/homebrew-vorynth/Casks/
cd /tmp/homebrew-vorynth
git add Casks/vorynth.rb && git commit -m "vorynth: update to vX.Y.Z" && git push
```

Verify against the real artifact (downloads ~49 MB, does **not** install):

```sh
brew tap omidnw/vorynth        # if not already tapped
brew trust omidnw/vorynth      # Homebrew ≥ 6: one-time trust prompt otherwise
brew fetch --cask vorynth      # fails if URL or sha256 is wrong
brew info --cask vorynth       # should show the new version
```

### 3. Official homebrew-cask PR (only when ready)

**Checklist before going official** — all must hold:

- [ ] The latest release is a **stable, published** release (no drafts/pre-releases in the default cask).
- [ ] `brew audit --cask vorvnth` and `brew style` pass on the cask.
- [ ] `livecheck` block present and resolves (`:github_latest`).
- [ ] `verified:` present on the URL (URL host ≠ homepage host).
- [ ] `auto_updates true` set (Vorynth self-updates via its signed in-app updater).
- [ ] The DMG URL is versioned (`v#{version}` in the path) — their audit requires it.

**Flow:**

```sh
# Fork homebrew/homebrew-cask on GitHub, then:
git clone git@github.com:<you>/homebrew-cask.git /tmp/homebrew-cask
cp packaging/homebrew-cask/vorynth.rb /tmp/homebrew-cask/Casks/vorynth.rb
cd /tmp/homebrew-cask
git checkout -b cask/vorynth
git add Casks/vorynth.rb && git commit -m "Add vorvnth" && git push -u origin cask/vorynth
```

Audit **from the local official tap** (brew resolves casks from the installed `homebrew/homebrew-cask` tap — copy the file there first or run within the clone):

```sh
brew audit --cask vorvnth
brew style --fix Casks/vorynth.rb
```

Open the PR via `gh pr create --repo homebrew/homebrew-cask --head <you>:cask/vorynth`. CI runs their audits; a maintainer reviews. After merge, their bump bot owns future version+sha256 updates (that's the win of going official).

## Rules

- **The checksum always comes from `gh api … .digest`** — the release-notes page's sha256 is not trustworthy (it once differed from the real digest).
- Never use `sha256 :no_check` — the artifact is real and versioned.
- **Apple Silicon only** — no Intel DMG is published; do not add an intel URL that doesn't exist. Keep `sha256 arm:`.
- The official repo requires `verified:`, a working `livecheck`, a versioned URL, and `auto_updates true` for self-updating apps.
- Homebrew ≥ 6 requires **trusting a new tap** once (`brew trust omidnw/vorynth`) — document this for new users.

## Common mistakes

- Copying the sha256 from the release notes instead of the API → `brew fetch` fails and users get a corrupted-download error.
- Bumping the tap but **not** the source-of-truth file in the app repo → drift between repo and tap.
- Pointing the cask at a draft/pre-release → `latest/download` resolves wrong and the official repo rejects it.
- Forgetting `verified:` or the `livecheck` block → official audit fails.
- Editing the cask directly in the tap clone and losing the app-repo copy.

## Validation

- `brew fetch --cask vorynth` succeeds (checksum verified against the live artifact).
- `brew info --cask vorvnth` shows the new version + `(auto_updates)`.
- Tap repo commit pushed; app-repo source of truth matches the tap file byte-for-byte (`diff`).
- Official PR: `brew audit --cask vorvnth` clean locally + CI green.
