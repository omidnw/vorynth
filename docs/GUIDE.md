# Vorynth — Setup & Usage Guide

> **Less reading. More understanding.**

This guide covers everything you need: prerequisites, running in development,
building native installers, platform-specific notes, and troubleshooting.

---

## Table of Contents

- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Clone & install](#clone--install)
- [Running](#running)
- [Building](#building)
- [CI/CD builds](#cicd-builds)
- [Platform notes](#platform-notes)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```bash
git clone https://github.com/omidnw/vorynth.git
cd vorynth
pnpm install
pnpm dev
```

This starts both the core engine and desktop UI in parallel:

- **Core engine** → `http://localhost:4317` (health check at `/health`)
- **Desktop UI** → `http://localhost:5173` (hot-reloads on save)

---

## Prerequisites

### Node.js ≥ 20

```bash
node --version    # should be 20 or higher
```

### pnpm ≥ 10

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm --version    # should be 10.29+
```

### Rust toolchain (for Tauri desktop builds)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustc --version   # verify
```

### System dependencies

**macOS** — Xcode Command Line Tools:

```bash
xcode-select --install
```

**Linux (Ubuntu/Debian)** — WebKit2GTK and friends:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

**Linux (Fedora/RHEL):**

```bash
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel \
  librsvg2-devel patchelf openssl-devel gtk3-devel
```

**Windows** — Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10+).

**FreeBSD:** see [FreeBSD notes](#freebsd) below.

---

## Clone & install

```bash
git clone https://github.com/omidnw/vorynth.git
cd vorynth
pnpm install
```

This installs all workspace dependencies (core engine, desktop, shared types).

---

## Running

### Both engine + desktop (recommended)

```bash
pnpm dev
```

Runs everything side-by-side with `concurrently`. The Tauri desktop shell
automatically finds a free port, spawns the engine, and waits for `/health`.

### Engine only

```bash
pnpm dev:core
```

Starts the NestJS/Fastify engine at `http://localhost:4317` with file watching.

### Desktop only (needs engine running separately)

```bash
pnpm dev:desktop
```

Starts the Vite dev server at `http://localhost:5173`. Point it at a running
engine by setting `VITE_CORE_PORT` (defaults to `4317`).

### Other useful commands

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `pnpm typecheck`    | TypeScript checking across all packages        |
| `pnpm lint`         | ESLint                                         |
| `pnpm lint:fix`     | ESLint with auto-fix                           |
| `pnpm format`       | Prettier formatting                            |
| `pnpm format:check` | Check formatting without writing               |
| `pnpm test`         | Run Vitest tests                               |
| `pnpm db:migrate`   | Apply Drizzle ORM migrations                   |
| `pnpm db:seed`      | Seed the default RSS sources                   |
| `pnpm clean`        | Remove all `dist/`, `node_modules/`, `.turbo/` |

---

## Building

### Desktop app (Tauri native installer)

Build for your **current** platform:

```bash
pnpm --filter @vorynth/desktop tauri build
```

Output goes to `apps/desktop/src-tauri/target/release/bundle/`.

### Cross-compile for specific targets

```bash
# macOS Apple Silicon
pnpm --filter @vorynth/desktop tauri build --target aarch64-apple-darwin

# macOS Intel
pnpm --filter @vorynth/desktop tauri build --target x86_64-apple-darwin

# Linux x86_64
pnpm --filter @vorynth/desktop tauri build --target x86_64-unknown-linux-gnu

# Linux ARM64
pnpm --filter @vorynth/desktop tauri build --target aarch64-unknown-linux-gnu

# Windows x86_64
pnpm --filter @vorynth/desktop tauri build --target x86_64-pc-windows-msvc
```

### Core engine sidecar (portable bundle)

```bash
pnpm --filter @vorynth/core-engine bundle
```

Produces `apps/core-engine/dist-bundle/` — a self-contained directory with the
inlined engine, native SQLite addon, and launcher:

```bash
node apps/core-engine/dist-bundle/launcher.cjs --port 4399
```

This is what the CI pipeline ships as a Tauri sidecar.

---

## CI/CD builds

Every push to `master` triggers automated builds via GitHub Actions. See
`.github/workflows/` for full definitions.

| Workflow      | Trigger                        | What it does                                   |
| ------------- | ------------------------------ | ---------------------------------------------- |
| `ci.yml`      | Push to `master` + PR          | Typecheck → Lint → Format check → Build        |
| `package.yml` | Push to `master` + tags (`v*`) | Cross-platform Tauri builds + upload artifacts |
| `pages.yml`   | Push to `master`               | Deploys landing page to GitHub Pages           |

### Available artifacts

| Platform              | Format                        |
| --------------------- | ----------------------------- |
| macOS (Apple Silicon) | `.dmg` / `.app`               |
| macOS (Intel)         | `.dmg` / `.app`               |
| Linux x86_64          | `.deb` / `.rpm` / `.AppImage` |
| Linux ARM64           | `.deb` / `.AppImage`          |
| Windows x86_64        | `.msi` / `.exe`               |
| FreeBSD x86_64        | `.tar.gz`                     |

---

## Platform notes

### macOS

Tauri builds produce a signed `.app` bundle and `.dmg` installer. For
development, Xcode CLT is sufficient — full Xcode is only needed for
notarization.

### Windows

Builds require:

- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (included in Windows 10+)
- You may need to set `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` for
  signing (optional for development).

### Linux

- **x86_64** — fully supported. Produces `.deb`, `.rpm`, and `.AppImage`.
- **ARM64** — supported (Raspberry Pi 4+, AWS Graviton, etc.). Requires the
  same WebKit2GTK libraries.
- Other architectures — may work but aren't CI-tested.

### FreeBSD

Tauri on FreeBSD is **experimental**. Two approaches:

**A) Linux binary via ABI compatibility (recommended)**

Linux x86_64 binaries run on FreeBSD through the built-in Linux ABI
compatibility layer (`linuxulator`). Enable it with:

```bash
sudo sysrc linux_enable="YES"
sudo service linux start
```

Then run the Linux `.AppImage` or `.deb` directly.

**B) Native FreeBSD build**

Build inside a FreeBSD VM or native FreeBSD machine:

```bash
pkg install -y node npm rust pkgconf webkit2gtk-4.1 gtk3 librsvg2 libxcb
npm install -g pnpm@10
git clone https://github.com/omidnw/vorynth.git
cd vorynth
pnpm install
pnpm typecheck
pnpm lint
pnpm --filter @vorynth/desktop build
pnpm --filter @vorynth/core-engine bundle
cd apps/desktop/src-tauri
cargo tauri build --target x86_64-unknown-freebsd
```

### Harmony OS (OpenHarmony)

Vorynth does **not** have a native Harmony OS build yet. Tauri v2 does not
officially target Harmony OS / OpenHarmony.

**Current options (from most to least practical):**

1. **Run from source** — clone the repo, install Node.js + pnpm on your
   Harmony OS device (via Termux or native Node), and run `pnpm dev`. The
   Vite frontend will be accessible in the browser at `http://localhost:5173`.
   You will also need the core engine running — see [Running](#running).

2. **Android compatibility** — if your Harmony OS device supports Android
   apps (pre-NEXT), you can try running the Tauri Android build once mobile
   support is added.

3. **Future native support** — once the Tauri ecosystem or OHOS community
   provides a native target, we will add it to the CI pipeline.

---

## Project structure

```
Vorynth/
├── apps/
│   ├── desktop/                    Tauri v2 + React 18 + Vite + Tailwind
│   │   ├── src/                    UI pages, components, i18n
│   │   ├── src-tauri/              Rust shell — sidecar launcher + window
│   │   │   ├── src/main.rs         Sidecar resolution & lifecycle
│   │   │   ├── Cargo.toml          Rust dependencies
│   │   │   └── tauri.conf.json     App config (window, bundle, CSP)
│   │   └── package.json
│   └── core-engine/                NestJS + Fastify — intelligence runtime
│       ├── src/
│       │   ├── main.ts             Engine entry point
│       │   ├── modules/
│       │   │   ├── collector/      RSS polling, rate limiting
│       │   │   ├── normalizer/     Dedup, classification, scoring
│       │   │   ├── intelligence/   LangGraph.js workflow
│       │   │   ├── search/         FTS5 + AI RAG search
│       │   │   ├── backup/         Snapshot management
│       │   │   └── llm/            Provider abstraction
│       │   └── db/                 Schema, migrations, FTS5 setup
│       ├── data/                   SQLite database file
│       └── scripts/                Sidecar bundler (ncc)
├── packages/
│   └── types/                      Shared TypeScript interfaces
├── docs/                           Documentation & landing page
├── .github/workflows/              CI/CD pipelines
├── project-details.md              Full product specification
└── README.md                       Project overview
```

---

## Troubleshooting

### "Error: Multiple versions of pnpm specified"

The `package.json` has `"packageManager": "pnpm@10.29.3"` which the
`pnpm/action-setup` GitHub Action reads automatically. Make sure you don't
also pass `version: 10` in the workflow step. See `.github/workflows/` for
the correct setup.

### "better-sqlite3" native rebuild fails

This happens when the prebuilt binary doesn't match your platform/architecture.
Run:

```bash
pnpm rebuild better-sqlite3
```

If that still fails, ensure you have the C++ build tools installed (see
[Prerequisites](#prerequisites)).

### Core engine won't start (port in use)

The engine defaults to port `4317`. If that's taken, set:

```bash
PORT=4318 pnpm dev:core
```

The desktop app reads the port from `window.__VORYNTH_CORE_PORT__` (injected
by the Tauri shell) or from `VITE_CORE_PORT` env var (default `4317`).

### FTS5 search returns no results

The FTS5 index is synced at the application level. After adding articles, the
sync runs automatically. If search still returns nothing, try:

```bash
pnpm db:migrate    # ensures the FTS5 virtual table exists
pnpm db:seed       # re-seeds sample sources
```

Then trigger a collect + generate from the app UI.

### Tauri build fails on Linux — "webkit2gtk-4.1 not found"

Make sure you installed the correct dev package:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev
```

Older Ubuntu releases (20.04) ship `libwebkit2gtk-4.0-dev` which is
incompatible with Tauri v2. Use Ubuntu 22.04 or newer, or build from source.

### GitHub Pages not deploying

1. Go to repo **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to `master` — the `pages.yml` workflow will deploy automatically.

---

## License

MIT — see [LICENSE](../LICENSE). Copyright © 2026 Omid Reza Keshtkar.

---

## Getting help

- [GitHub Issues](https://github.com/omidnw/vorynth/issues) — bug reports &
  feature requests
- [Project details](https://github.com/omidnw/vorynth/blob/master/project-details.md)
  — full product specification
- [Changelog](https://github.com/omidnw/vorynth/blob/master/apps/desktop/src/features/changelog/changelog-data.ts)
  — version history
