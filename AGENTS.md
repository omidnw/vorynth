# AGENTS.md — Vorynth

## Project Identity

Vorynth is a local-first **Personal Intelligence Engine** desktop app. It turns the flood of global technical information (articles, releases, security announcements) into a short, ranked intelligence brief — with AI-generated context (Why It Matters / Impact / Recommended Action) and full user ownership of data.

> "Less reading. More understanding." — see `project-details.md` for the full vision, `roadmap.md` for where the project stands.

## Architecture

```
Vorynth Desktop Application (Tauri v2 shell)
        │  spawns sidecar, polls /health, injects port (34117)
        ▼
Vorynth Core Engine (NestJS + Fastify)
        │
        ├── Data Layer      SQLite + better-sqlite3 + Drizzle ORM
        ├── Intelligence    LangGraph workflow (Collector → Normalizer → Ranker → Analyzer → Localizer)
        ├── LLM Layer       Gemini / OpenAI / Anthropic / Ollama (abstraction + rate limiter)
        └── Source Layer    RSS / GitHub releases / arXiv adapters
```

- Frontend must not contain business logic — React UI talks to the engine API only (project-details.md §16).
- Database: single SQLite file at `apps/core-engine/data/vorynth.sqlite`.
- FTS5: `articles_fts` virtual table — synced at application level (no triggers).
- Text normalization: `@persian-tools/persian-tools` + `Intl.Segmenter`.

## Tech Stack

| Layer        | Location            | Stack                                           |
| ------------ | ------------------- | ----------------------------------------------- |
| Core engine  | `apps/core-engine/` | NestJS + Fastify + better-sqlite3 + Drizzle ORM |
| Desktop      | `apps/desktop/`     | React + Vite + Tailwind CSS + Tauri v2          |
| Landing      | `apps/landing/`     | Vite + React + TS (GitHub Pages)                |
| Shared types | `packages/types/`   | TypeScript interfaces only                      |

## Directory Map

- `apps/core-engine/src/modules/` — one folder per capability (sources, crawler, intelligence, llm, search, jobs, backup, history, media, profile, scheduler, news, crypto, health)
- `apps/core-engine/src/modules/plugins/` — plugin registry, `.vorynth-plugin` install, and the security scanner (`security-scan.ts`); `.semgrep/plugin-bundles.yml` mirrors the scanner's checklist for first-party plugin source in CI (R-A13)
- `apps/core-engine/src/db/` — `schema.ts` (Drizzle) + `ddl.ts` (raw additive DDL, `ADDITIVE_DDLS` array)
- `apps/desktop/src/pages/` — route pages; `apps/desktop/src/features/` — per-feature UI; `apps/desktop/src/i18n/en.ts` — all UI strings
- `apps/landing/` — Vite + React landing page (GitHub Pages): `src/theme.css` imports the app's real tokens (`desktop/src/styles/theme.css`), `src/content.ts` derives the version from `VORYNTH_VERSION`, `src/download.ts` owns the platform/asset download detection
- `packages/types/src/index.ts` — shared types + `VORYNTH_VERSION`
- `.agents/skills/` — project skills; `roadmap.md` — status + session archive

## Development Commands

```bash
pnpm install              # install
pnpm dev                  # run core-engine + desktop concurrently
pnpm dev:core             # core engine only
pnpm dev:desktop          # desktop only
pnpm dev:landing          # landing page only (vite dev, builds @vorynth/types first)
pnpm --filter @vorynth/landing build   # build the landing page (GitHub Pages)
pnpm typecheck            # all packages
pnpm lint                 # all packages
pnpm test                 # all test suites (jest + vitest)
pnpm --filter @vorynth/core-engine test   # backend jest (see /testing-backend)
pnpm --filter @vorynth/desktop test       # frontend vitest (see /testing-frontend)
pnpm --filter @vorynth/landing test       # landing vitest (download logic + smoke render)
pnpm format               # prettier --write everything
pnpm version:sync         # version → all targets (see /version-sync)
pnpm version:check        # verify version files match
```

**Backend dev must use `nest start --watch`** — NOT tsx/esbuild: esbuild lacks `emitDecoratorMetadata`, which breaks NestJS DI.

## Agent Behavior

- **Do not assume requirements** — when ambiguity affects architecture or behavior, ask before coding.
- **Prefer inspecting existing code** over inventing new patterns — match the module you're extending.
- **Avoid unnecessary refactoring** — change what the task requires, preserve everything else.
- **Smallest change that satisfies the requirement** — a fix is not an excuse to redesign.
- **Preserve existing behavior** unless the task explicitly changes it.
- **Report honestly** — if something is partial, unverified, or failed, say so plainly.

## Coding Standards

- **Indentation:** tabs, not spaces.
- **Language:** TypeScript strict mode.
- **Idiom:** match surrounding comment density, naming (`camelCase` vars/functions, `PascalCase` classes/types, `SCREAMING_SNAKE_CASE` constants), and module pattern.
- **Quotes:** double for TypeScript, single for SQL strings inside TypeScript.
- **Imports:** `import type` for type-only imports.
- **Exports:** named exports only (no `export default`).
- **UI strings:** every user-facing string through `useTranslation()`, living in `apps/desktop/src/i18n/en.ts`.

## Decision Principles

When multiple solutions exist, prefer in this order:

1. Existing patterns over new abstractions.
2. Simple solutions over flexible solutions.
3. Reversible changes over irreversible ones.
4. Fewer dependencies over more (see `/standard-packages`).
5. Maintainability over cleverness.

# Rules Priority

When rules conflict, higher priority wins.

## Critical Rules — cannot be violated

- **R-C01 — Never commit or push without explicit user approval.** "commit", "push", "submit PR" are explicit; "go ahead", "do it", "fix it" are NOT. If in doubt, ask.
- **R-C02 — Backup the DB before any destructive operation** (migration, schema change, data manipulation, `rm`/`drop`/`delete`, DB-touching refactor):

  ```bash
  cp apps/core-engine/data/vorynth.sqlite apps/core-engine/data/backups/vorynth-$(date -u +%Y-%m-%dT%H-%M-%SZ).sqlite
  ```

  Or use `/backup`. The one exception: reading a file or `pnpm typecheck` — safe.

- **R-C03 — Never `void` a Drizzle write.** Inserts/updates only execute when awaited (lazy driver); a fire-and-forget write silently vanishes. Await every write; log failures, don't swallow them.
- **R-C04 — Never fabricate intelligence results.** AI output is generated from real collected content — if the data doesn't support a claim, the output must not invent it. Never fake "pending" insights or pretend work happened when it didn't.

## Architecture Rules — design constraints

- **R-A01 — Additive DDL only.** `schema.ts` (Drizzle) and `ddl.ts` (raw `ADDITIVE_DDLS`) stay in sync, in parallel. Never edit a shipped `CREATE TABLE` — use `ALTER TABLE ADD COLUMN` (NOT NULL columns need a DEFAULT). See `/db-migration`.
- **R-A02 — Explicit `@Inject(Token)` in NestJS constructors.** ESLint `consistent-type-imports` strips `emitDecoratorMetadata` — implicit DI breaks.
- **R-A03 — News mode must work with NO API key.** LLM is an enhancement, never a hard dependency.
- **R-A04 — Frontend has no business logic** — no direct DB/LLM access from React; everything through the engine API.
- **R-A05 — Separate collected facts from AI interpretation** — raw article content and AI-generated analysis are distinct data, stored and presented as such.
- **R-A06 — LLM output is untrusted data.** Validate/parse it before storage (JSON shape, citation markers, language). Never execute it.
- **R-A07 — 10 UI languages ship bundled** (en, fa, ar, ko, ja, zh, he, es, de, ru) with in-repo catalogs in `apps/desktop/src/i18n/` (all type-checked against `en.ts`); any other language arrives via a user-imported catalog. Never hardcode a foreign-language UI string in component code — every UI string goes through i18n. RTL via `dir="auto"` (direction derived from the locale code). AI output language (`preferredIntelligenceLanguage`) is independent of UI language.
- **R-A08 — Insights carry their sources; explainability is a feature.** Every generated insight stores references to the articles it came from, and the UI can show them (citations `[N]`, source lists). If a reader can't tell _why_ an insight exists, the feature is incomplete — citations were silently dropped once (v1.0.2); don't regress.
- **R-A09 — Domain data integrity: never duplicate mutable domain data into derived/index/cache tables.** Organization tables (e.g. `content_items`) are metadata-only — title/url/author live in the origin tables and are joined at read time. Duplicated truth drifts (FTS drift was a symptom of exactly this); derived tables must reference source records or be rebuildable.
- **R-A10 — Domain ownership: user-owned references must never disappear silently.** A bookmark is user ownership of a reference. Any operation that could destroy user-owned data must preserve it, require explicit confirmation, or offer a recovery path — e.g. retention pruning skips bookmarked articles; source deletion is refused (`409 BOOKMARKED_ARTICLES_EXIST`) until the user confirms with `?force=true`.
- **R-A11 — Archive collections: categories are semantic roots, folders are manual organization.** Category contains folders only; folder contains folders or items; items live at leaves; max depth 3 (`MAX_COLLECTION_DEPTH`, soft service constant). Deleting a collection moves its items to uncategorized — never cascades content deletion.
- **R-A12 — Never use native browser dialogs.** `window.confirm`, `window.alert`, and `window.prompt` break the Vorynth visual language and can't be themed or made accessible. Use the `<ConfirmDialog>` component (`components/ui/ConfirmDialog.tsx`) for all confirmations, alerts, and prompts. It matches the theme, supports keyboard navigation, `role="alertdialog"`, and an optional "don't ask again" toggle. No exceptions — grep for `window.confirm` / `window.alert` / `window.prompt` before finishing a feature.
- **R-A13 — Plugin code is untrusted; the SDK is the capability boundary.** Built-in Vorynth plugins are trusted and never scanned. User-installed plugins get a static security scan at install + every Scan; HIGH-severity flags gate enabling behind a one-time per-plugin confirmation. Plugins run through a narrow host SDK — never the raw engine API — with a strict CSP as defense-in-depth. Keep the scanner's pattern table (`security-scan.ts`) and the Semgrep ruleset (`.semgrep/plugin-bundles.yml`) in sync when adding or changing a pattern.

## Development Rules — coding preferences

- **R-D01 — Version changes MUST use `/version-sync`** — root `package.json` by hand → `pnpm version:sync` → README + codenames by hand → rebuild `@vorynth/types` → `pnpm version:check`. The landing page derives its version from `VORYNTH_VERSION` (`apps/landing/src/content.ts`) — no manual edit needed there.
- **R-D02 — After touching `@vorynth/types`, rebuild it** — `nest start --watch` does not hot-reload workspace deps; stale types cause stale-version traps.
- **R-D03 — Sidecar bundle goes to `dist-bundle/`** (ncc), NOT `dist/`.
- **R-D04 — Standard packages over hand-rolled code** — check `/standard-packages` before writing custom logic for language lists, dates, normalization, etc.
- **R-D05 — New dependencies require justification.** Before adding a package: check if existing dependencies or native APIs already solve the problem; prefer maintained, lightweight packages; avoid dependencies for trivial utilities (see `/standard-packages` quality bar).
- **R-D06 — Every page/feature ships with its in-app docs section.** A feature is not complete until the in-app Documentation page has its section (one file per page in `apps/desktop/src/features/docs/sections/`, rich blocks: paragraphs, icon-labeled `features` rows, `flow` diagrams, bullets) with **bidirectional links** (page → `/docs#<id>` and section → page). Every button/option/capability the page has must be findable as an icon-labeled row, not buried in prose. Follow `/docs-update`; never describe behavior the code doesn't do.
- **R-D07 — Every interactive element is self-explanatory.** No control without guidance: every input has a placeholder and a visible unit/hint (e.g. "e.g. 45" + "days" + "keeps the last N days"), every icon button has an `aria-label`, and every option in a selector that needs explanation carries it. **Never add decorative, non-functional elements** (icons that don't act, buttons that do nothing) — if it looks interactive it must do something. Follow `/ui-guidance`.
- **R-D08 — Every panel that opens or closes animates.** Any mount/unmount of a dialog, drawer, dropdown, sub-list, or matched search section uses the shared motion primitives (`components/ui/Reveal.tsx` + the `animate-fade-in` / `animate-scale-in` / `animate-slide-in-*` utilities in tailwind.config.ts). Instant pops are a bug — including exit (elements stay mounted one frame to fade out). New overlays must ship with an enter animation from day one.
- **R-D09 — Structural UI/UX changes require approval BEFORE implementation.** Adding/removing/moving page sections, tabs, navigation, or reordering flows changes how the product feels, and whether a UX is usable is a human judgment, not a model's. Present a short proposal (what moves/added/removed + the resulting UX) and wait for explicit approval before coding (see `/ui-ux-approval`). Trivial tweaks (wording, colors, spacing, icons) proceed normally.

## Quality Rules — verification requirements

- **R-Q01 — Every code change ends with relevant verification.** Scope the verification to what changed:

  ```
  Code           → pnpm --filter @vorynth/core-engine typecheck + pnpm --filter @vorynth/desktop typecheck
  UI only        → desktop typecheck + manual view of the affected screen
  In-app docs    → desktop typecheck (docs-data.ts / sections/ are strict TypeScript)
  Database       → migration validation (/db-migration) + typecheck
  Docs only      → no verification needed (AGENTS.md, roadmap.md, README, changelog)
  ```

  (Plus `/code-quality` for lint/format on touched files.)

- **R-Q02 — Testing state must be kept current.** The current state of automated tests is documented in #Testing Strategy below — when that changes (tests introduced, coverage added), update that section, not this rule.

# Change Protocol

Every modification follows this loop — never skip to "Modify":

1. **Understand** — what does this code do, what is the user asking, what is the current state (`roadmap.md` snapshot)?
2. **Inspect** — read the file before editing; check schema/DDL, routes, i18n, shared types.
3. **Plan** — decide approach; consult the matching skill (`/db-migration`, `/changelog`, `/backup`, …).
4. **Confirm** — if the change is risky (migration, architecture change, security, destructive) or a **structural UI/UX change** (tabs, sections, flows, navigation — `/ui-ux-approval`), present the plan and get the user's explicit go-ahead before modifying. Small reversible changes can proceed.
5. **Modify** — smallest change that satisfies the requirement; match surrounding idiom.
6. **Verify** — typecheck both apps, lint, run the affected flow, confirm no regression.
7. **Summarize** — report what changed, what was verified, and any limitations. Leave an auditable trail (files touched, decisions made, what wasn't tested).

# Available Skills

| Skill                   | When                                                                                                                                         | Risk      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `/backup`               | Before any destructive DB operation                                                                                                          | 🔴 High   |
| `/db-migration`         | Schema changes (table/column/index)                                                                                                          | 🔴 High   |
| `/version-sync`         | Any version bump                                                                                                                             | 🟡 Medium |
| `/changelog`            | Meaningful user-visible work ships                                                                                                           | 🟡 Medium |
| `/github-release-notes` | GitHub release title + body in the established style (asks for the previous release's notes as reference)                                    | 🟢 Low    |
| `/session-archive`      | Session/chat ends — record in `roadmap.md`                                                                                                   | 🟢 Low    |
| `/standard-packages`    | Before hand-rolling anything standardised                                                                                                    | 🟢 Low    |
| `/testing-backend`      | Backend Jest tests — every feature ships with tests                                                                                          | 🟢 Low    |
| `/testing-frontend`     | Frontend Vitest + Playwright tests (aria/role only, no data-test-id)                                                                         | 🟢 Low    |
| `/docs-update`          | Every new page/feature ships its in-app docs section (rich blocks: icon features, flow, one file per page)                                   | 🟢 Low    |
| `/landing`              | Any work on the GitHub Pages landing site (`apps/landing`) — a separate app from the desktop, rendering the real screens as a mocked preview | 🟢 Low    |
| `/ui-ux-approval`       | Structural page/UX changes (tabs, sections, flows, nav) — propose to the user BEFORE coding; the user judges usability                 | 🟡 Medium |
| `/ui-guidance`          | Every interactive element is self-explanatory (placeholder, unit, hint, aria-label; no decorative controls)                                  | 🟢 Low    |
| `/build-macos`          | Build the macOS app (engine sidecar → stage → `cargo tauri build`) and install to /Applications; debug the packaged engine                  | 🟢 Low    |
| `/homebrew-cask`        | Homebrew distribution: bump the personal tap (`omidnw/homebrew-vorynth`) per release; publish the cask to the official homebrew-cask repo   | 🟢 Low    |

**Personal workflows** (user-level, `~/.agents/skills/` — apply in every project, not Vorynth-specific): `code-quality` (formatters/linters/typecheck on changed files) · `external-ai-consult` (front-load research questions to an external AI before heavy tasks) · `always-english` (respond in English).

> **Skill standard:** every skill follows the section order Purpose → When to use → Preconditions → Workflow → Rules → Common mistakes → Validation, and the two-times-pain rule decides what gets written at all. See "The Agent Docs Standard" in `~/.zcode/AGENTS.md`.

> Rules are not skills. Commit-approval, English-only responses, and backup are **Critical Rules** above — always active, not loadable skills.

# Testing Strategy

- **Backend (core-engine): Jest + ts-jest** — throwaway temp-SQLite harness (`test/helpers/db.ts` → `createTestDb()`) + offline mocked `LlmProvider` (`test/helpers/mock-llm.ts`); tests never touch the real DB or the network. Domain-invariant tests live in `test/domain/invariants/` and prove the app's business laws (spine-without-origin, bookmark→missing item, retention-vs-bookmark, tree depth). See `/testing-backend`.
- **Frontend (desktop): Vitest + Testing Library** for component tests, **Playwright** for e2e critical journeys. No `data-test-id` — selectors are roles, aria-labels, and standard HTML tags (the tests double as the a11y contract). See `/testing-frontend`.
- **Landing (apps/landing): Vitest + Testing Library** — unit tests for the platform/download-asset logic (`download.test.ts`) + a smoke render of the page (`App.test.tsx`). See `/testing-frontend`.
- **Storybook**: component + page stories with mock data (scaffold planned).
- LLM/usage-path fixes must still be verified against a real provider call (rate limit 5 req/min in dev — be patient); automated tests use the mocked provider.
- Run: `pnpm --filter @vorynth/core-engine test` · `pnpm --filter @vorynth/desktop test` · `pnpm --filter @vorynth/desktop test:e2e` (once e2e lands).

# Deployment

- **Release targets (CI-built, downloadable):** Windows x64 + ARM64, macOS Apple Silicon + Intel (Intel is cross-compiled on an Apple Silicon runner, `x64` DMG suffix), Linux x86_64 + ARM64 (deb/rpm/AppImage), FreeBSD (native VM build).
- **Experimental:** HarmonyOS NEXT (ARM64 `.so` + frontend bundle via CI — raw DevEco Studio bundle, no `.hap` yet).
- Releases: draft GitHub Release on `v*` tag push (`tauri-apps/tauri-action`), English title/description.
- **Release gating (`package.yml`):** Semgrep security scan → `verify` (version:check → types build → `pnpm test` → typecheck → lint → format:check → build) → packaging. Packaging jobs `needs: [security, verify]` — no artifact is built unless the security scan and the full verify gate are green.
- Landing page: `omidnw.github.io/vorynth/` built from `apps/landing` (Vite, base `/vorynth/`) by `pages.yml` — triggers on `apps/landing/**` and `docs/**` (doc-only changes skip CI but still deploy Pages).
- Version badges on README/docs are dynamic (shields.io) — no manual badge edits.

# Important Notes

> This section is ONLY for hidden traps, non-obvious decisions, and things that caused bugs. General info lives in docs, not here.

- Port: the Tauri shell probes for a free port at launch (`pick_free_port` — 34117 by default, a higher one when taken) and hands it to the frontend via the `engine_port` IPC command (`initCoreBaseUrl()` in `main.tsx` resolves it before render; it also probes `/health` upward as a fallback). The engine resolves `--port` → `PORT` env → fallback `34117`. In dev the frontend always uses 34117, so the dev engine must too. The legacy `__vp` URL-param and `__VORYNTH_CORE_PORT__` init-script paths are dead in the packaged webview (init scripts run in an isolated world) — don't rely on them.
- **No CSP in the packaged app** (`app.security.csp: null`): any custom CSP breaks the WKWebView webview on the `tauri://` scheme — scripts never execute, page stays blank, and the Tauri IPC bridge (`__TAURI_INTERNALS__`) never loads. v1.7.0 had no CSP and worked; do NOT re-add one without testing in the packaged build. Plugin security relies on the scanner (R-A13) + the narrow SDK boundary instead.
- Rate limiter: even-spaced leaky bucket — `VORYNTH_LLM_SPACING_MS` direct control, otherwise derived from `VORYNTH_LLM_RPM` (default 5/min → 12s spacing). Long jobs must respect it or they'll silently fail. Timing tests must use `jest.useFakeTimers()` — wall-clock assertions flake under parallel Jest (a late sleep lets the next slot age out, and the next call legitimately goes through immediately).
- Plugin security lives in two places that must stay in sync: the runtime scanner (`apps/core-engine/src/modules/plugins/security-scan.ts`) and the Semgrep ruleset (`.semgrep/plugin-bundles.yml`). Adding a pattern to one but not the other makes the CI gate and the runtime gate drift apart (R-A13).
- Backup flavors: `.vorynth-backup` = engine BackupService; `.sqlite` = `/backup` skill copies. Don't confuse them.
- `examples/` is UI/UX inspiration only — never copy code from it. `project-details.md` is the spec.
- **Project history lives in `roadmap.md`** — snapshot of where the project stands + the full session archive. Read it first when picking up work; when a chat ends, archive the session there via `/session-archive`.
