# Vorynth — Roadmap & Status

> Live document. Last updated: 2026-08-10.
>
> How to read this file: it maps where Vorynth stands against the spec in
> [project-details.md](./project-details.md) — what is fully implemented,
> what is partial, what is missing — and describes how the project moves
> forward from here (feedback-driven development).

---

## 1. Where we are — snapshot

| Item            | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current release | **v1.8.0 "Extend The Signal"**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Release history | v1.0.0 → v1.8.0 (11 releases)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Working tree    | v1.8.1 UX pass landed, **uncommitted**: onboarding provider model + official-sources prompt fix; brief search + default-view selector + insight-first auto-switch; view chips; persisted mark-as-read + viewed-history check; script-based title translation; auto-generate missing insights after collect (Intelligence mode); docs search; per-card settings search; history drawer (all surfaces + filter) + search-page history; archive sidebar submenu (inpage fallback); header icon labels + bigger icons; scroll-to-top; large-monitor scaling; dark-theme contrast; Add Source required fields + Test validation; network/Developer settings (earlier) + packaged-Linux engine fix (sidecar path) + per-OS smoke tests + macOS Intel cross-compile + landing download modal. Latest: source tags (live suggestions), Profile education fields, Settings backup list (download/delete), story-view history tab, Takeaway relabel, auto-translate after collect (LLM-gated), insight-first card view, robust back-button detection (trailing-slash fix), ui-ux-approval skill, POLICY.md (first policy: connector sourcing) |
| Core engine     | NestJS + Fastify + better-sqlite3 + Drizzle ORM — 21 modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Desktop         | React 18 + Vite + Tailwind + Tauri v2 — 32 pages (+ in-app docs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Shared types    | `@vorynth/types` — single source of truth for version (`VORYNTH_VERSION`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| DB              | Single SQLite file, FTS5 full-text search (title+content+author), auto-migrate on boot, archive spine (`content_items`) + bookmarks + collections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tests           | Jest (engine, incl. domain invariants) + Vitest (UI) + Storybook + Playwright (planned)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Target users    | Software / AI engineers, researchers, developers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**One-line summary:** the core product loop works end-to-end — collect from
your sources (RSS, GitHub releases, arXiv, plus HTML-crawler / Sitemap /
JSON-API adapters and curated starter lists), rank, analyze with an
LLM (or pure news mode with no key), browse the brief, search (keyword + Ask
AI), read full articles, and manage it all locally with backups. v1.8.0 ships
the **plugin system** (source adapters + runtime UI plugins + offline icon/font
pack), the **Plugins page**, **official connectors via the GitHub registry**,
and **10 bundled UI languages**. v1.6.0 added the Archive (collections, tags,
notes, bookmarks), in-app Documentation, and the first automated test suites.
The biggest open gaps are scheduled **weekly/monthly reports**,
**LLM-assisted archive organization**, and **community-authored connectors**
(the registry + install flow exist; real off-build connectors come later).

---

## 2. What is implemented ✅

Verified against the current code (changelog data + source tree + session
history). Organized by `project-details.md` section.

### Core product loop (project-details §10–12)

- ✅ **Collection** — 13 seed sources auto-seeded on first launch (OpenAI,
  Hugging Face, GitHub Blog, Martin Fowler, web.dev, Cloudflare, HashiCorp,
  AWS, Krebs, Cloudflare Security, OpenSSF, Rust, Python); zero-config, no
  API key required.
- ✅ **Normalization** — content normalized before analysis.
- ✅ **Duplicate detection** — SHA-256 dedup of `lowercase(title)|publishedAtISO|sourceId`.
- ✅ **Importance ranking** — Ranker node with per-category scoring; sort
  modes on the Brief (Newest / Most relevant / Most important).
- ✅ **AI analysis** — LangGraph workflow, each article gets the triad:
  Why-it-matters / Impact / Recommended action.
- ✅ **Intelligence report** — "Today's Brief" page + period summaries
  (today / this week / this month) with numbered citations.
- ✅ **Desktop app** — the whole loop is reachable from the UI.

### Intelligence / LangGraph (project-details §25–26)

- ✅ Workflow nodes exist and are wired: `Collector → Normalizer → Ranker →
Analyzer → Localizer` (`intelligence/workflows/intelligence.workflow.ts`).
- ✅ Localizer is an LLM-only refinement pass; graceful when no key is set.

### LLM providers (project-details §24, §32.2)

- ✅ 4 providers: **Gemini, OpenAI, Anthropic, Ollama** (local) — all through
  one abstraction (`llm-provider.ts`, `providers/`).
- ✅ API keys encrypted at rest (AES-256-GCM, machine-bound master key).
- ✅ Rate limiter (5 req/min, sliding window, `VORYNTH_LLM_RPM` override).
- ✅ Usage tracking (tokens + requests per op/provider) surfaced in Settings.
- ✅ Mode system — **intelligence vs news**; active-provider selection
  (in-flight, see §4).

### Search (project-details §32.6 / v1.0.0)

- ✅ FTS5 full-text search with `unicode61 remove_diacritics 2` — replaces
  the old `LIKE` search; **Persian + English** support via `Intl.Segmenter`
  - `@persian-tools/persian-tools` normalization (NFKC, char unification).
- ✅ BM25 ranking, `snippet()` highlighting.
- ✅ Ask AI (RAG) search with 24K-token context budget, inline `[N]`
  citations with hover tooltips + click-to-source.

### History (v1.0.2 → v1.2.0)

- ✅ Search history (keyword + Ask AI badges), briefing history, generated
  history — persistent across restarts.
- ✅ Context-aware history drawer (search page → search history, brief page →
  briefing history) with rename / archive / delete / multi-select.
- ✅ Dedicated detail pages: `/history/search/:id`, `/history/brief/:id`,
  `/history/generated/:id`.
- ✅ Recording scopes are user-controlled (Settings toggles).

### Reading & personalization (v1.1.0)

- ✅ Native article reader (`/articles/:id`) with "support the author" modal
  (dismissable, re-enable from Profile).
- ✅ Profile page: identity, custom instruction (with "Improve" AI rewrite),
  AI-generated behavior summary, derived interests.
- ✅ Media control — on-demand fetch, per-item "keep locally", Media page
  with purge-all.

### Localization & UX (project-details §22–23)

- ✅ **Dual language system** — `preferredUiLanguage` (app UI) independent of
  `preferredIntelligenceLanguage` (AI output). Standard `iso-639-1` package
  for the language list (183 languages).
- ✅ RTL support via `dir="auto"` on all AI content blocks; RTL UI layouts
  (fa, ar, he) via logical utilities.
- ✅ i18n — **10 languages ship bundled** (en, fa, ar, ko, ja, zh, he, es, de,
  ru), each with a type-checked catalog; any other language arrives via a
  user-imported catalog (export → translate → import). Language pickers are
  searchable by native name, English name, or code.
- ✅ Light ("Precision Minimalism") + Dark ("Obsidian Intelligence") themes
  with Material 3 color tokens from day one; plugin themes (with their own
  icon and canvas) added in v1.8.0.

### Plugins & source adapters (v1.8.0)

- ✅ **6 source adapters** — RSS, GitHub releases, arXiv, an HTML crawler
  (CSS-selector based), Sitemap, and a generic JSON API — each
  manifest-registered as a plugin with its own icon and config fields.
- ✅ **Plugins page** — enable/disable adapters and UI plugins, Core /
  Installed / Built-in groups, per-plugin badges, "In use / Idle" state,
  install/remove of `.vorynth-plugin` packages.
- ✅ **Runtime UI plugins** — a plugin can add a sidebar page, a Settings
  section, a Documentation guide, or a whole theme; the Reference Plugin
  ships as a working template.
- ✅ **Icon Pack** — offline Lucide / Font Awesome / Material Symbols icons
  and 18 font families (incl. Persian/Arabic, Hebrew, CJK, Devanagari, Thai).
- ✅ **Official connectors + registry** — arXiv is the first
  registry-distributed official connector; the GitHub registry lets
  definitions update without an app update.
- ✅ **Curated source lists** — an official 25-feed Developer & Software
  Engineering starter list, community list import, in-place source editing.
- 🟡 **Community-authored connectors** — the install flow and security
  scanner exist; real off-build connectors are deferred until one exists.

### Platform & release infra (project-details §15–18, §33)

- ✅ Tauri v2 shell + NestJS sidecar lifecycle (spawn, `/health` poll, port
  injection, kill on window close).
- ✅ Runs **without Node installed** — engine bundled via ncc, portable Node
  bundling; native `better-sqlite3` bundled.
- ✅ Fixed port 34117 agreement between engine and frontend.
- ✅ CI: Windows (x64 + ARM64), macOS, Linux, **FreeBSD**, **HarmonyOS**
  pipelines; doc-only changes skip CI.
- ✅ GitHub Pages landing page (`omidnw.github.io/vorynth/`) with OS/arch
  auto-detect download button.
- ✅ Backup / restore / delete-all (`.vorynth-backup` snapshots).
- ✅ Changelog page + version codenames; 5-file version sync script.

---

## 3. What is incomplete / partial 🟡

Truthful list — some of these are known and deferred, others are silent gaps.

### Source / plugin architecture (project-details §27–30) — shipped in v1.8.0

| Spec item                                                    | Status                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| RSS adapter                                                  | ✅ implemented                                                               |
| GitHub (releases) adapter                                    | ✅ implemented                                                               |
| arXiv adapter                                                | ✅ implemented — first registry-distributed official connector               |
| Website-crawler / custom HTML adapter                        | ✅ implemented (v1.8.0)                                                      |
| Sitemap adapter                                              | ✅ implemented (v1.8.0)                                                      |
| JSON API adapter                                             | ✅ implemented (v1.8.0)                                                      |
| "Add New Source" UI with method (RSS/API/HTML/Sitemap)       | ✅ implemented — per-method config fields driven by the adapter plugin       |
| Custom selector HTML crawling (title/content/date selectors) | ✅ implemented (v1.8.0)                                                      |
| Plugin management (install/configure in UI)                  | ✅ implemented — Plugins page, install/remove, enable/disable                |
| Community connectors (user-installed)                        | 🟡 install flow + security scanner exist; real community connectors deferred |

### Reports (project-details §19, §31)

- ✅ Daily intelligence report scheduled (auto-collect every 30 min + daily).
- ❌ **Weekly and monthly reports** are not scheduled — only on-demand period
  summaries (today/week/month) exist.

### Article clustering (project-details §21)

- 🟡 `article_clusters` table exists and the schema models clusters, but
  grouping of related articles into "one intelligence event" is **not a
  first-class pipeline stage** — dedup is by hash only; cluster
  write/read flow is minimal.

### Backup (project-details §32.3–32.4)

- 🟡 **Restore is restart-required by design** — `BackupService.restore()` closes
  the live connection, swaps the file, and tells the caller to restart the
  engine (Drizzle re-reads the schema on boot). The earlier dead-DB-handle
  report (`sess_ed965272`) predates this documented contract — **re-verify**
  the flow against the current code before closing it out.
- 🟡 Two coexisting backup naming conventions (`.vorynth-backup` vs `.sqlite`)
  — confusing; not reconciled.
- ❌ Export formats beyond `.vorynth-backup` (JSON export, encrypted archive)
  not implemented.

### Search limitations

- 🟡 "github ⇄ گیت هاب" cross-language equivalence is **not solvable by FTS5
  alone** — Ask AI mode is the intended answer; keyword mode won't match
  mixed-script synonyms.
- 🟡 `SearchService` DI bug was flagged in early sessions — verify current state.

### Platform coverage

- ✅ Windows package build fixed (v1.7.0-era `package.yml` fixes landed);
  FreeBSD x86_64 CI still historically flaky (webkit2-gtk package naming);
  HarmonyOS NDK/SDK URL must stay verified.
- 🟡 Intel (x86_64) macOS DMG is not published → landing page shows "support
  coming soon" for Intel Macs.

### Dark theme

- 🟡 Dark-mode hover/contrast fixes landed for `Button`, `ThemeToggle`, and
  the intelligence detail view; the **full-codebase dark-theme audit**
  (user-requested sweep for bad token pairings) is **incomplete**.

---

## 4. In-flight work (uncommitted — working tree) 🚧

These are the changes sitting in the working tree right now (~400 files).
The v1.8.0 feature set (below) is landed but **uncommitted**; the landing
work from this session is on top:

1. **v1.8.0 — plugins & adapters** — HTML-crawler, Sitemap, and JSON-API
   adapters; Plugins page (enable/disable, badges, In use/Idle);
   runtime UI plugins (sidebar page, Settings section, Docs guide, theme);
   Reference Plugin; theme picker; offline Icon Pack; install/remove of
   `.vorynth-plugin` packages.
2. **v1.8.0 — official connectors & curated lists** — connector health check,
   GitHub connector registry (arXiv first), 25-feed starter list, community
   list import, in-place source editing.
3. **v1.8.0 — i18n & themes** — 10 bundled UI languages with RTL, searchable
   language pickers, plugin themes with custom icons and canvas.
4. **v1.6.0 + v1.7.0 (committed)** — archive spine + bookmarks + collections
   - in-app Documentation (v1.6.0 "Navigate the Maze"); Collections page,
     Archive redesign, docs deep-links (v1.7.0 "Organize The Signal").
5. **This session — landing product story + docs pages** — origin / FAQ /
   "not an AI chat" copy, English-only preview, and new `#/changelog` +
   `#/roadmap` pages on the landing site.

> ⚠️ Per workspace rules, this work is **uncommitted and unreviewed** — it is
> not yet part of a tagged release commit.

---

## 5. Known issues / technical debt 📋

- Backup restore is restart-required by design — re-verify against current
  code before closing out `sess_ed965272` (§3).
- Mixed `.vorynth-backup` / `.sqlite` backup naming.
- FTS5 keyword search can't do cross-script synonyms (delegated to Ask AI).
- Automated tests exist and grow (engine Jest ~306, desktop Vitest ~324);
  Playwright e2e journeys still planned.
- Intel macOS DMG not published; FreeBSD/HarmonyOS CI historically flaky.
- Several early-session fixes (verify-button real request, SearchService DI,
  time-scoped summaries) were listed as pending; most were later confirmed
  done, but a **fresh pass/fail audit against this list is recommended**
  before the next release (the 97/141-item verification from
  `sess_9406b58f` was never completed).

---

## 6. Where we are vs. project-details.md — coverage map

| project-details.md area                | Coverage                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| §10–12 Product workflow                | ✅ Core loop complete                                                                                            |
| §14–18 Architecture / engine structure | ✅ Implemented (module layout matches)                                                                           |
| §19–21 Database entities               | 🟡 Tables exist; clustering/reports partially used                                                               |
| §22–23 Multilingual AI pipeline        | ✅ Dual language + RTL + 10 bundled UI languages (v1.8.0)                                                        |
| §24 LLM provider abstraction           | ✅ 4 providers + encryption + rate limit                                                                         |
| §25–26 AI workflow                     | ✅ LangGraph 5-node graph                                                                                        |
| §27–30 Source plugins                  | ✅ 7 adapters + plugin runtime/scan + GitHub connector registry (v1.8.0); community-authored connectors deferred |
| §31 Scheduling                         | 🟡 30-min collect + daily report; no weekly/monthly                                                              |
| §32 Local-first / privacy              | ✅ Backup/restore/delete-all, offline reading, local keys                                                        |
| §33 Tech stack                         | ✅ Stack matches spec                                                                                            |

**Connector health (v1.8.0):** every cataloged adapter has ≥1 verified
reference source (`apps/core-engine/src/health/reference-sources.ts`);
`scripts/connector-health.mjs` runs them against the real network (manual CI
run — `workflow_dispatch`). A connector that silently stops collecting now
fails loudly instead of hiding as "no new articles". Services that sell their
API are never probed (legal right ≠ wise to poke) — and ship no adapter.

**Connector registry (v1.8.0):** official connectors are distributed through
the GitHub registry (`connectors/registry.json`, fetched by
`ConnectorRegistryService`) — definitions live-update without an app update,
adapter implementations stay compiled in the engine. Sources auto-provision a
missing official connector on create/Test ("source needs a connector → fetch
it → use it"); the Plugins page has "Check GitHub for connectors". arXiv is
the first registry-distributed official connector.

**Bottom line:** roughly **90%+ of the v1.0 spec surface is implemented**;
the remaining ~10% concentrates in scheduled weekly/monthly reports,
community-authored connectors, LLM-assisted archive organization, and
polish/verification work.

---

## 7. Next phase — feedback-driven development 🎯

From this point the project shifts from "build the spec" to **"listen to
users and iterate."** Proposed loop:

### 7.1 Collect feedback

- **In-app feedback entry point** — a "Send feedback" item (sidebar footer
  or Settings) that opens a prefilled `mailto:omidrezakeshtkar@icloud.com`
  with app version, mode, and a short template (see §7.4).
- **GitHub Issues** template for bug reports and feature requests (labels:
  `bug`, `feature`, `ux`, `feedback`).
- **README tester CTA** (already present) — "if you test it and it works,
  let me know" — keep this active.
- Landing page "Get early access / Give feedback" button.

### 7.2 Triage & prioritize

Each piece of feedback gets classified:

1. **Bug** (product broken) → highest priority, fix in next patch.
2. **Usability friction** (works but confusing) → next minor.
3. **Feature request** → evaluate against vision; queue, defer, or reject.
4. **Signal** (patterns across multiple users) → promote to roadmap item.

Priority = `impact × frequency / effort`. Record every item in a single
**Feedback log** file (e.g. `docs/feedback.md`) so nothing is lost.

### 7.3 Apply changes

- Small, frequent releases (patch/minor) — each one gets a changelog entry
  via the `/changelog` skill (brand codename + `new/improved/fixed/security`).
- Keep the 5-file version sync + `VORYNTH_VERSION` source of truth.
- Keep light/dark themes consistent; keep i18n strings in `en.ts`.
- **Backup the DB before any destructive change** (always).

### 7.4 Feedback template (proposed, for the in-app dialog)

```
App version:            (auto)
Mode:                   Intelligence / News
Provider:               Gemini / OpenAI / Anthropic / Ollama / none

What were you trying to do?
What happened (what did you expect instead)?
How did it feel — confusing, broken, missing, delightful?
Screenshot / steps to reproduce (optional):
```

### 7.5 First candidate roadmap for feedback rounds

1. **Close the open bugs** — re-verify backup restore, FTS5 edge cases,
   dark-theme audit sweep, CI stability (FreeBSD/HarmonyOS).
2. **Verify the pending 97/141 checklist** item-by-item (audit from
   `sess_9406b58f` was never finished) — produce a pass/fail report.
3. **Tag v1.8.0** (the uncommitted work in §4) + changelog entry.
4. **Ship the feedback channel** (§7.1) before broad user testing.
5. Depending on feedback volume: community connectors (the registry +
   install flow exist) or weekly/monthly reports.

---

## 8. Session archive (for traceability)

Full context of every working session is retrievable via ZCode session IDs:

| #   | Session         | Theme / work                                                                                                                                                                                                                                                                     |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `sess_e2406556` | UI design (Tailwind + Google Fonts), vertical-slice plan, news-first decision                                                                                                                                                                                                    |
| 2   | `sess_5c70f7ec` | Changelog skill creation                                                                                                                                                                                                                                                         |
| 3   | `sess_9406b58f` | 97/141 progress-list verification (unfinished)                                                                                                                                                                                                                                   |
| 4   | `sess_7312c6e9` | Usage tracking fix (Drizzle lazy-exec) + changelog                                                                                                                                                                                                                               |
| 5   | `sess_c3885f9e` | v1.1.0 — reader, profile, media, re-collect-all, bug fixes                                                                                                                                                                                                                       |
| 6   | `sess_f9a9a5a7` | History detail pages, search redesign, v1.2.0 version centralization                                                                                                                                                                                                             |
| 7   | `sess_ce3b0ab7` | Citation fix `[1,3,5]`, sources list, history drawer                                                                                                                                                                                                                             |
| 8   | `sess_a923f5c7` | FTS5 + multilingual tokenizer (Persian/English)                                                                                                                                                                                                                                  |
| 9   | `sess_7917bd54` | Dual language models, RTL, iso-639-1, package-policy skill                                                                                                                                                                                                                       |
| 10  | `sess_ed965272` | Backup 400/500 diagnosis (restore never reopens DB)                                                                                                                                                                                                                              |
| 11  | `sess_da2e918b` | README/docs/CI + HarmonyOS pipeline                                                                                                                                                                                                                                              |
| 12  | `sess_0c8154f0` | CI fixes — FreeBSD, Windows MSVC, fixed port 34117                                                                                                                                                                                                                               |
| 13  | `sess_553abe67` | Landing page + CI path isolation                                                                                                                                                                                                                                                 |
| 14  | `sess_e47e7a0f` | v1.5.0 prep — version source of truth, favicon, CORS                                                                                                                                                                                                                             |
| 15  | `sess_90936216` | Windows ESM bundle crash, portable Node, ARM64 CI                                                                                                                                                                                                                                |
| 16  | `sess_a95a1763` | Windows bundle hang fix (ncc sidecar)                                                                                                                                                                                                                                            |
| 17  | `sess_1fb9697a` | v1.5.0 release, version-sync script, Windows tsc hang                                                                                                                                                                                                                            |
| 18  | `sess_d961863c` | Settings vs Profile navigation confusion                                                                                                                                                                                                                                         |
| 19  | `sess_5873572b` | Public materials — README, landing page, download button                                                                                                                                                                                                                         |
| 20  | `sess_19f6965e` | LLM mode & provider selection fix                                                                                                                                                                                                                                                |
| 21  | `sess_ef112d23` | Generate story details (triad regen + title translation)                                                                                                                                                                                                                         |
| 22  | `sess_fdbaf45a` | Dark mode hover/legibility fixes                                                                                                                                                                                                                                                 |
| 23  | `sess_57dbd86b` | Review of latest changes (this handoff chain)                                                                                                                                                                                                                                    |
| 24  | `sess_8893f94a` | v1.6.0 "Navigate the Maze" — archive (content_items spine, bookmarks, collections/tags/notes), docs page + transparency, search relocation, author/advanced search, sources range windows, test foundation (Jest+Vitest+Playwright+Storybook), changelog general/technical split |
| 25  | `sess_e2b5e5c9` | Full i18n sweep (~37 files, 453 keys, 10 languages), LLM error-code clarity (`invokeWithBudget` 400s), Settings/Profile redesign (rail + search)                                                                                                                                 |
| 26  | `sess_b63c275f` | v1.8.0 update testing, source details/data volumes, Homebrew cask + personal tap                                                                                                                                                                                                 |
| 27  | `sess_c3a240ac` | Diagnosed a running translate-one job on the production engine                                                                                                                                                                                                                   |
| 28  | `sess_60cc7052` | Packaged-Linux engine fix (sidecar resource path), per-OS smoke tests, macOS Intel cross-compile on arm64, v1.8.0 changelog entry, landing download modal                                                                                                                        |
| 29  | `sess_20198778` | Landing page — mobile hamburger menu, self-hosted Material Symbols icons (offline), download modal distro guide, FAQ note, dev port 5174                                                                                                                                         |
| 30  | `sess_4e7c331f` | connector-policy.md governance doc — decision table, verified official tier, registry definitions-only, quality bar, maintenance responsibility                                                                                                                                  |
