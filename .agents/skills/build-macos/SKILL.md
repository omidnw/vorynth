---
name: build-macos
description: Build the Vorynth desktop app for macOS and install it to /Applications. Use whenever the user asks to build the app, take a build ("build بگیر"), install or update Vorynth on macOS, produce a .app or .dmg, or test a change in the real packaged app (not the dev engine). Covers the full pipeline: engine sidecar bundle → staging into the Tauri binaries dir → `cargo tauri build` → backup + install → live verification. Also explains how to debug the packaged engine when its logs are invisible.
---

# Build & Install on macOS — Vorynth

## Purpose

Turn the working tree into a self-contained macOS app (`Vorynth.app` + `.dmg`) that runs the **packaged** sidecar engine — the same way users get it — and install it on the local machine. This is the ONLY way to verify a change in the real packaged experience (dev `pnpm dev` uses a separate dev engine, different DB, and can mask bugs — see Common mistakes).

## When to use

- "build بگیر", "build کن", "یه build بگیر", "نسخه رو آپدیت کن", "روی macOS ام نصب کن".
- A change touches the engine (sidecar) or the desktop bundle and must be verified in the packaged app.
- Investigating a bug that only shows in the installed app (ports, DB path, sidecar behavior).
- A release build (vX.Y.Z).

## Preconditions

- Working tree builds: `pnpm typecheck` and `pnpm test` pass (scope to what changed per R-Q01).
- `@vorynth/types` rebuilt if shared types changed (R-D02) — `pnpm --filter @vorynth/types build`.
- No other Vorynth engine holding the default port (see Common mistakes — a stale dev engine can steal the port and the new app silently uses a different one).
- **Backup the DB before installing** — not required by the build itself, but `cp apps/core-engine/data/vorynth.sqlite` is never a bad idea before a risky session (see `/backup`).

## Workflow

### 1. Rebuild the engine sidecar (if engine code changed)

The engine ships as a self-contained bundle (`@vercel/ncc`), NOT the `dist/` output (`nest build` clobbers `dist/`).

```bash
cd apps/core-engine && node scripts/bundle-sidecar.mjs
# → dist-bundle/{index.js, launcher.cjs, better_sqlite3.node}
```

Verify the change actually landed in the bundle:

```bash
grep -c "your-new-symbol" dist-bundle/index.js
```

### 2. Stage the sidecar into the Tauri binaries dir

```bash
DEST="apps/desktop/src-tauri/binaries/vorynth-core-aarch64-apple-darwin"
cp apps/core-engine/dist-bundle/{index.js,launcher.cjs,better_sqlite3.node} "$DEST/"
```

The binaries dir holds the portable `node` binary + the engine bundle + native `better_sqlite3.node`. It is what Tauri ships as `resources/binaries/`.

### 3. Build the desktop app

```bash
cd apps/desktop/src-tauri && cargo tauri build --bundles app,dmg
```

Output:

- `target/release/bundle/macos/Vorynth.app`
- `target/release/bundle/dmg/Vorynth_1.8.0_aarch64.dmg`

(`cargo tauri build` runs `pnpm --filter @vorynth/desktop build` for the frontend automatically via `beforeBuildCommand`.)

### 4. Install (backup first — irreversible-ish)

```bash
pkill -f "vorynth-desktop" 2>/dev/null   # stop the running app first
sleep 2
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
mv /Applications/Vorynth.app "/Applications/Vorynth.app.bak-$TS"
ditto ".../target/release/bundle/macos/Vorynth.app" /Applications/Vorynth.app
open /Applications/Vorynth.app
```

Rollback (if the new build misbehaves):

```bash
mv "/Applications/Vorynth.app.bak-<TS>" /Applications/Vorynth.app
```

### 5. Live verification

- Find the engine port and hit `/health`:

  ```bash
  PID=$(pgrep -f "vorynth-core-aarch64" | head -1)
  PORT=$(ps eww -p $PID 2>/dev/null | tr ' ' '\n' | grep -oE "341[0-9][0-9]" | head -1)
  curl -s "http://127.0.0.1:$PORT/health"
  ```

- Spot-check the changed endpoints (`/plugins`, `/connectors`, `/reports/range?period=today`, `/jobs`, …).
- For UI changes: visually confirm in the running app (the user drives it, or you describe what to look for).

## Debugging the packaged engine

The installed sidecar's stdout/stderr go to `/dev/null` (Tauri `Stdio::inherit()` from a GUI launch). When you need real logs:

1. Run the same bundle manually with logs visible:

   ```bash
   cd apps/core-engine && VORYNTH_DATA_DIR="<the installed data dir>" node dist-bundle/launcher.cjs --port 34119
   ```

   ⚠️ The launcher kills itself when its parent shell exits (by design — it must never outlive the Tauri shell). Use the Bash tool's `run_in_background` or keep the parent alive; `setsid` does not exist on macOS.

2. The installed data dir is the platform app-data dir (NOT `apps/core-engine/data/`):

   ```bash
   VORYNTH_DATA_DIR="/Users/<user>/Library/Application Support/com.vorynth.desktop"
   ```

   Its `vorynth.sqlite` is the REAL user DB. Reading it with `sqlite3` while the app is running sees only checkpointed WAL data — `PRAGMA wal_checkpoint(FULL);` first for a consistent read.

## Rules

- **Sidecar bundle → `dist-bundle/`, never `dist/`** (R-D03). `nest build` clobbers `dist/`.
- **`VORYNTH_DATA_DIR` set by Tauri** points at the platform app-data dir — the packaged app reads the user's real DB, not `apps/core-engine/data/`. This mismatch has caused real confusion: API and `sqlite3` were looking at different databases (see Common mistakes).
- **Backup before overwriting `/Applications/Vorynth.app`** — always keep the previous build one `mv` away.
- **The installed app picks the FIRST free port starting at 34117.** If anything else holds 34117 (a stale dev engine, a second instance), the app silently uses 34118+. Always check which port the running sidecar actually owns before curling it.
- **Engine logs are invisible in the packaged app** — never conclude "nothing happened" from the UI alone when debugging the engine; reproduce with the manual launcher and read its stdout.
- **LLM rate limit is real in production** (5 req/min default → 12 s spacing). A live re-translate test that returns instantly is not a real LLM call; a test that takes 10–20 s is. Be patient, and never treat a fast no-op as proof of a bug or fix.

## Common mistakes

- **Curl-ing port 34117 when the new app is on 34118** (or vice versa). A stale dev engine from a previous session can still hold 34117. Always derive the port from the running sidecar's own PID (`ps eww`). This exact trap made a real re-translate bug appear "unfixed" — the fix WAS installed, but the curl was talking to the old dev engine on the other port.
- **Reading the wrong DB.** Two `vorynth.sqlite` files exist: `apps/core-engine/data/vorynth.sqlite` (dev) and `~/Library/Application Support/com.vorynth.desktop/vorynth.sqlite` (installed). If you query the dev DB while debugging the installed app, articles you know exist will 404.
- **Staging the sidecar but not rebuilding it** — `cargo tauri build` does NOT run `bundle-sidecar.mjs`. Rebuild + `grep -c` the bundle for your new symbol before building the app.
- **Skipping `@vorynth/ui` build** after touching `packages/ui` — the desktop imports its compiled `dist/`; stale ui = old UI in the new build (R-D02 applies to shared packages too).
- **The manual launcher dying instantly** — it watches its parent shell and exits when the shell dies. Run it with `run_in_background`, not `&` in a one-shot command.
- **`kill` by the wrong name** — the GUI process is `vorynth-desktop`, the engine is `vorynth-core-aarch64-apple-darwin/node`. `pkill -f vorynth-desktop` stops the shell; the sidecar then self-exits.

## Validation

- `cargo tauri build` prints `Finished 2 bundles at: …/Vorynth.app` and `…/Vorynth_*.dmg`.
- After install: `/Applications/Vorynth.app` exists, `defaults read /Applications/Vorynth.app/Contents/Info.plist CFBundleShortVersionString` matches the intended version.
- Live `/health` returns `{"status":"ok",…}` on the port the installed sidecar actually owns.
- The changed behavior is reproduced end-to-end against the installed app (e.g. a live re-translate job actually rewrites the story — check the DB row changed, not just that the request 200'd).
- When only UI changed (no engine change): skip step 1–2, build the app directly — but confirm the sidecar staged earlier is still current.
