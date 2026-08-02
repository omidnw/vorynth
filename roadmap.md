# Vorynth — Roadmap & Status

> Live document. Last updated: 2026-08-01.
>
> How to read this file: it maps where Vorynth stands against the spec in
> [project-details.md](./project-details.md) — what is fully implemented,
> what is partial, what is missing — and describes how the project moves
> forward from here (feedback-driven development).

---

## 1. Where we are — snapshot

| Item | Value |
| --- | --- |
| Current release | **v1.6.0 "Navigate the Maze"** |
| Release history | v1.0.0 → v1.6.0 (8 releases) |
| Working tree | 1.6.0 feature work landed (archive, bookmarks, docs, tests), **uncommitted** |
| Core engine | NestJS + Fastify + better-sqlite3 + Drizzle ORM — 16 modules |
| Desktop | React 18 + Vite + Tailwind + Tauri v2 — 18 pages (+ in-app docs) |
| Shared types | `@vorynth/types` — single source of truth for version (`VORYNTH_VERSION`) |
| DB | Single SQLite file, FTS5 full-text search (title+content+author), auto-migrate on boot, archive spine (`content_items`) + bookmarks + collections |
| Tests | Jest (engine, incl. domain invariants) + Vitest (UI) + Storybook + Playwright (planned) |
| Target users | Software / AI engineers, researchers, developers |

**One-line summary:** the core product loop works end-to-end — collect from
13+ sources, rank, analyze with an LLM (or pure news mode with no key),
browse the brief, search (keyword + Ask AI), keep history, read full
articles, and manage it all locally with backups. v1.6.0 adds the Archive
(unified user-owned space: collections, tags, notes, bookmarks), an in-app
Documentation/Tutorial page with transparency, search relocation into the
Archive, source range windows, and the first automated test suite. The
biggest gaps are the **plugin/source-adapter system** (only RSS + GitHub +
arXiv adapters exist), **weekly/monthly scheduled reports**, and
**LLM-assisted archive organization** (deferred to the next release —
manual-first).
in-flight work is already addressing.

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
  + `@persian-tools/persian-tools` normalization (NFKC, char unification).
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
- ✅ RTL support via `dir="auto"` on all AI content blocks.
- ✅ i18n — ships English; user exports catalog, translates, imports back.
  (Persian intentionally not bundled — decided.)
- ✅ Light ("Precision Minimalism") + Dark ("Obsidian Intelligence") themes
  with Material 3 color tokens from day one.

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

### Source / plugin architecture (project-details §27–30) — biggest gap

| Spec item | Status |
| --- | --- |
| RSS adapter | ✅ implemented |
| GitHub (releases) adapter | ✅ implemented |
| arXiv adapter | ✅ implemented |
| Reddit adapter | ❌ missing |
| Website-crawler / custom HTML adapter | ❌ missing |
| "Add New Source" UI with method (RSS/API/HTML/Sitemap) | 🟡 partial — Sources page exists, but only RSS/GitHub/arXiv flows are fully wired |
| Custom selector HTML crawling (title/content/date selectors) | ❌ missing |
| Plugin management (install/configure in UI) | 🟡 `plugins` table exists, no real plugin runtime/UI |

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

- 🟡 **Known bug:** `BackupService.restore()` closes the SQLite DB and may
  never reopen it (identified in session `sess_ed965272`) → engine left with
  a dead DB handle after restore. **Needs verification & fix.**
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

- 🟡 Intel (x86_64) macOS DMG is not built → landing page shows "support
  coming soon" for Intel Macs.
- 🟡 FreeBSD x86_64 CI has been flaky (webkit2-gtk package naming); HarmonyOS
  NDK/SDK URL was a placeholder that must stay verified.
- 🟡 Windows CI hangs (Node 24 spawn `shell:true`, `.tsbuildinfo` lock) —
  fixes designed, unconfirmed fully landed.

### Dark theme

- 🟡 Dark-mode hover/contrast fixes landed for `Button`, `ThemeToggle`, and
  the intelligence detail view; the **full-codebase dark-theme audit**
  (user-requested sweep for bad token pairings) is **incomplete**.

---

## 4. In-flight work (uncommitted — working tree) 🚧

These are the changes sitting in the working tree right now (24 files,
+1510/−613). They form the next release (likely v1.6.0):

1. **LLM Mode & Provider Selection** — explicit "intelligence vs news" mode
   (`engine.mode` app setting), active-provider selection
   (`engine.activeProviderId`), `isAvailable()` decoupled from live `verify()`,
   mode card under Engine Status, delete-provider confirmation with
   "don't show again" + reset.
2. **Generate Story Details** — Settings buttons to regenerate the AI triad
   for all stories (in `preferredIntelligenceLanguage`) and to translate
   story titles (with `originalTitle` toggle); new `"regenerate"` job kind,
   `regenerateAllInsights()` + `translateAllTitles()` in
   `intelligence.service.ts`; `original_title` column via additive DDL.
3. **Dark mode hover/legibility fixes** — `Button.tsx`, `ThemeToggle.tsx`,
   `BriefItemView`, `InsightDetailPage`, `ArticleDetailPage`, floating
   footers.
4. **Settings vs Profile navigation rework** — Settings removed from sidebar
   nav; moved next to Profile in the footer; cross-reference tips on both
   pages.
5. New `Toggle.tsx` UI component; i18n strings added to `en.ts`.

> ⚠️ Per workspace rules, this work is **uncommitted and unreviewed** — it is
> not yet part of any release.

---

## 5. Known issues / technical debt 📋

- Backup restore may leave the engine without a live DB handle (§3).
- Mixed `.vorynth-backup` / `.sqlite` backup naming.
- FTS5 keyword search can't do cross-script synonyms (delegated to Ask AI).
- No tests tracked so far — verification is manual (typecheck + run).
- Intel macOS build missing; FreeBSD/HarmonyOS CI historically flaky.
- `plugins` table is a stub — no plugin runtime.
- Several early-session fixes (verify-button real request, SearchService DI,
  time-scoped summaries) were listed as pending; most were later confirmed
  done, but a **fresh pass/fail audit against this list is recommended**
  before the next release (the 97/141-item verification from
  `sess_9406b58f` was never completed).

---

## 6. Where we are vs. project-details.md — coverage map

| project-details.md area | Coverage |
| --- | --- |
| §10–12 Product workflow | ✅ Core loop complete |
| §14–18 Architecture / engine structure | ✅ Implemented (module layout matches) |
| §19–21 Database entities | 🟡 Tables exist; clustering/reports partially used |
| §22–23 Multilingual AI pipeline | ✅ Dual language + RTL complete |
| §24 LLM provider abstraction | ✅ 4 providers + encryption + rate limit |
| §25–26 AI workflow | ✅ LangGraph 5-node graph |
| §27–30 Source plugins | ❌ **Main gap** — only 3 adapters; no plugin runtime |
| §31 Scheduling | 🟡 30-min collect + daily report; no weekly/monthly |
| §32 Local-first / privacy | ✅ Backup/restore/delete-all, offline reading, local keys |
| §33 Tech stack | ✅ Stack matches spec |

**Bottom line:** roughly **85–90% of the v1.0 spec surface is implemented**;
the remaining 10–15% concentrates in the source-adapter/plugin layer,
scheduled weekly/monthly reports, and polish/verification work.

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

1. **Close the open bugs** — backup-restore DB handle, FTS5 edge cases,
   dark-theme audit sweep, CI stability (Windows/FreeBSD/HarmonyOS).
2. **Verify the pending 97/141 checklist** item-by-item (audit from
   `sess_9406b58f` was never finished) — produce a pass/fail report.
3. **Land v1.6.0** (in-flight work in §4) + changelog entry.
4. **Ship the feedback channel** (§7.1) before broad user testing.
5. Depending on feedback volume: plugin/adapter system (most likely
   requested next) or weekly/monthly reports.

---

## 8. Session archive (for traceability)

Full context of every working session is retrievable via ZCode session IDs:

| # | Session | Theme / work |
| --- | --- | --- |
| 1 | `sess_e2406556` | UI design (Tailwind + Google Fonts), vertical-slice plan, news-first decision |
| 2 | `sess_5c70f7ec` | Changelog skill creation |
| 3 | `sess_9406b58f` | 97/141 progress-list verification (unfinished) |
| 4 | `sess_7312c6e9` | Usage tracking fix (Drizzle lazy-exec) + changelog |
| 5 | `sess_c3885f9e` | v1.1.0 — reader, profile, media, re-collect-all, bug fixes |
| 6 | `sess_f9a9a5a7` | History detail pages, search redesign, v1.2.0 version centralization |
| 7 | `sess_ce3b0ab7` | Citation fix `[1,3,5]`, sources list, history drawer |
| 8 | `sess_a923f5c7` | FTS5 + multilingual tokenizer (Persian/English) |
| 9 | `sess_7917bd54` | Dual language models, RTL, iso-639-1, package-policy skill |
| 10 | `sess_ed965272` | Backup 400/500 diagnosis (restore never reopens DB) |
| 11 | `sess_da2e918b` | README/docs/CI + HarmonyOS pipeline |
| 12 | `sess_0c8154f0` | CI fixes — FreeBSD, Windows MSVC, fixed port 34117 |
| 13 | `sess_553abe67` | Landing page + CI path isolation |
| 14 | `sess_e47e7a0f` | v1.5.0 prep — version source of truth, favicon, CORS |
| 15 | `sess_90936216` | Windows ESM bundle crash, portable Node, ARM64 CI |
| 16 | `sess_a95a1763` | Windows bundle hang fix (ncc sidecar) |
| 17 | `sess_1fb9697a` | v1.5.0 release, version-sync script, Windows tsc hang |
| 18 | `sess_d961863c` | Settings vs Profile navigation confusion |
| 19 | `sess_5873572b` | Public materials — README, landing page, download button |
| 20 | `sess_19f6965e` | LLM mode & provider selection fix |
| 21 | `sess_ef112d23` | Generate story details (triad regen + title translation) |
| 22 | `sess_fdbaf45a` | Dark mode hover/legibility fixes |
| 23 | `sess_57dbd86b` | Review of latest changes (this handoff chain) |
| 24 | `sess_8893f94a` | v1.6.0 "Navigate the Maze" — archive (content_items spine, bookmarks, collections/tags/notes), docs page + transparency, search relocation, author/advanced search, sources range windows, test foundation (Jest+Vitest+Playwright+Storybook), changelog general/technical split |
