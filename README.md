# Vorynth

> **Less reading. More understanding.**

[![CI](https://github.com/omidnw/vorynth/actions/workflows/ci.yml/badge.svg)](https://github.com/omidnw/vorynth/actions/workflows/ci.yml)
[![Package](https://github.com/omidnw/vorynth/actions/workflows/package.yml/badge.svg)](https://github.com/omidnw/vorynth/actions/workflows/package.yml)
![Version](https://img.shields.io/badge/version-1.3.0-blue)
[![License](<https://img.shields.io/badge/license-Open%20Source%20(TBD)-green>)](LICENSE)

**Vorynth** is a local-first personal intelligence engine that turns the flood
of global information into a short, personalized intelligence brief. Spend
**minutes** understanding what matters instead of hours searching for it.

Collects from your trusted sources → filters the noise → AI understands the
context → delivers a concise briefing. Everything runs on **your device** —
your API keys, history, and insights stay under your control.

[GitHub](https://github.com/omidnw/vorynth) ·
[Releases](https://github.com/omidnw/vorynth/releases) ·
[Documentation](https://omidnw.github.io/vorynth/)

---

## Architecture

```
Vorynth/
├── apps/
│   ├── desktop/                    Tauri v2 + React 18 + Vite + Tailwind CSS
│   │   ├── src/                    UI pages, components, i18n
│   │   └── src-tauri/              Rust shell — sidecar launcher + native window
│   └── core-engine/                NestJS + Fastify — intelligence runtime
│       ├── src/modules/
│       │   ├── collector/          RSS polling, rate limiting, per-source windows
│       │   ├── normalizer/         Dedup, classification, importance scoring
│       │   ├── intelligence/       LangGraph.js workflow (collect → analyze → brief)
│       │   ├── search/             FTS5 full-text + AI-assisted RAG search
│       │   ├── backup/             Export / restore / manage snapshots
│       │   └── llm/                Provider abstraction: OpenAI, Claude, Gemini, Groq
│       ├── data/                   SQLite database (better-sqlite3 + Drizzle ORM)
│       └── scripts/                Sidecar bundler (ncc + native addon)
└── packages/
    └── types/                      Shared TypeScript interfaces & DTOs
```

**Key principle:** The desktop app is a thin client. **Zero business logic in
React.** The engine owns everything — collection, normalization, AI analysis,
localization, and report generation.

---

## Features

- **Multi-source collection** — RSS feeds with per-source fetch windows and
  rate limiting. 13 seed sources covering AI, engineering, security & more.
- **LangGraph intelligence** — AI workflow: collect → normalize → dedup →
  rank → classify → analyze → brief. All local.
- **4 LLM providers** — OpenAI, Anthropic Claude, Google Gemini, Groq.
  Switch per-query or per-generate.
- **FTS5 full-text search** — blazing-fast keyword search with Persian/Arabic
  diacritic normalization and prefix matching.
- **AI-assisted RAG search** — ask questions in natural language; the engine
  retrieves relevant articles and answers with citations.
- **Period summaries** — daily, weekly, monthly AI-generated briefs with
  takeaways, recommended actions, and semantic themes.
- **Background jobs** — generation runs asynchronously with live progress
  reporting. Close the app, come back to your brief.
- **Backup & restore** — full database snapshots with manifest. One-click
  export, restore, delete.
- **i18n + RTL** — English & Persian (Farsi) UI. RTL auto-detection for
  AI output. More languages via standard ICU message format.
- **Dark mode** — system-aware theme with multiple accent colors.
- **Privacy first** — no cloud account. No telemetry. Your keys, your data.

---

## Getting started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`corepack enable && corepack prepare pnpm@10 --activate`)
- **Rust toolchain** (for Tauri builds) — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **System deps** (Linux) — WebKit2GTK, etc.
  [Tauri docs →](https://v2.tauri.app/start/prerequisites/)

### Quick start

```bash
pnpm install
pnpm dev               # runs desktop + core-engine in parallel
```

This starts:

- **Core engine** at `http://localhost:4317` (health: `/health`)
- **Desktop UI** at `http://localhost:5173` (auto-reloads on save)

### Individual commands

```bash
pnpm dev:desktop       # frontend only (Vite)
pnpm dev:core          # engine only (NestJS/Fastify)
pnpm db:migrate        # apply Drizzle migrations
pnpm db:seed           # seed the RSS sources
pnpm typecheck         # tsc --noEmit across all packages
pnpm lint              # ESLint across all packages
pnpm format            # Prettier
pnpm test              # Vitest across all packages
```

---

## Building

### Desktop application (Tauri)

Build a native installer for your current platform:

```bash
pnpm --filter @vorynth/desktop tauri build
```

Cross-compile for specific targets:

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

### Core engine sidecar

Bundle the engine into a single portable directory:

```bash
pnpm --filter @vorynth/core-engine bundle
```

Output goes to `apps/core-engine/dist-bundle/` — ready to be shipped as a
Tauri sidecar or run standalone:

```bash
node apps/core-engine/dist-bundle/launcher.cjs --port 4399
```

### CI/CD builds

Every push to `main` triggers automated builds via GitHub Actions:

| Platform              | Artifact                      |
| --------------------- | ----------------------------- |
| macOS (Apple Silicon) | `.dmg` / `.app`               |
| macOS (Intel)         | `.dmg` / `.app`               |
| Linux x86_64          | `.deb` / `.rpm` / `.AppImage` |
| Linux ARM64           | `.deb` / `.AppImage`          |
| Windows x86_64        | `.msi` / `.exe`               |
| FreeBSD x86_64        | `.tar.gz`                     |

See `.github/workflows/package.yml` for details.

---

## Cross-platform support

| Platform         | Support                 | Notes                                                                     |
| ---------------- | ----------------------- | ------------------------------------------------------------------------- |
| macOS 12+        | ✅ Native (ARM + Intel) | Full native experience                                                    |
| Windows 10+      | ✅ Native (x86_64)      | Full native experience                                                    |
| Linux (x86_64)   | ✅ Native               | deb, rpm, AppImage                                                        |
| Linux (ARM64)    | ✅ Native               | Raspberry Pi 4+, ARM servers                                              |
| FreeBSD (x86_64) | ✅ Native               | Cross-compiled from Linux                                                 |
| Other BSDs       | 🟡 Linux compat         | Linux x86_64 binaries work via FreeBSD Linux ABI                          |
| Harmony OS       | 📱 Web app              | Use the GitHub Pages deployment as a PWA until native Tauri support lands |

---

## Packages used

| Package                                                                                    | Purpose                        |
| ------------------------------------------------------------------------------------------ | ------------------------------ |
| [Tauri v2](https://v2.tauri.app)                                                           | Desktop shell (Rust + webview) |
| [NestJS](https://nestjs.com)                                                               | Engine runtime + module system |
| [Fastify](https://fastify.dev)                                                             | HTTP server (inside engine)    |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                               | SQLite driver                  |
| [Drizzle ORM](https://orm.drizzle.team)                                                    | Type-safe database queries     |
| [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)                                | AI workflow orchestration      |
| [React 18](https://react.dev)                                                              | UI framework                   |
| [Tailwind CSS](https://tailwindcss.com)                                                    | Styling                        |
| [react-i18next](https://react.i18next.com)                                                 | Internationalization           |
| [@persian-tools/persian-tools](https://www.npmjs.com/package/@persian-tools/persian-tools) | Persian text normalization     |
| [iso-639-1](https://www.npmjs.com/package/iso-639-1)                                       | Standard language codes        |

---

## Screenshots

<!-- TODO: Add screenshots once GitHub Pages is live -->

| Today's Brief | Search        | Settings      |
| ------------- | ------------- | ------------- |
| _Coming soon_ | _Coming soon_ | _Coming soon_ |

---

## Project status

Version **1.3.0** — active development. See [CHANGELOG](/apps/desktop/src/features/changelog/changelog-data.ts)
or open the app and visit **Settings → Changelog**.

### Roadmap

- [x] Core engine: collection, normalization, intelligence, FTS5 search, backup
- [x] Desktop app: brief, search, sources, settings, insights
- [x] i18n (English + Persian), RTL support, dark mode
- [x] Background jobs with live progress
- [x] 4 LLM providers (OpenAI, Claude, Gemini, Groq)
- [x] CI/CD: automated builds for 6 platforms
- [ ] Android / iOS mobile builds (Tauri v2 mobile)
- [ ] Harmony OS native support (pending Tauri/OHOS ecosystem)
- [ ] Plugin system for custom sources & analyzers

---

## License

Open Source (TBD). See [LICENSE](LICENSE) (once chosen).

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/omidnw">Omid Reza Keshtkar</a></sub>
</p>
