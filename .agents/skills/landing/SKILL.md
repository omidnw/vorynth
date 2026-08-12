---
name: landing
description: Maintain the Vorynth GitHub Pages landing site (apps/landing). Use whenever a task mentions the landing page, the website, GitHub Pages, omidnw.github.io/vorynth, or "docs/index.html". The landing is a SEPARATE app from the desktop application — its own Vite + React package with its own build and deploy — that renders the REAL desktop screens (ShellLayout + BriefPage) as a static preview backed by a mocked engine.
---

# Landing (GitHub Pages) — Vorynth

## Purpose

The landing site at `omidnw.github.io/vorynth/` is a **separate application** from the desktop app:

- **`apps/landing`** (`@vorynth/landing`) — a standalone Vite + React + TS + Tailwind marketing site. Its own `package.json`, its own build, its own deploy (`pages.yml`).
- **`apps/desktop` + `apps/core-engine`** — the real product (Tauri desktop + NestJS engine). The landing never ships the desktop app; it only _borrows_ the desktop's components to show a faithful preview.

The preview renders the **real** `ShellLayout` + `BriefPage` from `apps/desktop/src` (via the `@` alias) with the **engine mocked** (`src/mock-engine.ts` stubs `fetch`) — so visitors see exactly what the app looks like, without the app running.

**Pages** (multi-page static site — each page is a directory `index.html`, because GitHub Pages serves directory index files with no server rewrites):

- `/` — the marketing home (`index.html`, `main.tsx` → `Root.tsx`).
- `/changelog/` — the app's release notes, rendered from the desktop's own `@/features/changelog/changelog-data.js` (`src/pages/ChangelogPage.tsx`, entry `src/entries/changelog.tsx`).
- `/roadmap/` — renders the repo's `roadmap.md` via `?raw` + react-markdown (`src/pages/RoadmapPage.tsx`, entry `src/entries/roadmap.tsx`).
- `/sources/developer/`, `/sources/kubernetes/`, `/sources/security/` — the curated source lists from the repo's `sources/*.json` (bundled via `?raw`), rendered factually by `src/features/sources/SourceListPage.tsx` (entry `src/entries/sources.tsx`).
- `/personal-intelligence/`, `/ai-news-reader/`, `/local-first/`, `/rss-reader/`, `/open-source/` — keyword landing pages rendered from `TOPIC_PAGES` in `src/content.ts` by `src/pages/TopicPage.tsx` (one shared entry `src/entries/topic.tsx` reads the slug from the URL). Content is strictly factual product capability — no invented claims (R-C04). `personal-intelligence/` is the flagship (brand positioning); the others are long-tail funnels ("tags") that link back to it.
- `/screenshots/` — the screenshot gallery, rendered from `SCREENSHOTS` in `src/content.ts` by `src/pages/ScreenshotsPage.tsx` (entry `src/entries/screenshots.tsx`). The images live in `apps/landing/public/screenshots/` (single source — the README references them from there too).

Every page's `index.html` carries its own `<title>`, meta description, canonical, Open Graph/Twitter tags, and JSON-LD — the home page's `SoftwareApplication` schema injects the real `VORYNTH_VERSION` at build time (`__VORYNTH_VERSION__` placeholder, replaced by the `seoPlugin` in `vite.config.ts`). The `seoPlugin` also emits `sitemap.xml` (build-date `lastmod`) covering all pages; `public/` holds `robots.txt`, `site.webmanifest`, and the 1200×630 `og-image.png`.

Each entry file mounts its page directly (no `Root`), with the CSS chain from `main.tsx` minus `preview.css`. `Root.tsx` (home document only) keeps a hash switch purely as a **legacy fallback** for old `#/changelog` / `#/roadmap` links — home anchors (`#why`, `#faq`, …) still scroll natively and never collide because they don't start with `#/`. Route pages use their own `DocsHeader`, not the home nav; all internal links are base-aware (`import.meta.env.BASE_URL`).

## When to use

- Any change to the landing page content, preview, styles, build, or deploy.
- Any task mentioning "landing", "website", "GitHub Pages", `omidnw.github.io/vorynth`, or `docs/index.html`.
- Before assuming the landing behaves like the running app (it's a static preview with mock data).

## Preconditions

- `@vorynth/types` built (`pnpm --filter @vorynth/types build`) — the landing's `pre*` scripts do this automatically.
- The desktop app is **not** running; the landing preview never talks to a real engine.

## Workflow

1. **Dev:** `pnpm --filter @vorynth/landing dev` (predev builds types). Open the printed URL.
2. **Content** (marketing copy, stats, platforms, features): edit `src/content.ts`. Version comes from `@vorynth/types` (`VORYNTH_VERSION`) — never hardcode it.
3. **Preview data** (the brief items shown in the Today's Brief window): edit `src/mock-data.ts`. It's period-aware (Today / Week / Month / All) with varied scores/dates so the Range and Sort pills are genuinely interactive.
4. **Pages** (home, `changelog/`, `roadmap/`, `sources/*/`, topic pages): changelog data comes straight from the desktop (`@/features/changelog/changelog-data.js`); the roadmap is bundled via `roadmap.md?raw`; source lists come from the repo's `sources/*.json` via `?raw`; topic-page copy lives in `TOPIC_PAGES` in `content.ts`. Page components live in `src/pages/` + `src/features/sources/`, entries in `src/entries/`, per-page `index.html` heads by hand.
5. **SEO:** per-page `<title>`/description/canonical/OG/JSON-LD live in each `index.html`. The home `SoftwareApplication` JSON-LD uses the `__VORYNTH_VERSION__` placeholder (replaced by the `seoPlugin`). `sitemap.xml` is generated at build — add any NEW page (topic, source, or other) to the `SEO_PAGES` list AND the `rollupOptions.input` map in `vite.config.ts`, plus a `<page>/index.html` folder and an entry in `src/entries/`.
6. **Build for Pages:** `VITE_BASE_URL=/vorynth/ pnpm --filter @vorynth/landing build`.
7. **Verify** the real preview rendered (sidebar + toolbar + pills + items), theme matches the page, no horizontal overflow. Confirm `dist/` has every page's `index.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, and `og-image.png`.
8. **Deploy:** push to `master` → `pages.yml` builds `@vorynth/landing` and deploys. (Doc-only changes to `docs/**` also re-trigger it.)

## Rules

- **The landing is a separate app.** Never fold it into `apps/desktop`, and never treat it as part of the Tauri deliverable.
- **Never hand-build a fake app UI.** The preview must render the REAL desktop components (imported from `apps/desktop/src` via the `@` alias in `vite.config.ts`). A hand-rebuilt lookalike is what caused the "doesn't look like the app" failures.
- **The preview is static and mocked.** The engine is not on GitHub Pages. `src/mock-engine.ts` stubs `fetch` per URL path; list-shaped endpoints default to `{ items: [] }` (several real hooks call `data.items.some(...)` and crash on `{}`).
- **Tailwind `content` MUST include the shared package:** `../../packages/ui/src/**/*.{ts,tsx}` (plus `../desktop/src/**/*.{ts,tsx}`). Classes that live only in `packages/ui` (e.g. `border-transparent`, `hover:bg-surface-variant`, `dark:*`) silently vanish otherwise — this produced the "border on every sidebar item" bug in BOTH the landing and the desktop app.
- **Version is auto-synced** from `@vorynth/types`. `docs/index.html` no longer exists — never recreate it; `pnpm version:sync` does not touch the landing.
- **Theme is one source.** `src/theme.ts` is a module singleton; `AppPreview` syncs it bidirectionally with the desktop theme-store. The toggle icon follows the desktop convention (shows the mode you switch TO), so the page nav and preview toggle always match.
- **The landing's CSS must not leak into the preview.** `.hero h1` is scoped `.hero > .container > h1` (a bare `.hero h1` hit the preview's sidebar brand at 67px), and there is no global `a:hover` underline (it leaked onto sidebar nav links).
- **Real paths own pages; hash owns home anchors + legacy only.** New pages are directory `index.html` files registered in BOTH `rollupOptions.input` and the `SEO_PAGES` sitemap list in `vite.config.ts` (forgetting either silently drops the page from the build or the sitemap). Home anchors (`#why`, …) stay hashes. Do NOT add new `#/…` routes — the hash switch in `Root.tsx` is a legacy fallback, not the routing system.
- **Roadmap/changelog/source-lists are live data, never copied.** The roadmap page bundles `roadmap.md?raw`, the changelog page imports the desktop's `changelog-data.js`, and the source pages bundle the repo's `sources/*.json` via `?raw` — edit the source file, not the page. The source pages render ONLY what the JSON contains (names, categories, feed URLs) — never add ratings or opinions.
- **SEO is per-page, static-first.** Every page's `<title>`, description, canonical, and JSON-LD live in its own `index.html` (crawlable without JS); `ItemList` schema for the source pages is injected client-side from the same bundled data. `og-image.png` is 1200×630 and shared. `sitemap.xml`/`robots.txt`/`site.webmanifest` are build artifacts — never hand-maintain them elsewhere.
- **Never run prettier on `apps/landing/dist`** — it's generated output; format `src/` only.

## Common mistakes

- Rebuilding the app preview by hand instead of rendering the real components — it drifts and looks wrong.
- Editing a version string in the landing — it derives from `@vorynth/types` (and the JSON-LD gets it via `__VORYNTH_VERSION__`, never by hand).
- Adding a class to a desktop component but forgetting `packages/ui/src` in the landing Tailwind content → the landing (and desktop!) silently miss it.
- Two `useTheme` states desyncing — always go through the singleton in `src/theme.ts`.
- Global CSS (`a:hover underline`, unscoped `.hero h1`) leaking into the real-app preview.
- Mocking `/bookmarks` as `{}` → `data.items.some` throws.
- Creating a new page but forgetting the `rollupOptions.input` entry or the `SEO_PAGES` sitemap entry in `vite.config.ts` → page never builds, or never appears in the sitemap.
- Leaving a stale `#/…` link instead of a base-aware real path (`${import.meta.env.BASE_URL}changelog/`) — old hash links only work as the Root legacy fallback.
- Editing `sitemap.xml`/`robots.txt` by hand instead of the generator/`public/` — they're build outputs.
- This environment's browser clicks/screenshots may time out; verify with locator reads + computed styles + the built CSS instead.

## Validation

```bash
pnpm --filter @vorynth/landing typecheck && lint && test && build   # all green
pnpm --filter @vorynth/desktop typecheck                            # landing changes never break the app
pnpm version:check
```

Serve the build (`VITE_BASE_URL=/vorynth/ pnpm --filter @vorynth/landing preview`), then confirm:

- The preview shows the REAL screen: "Today's Intelligence Brief", Generate Brief / Collect buttons, Range/Sort pills, sidebar.
- **Only the active sidebar item** has the primary left border; the rest are transparent.
- Theme toggles (page nav + preview top bar) show the same icon and flipping either updates both.
- `/changelog/` shows release cards with type badges and a working technical-details toggle; `/roadmap/` renders the roadmap tables; `/sources/developer/` (etc.) list the real feeds grouped by category with `ItemList` JSON-LD injected.
- `dist/` contains: every page's `index.html` (each with its own `<title>` and canonical), `sitemap.xml` (12 URLs), `robots.txt`, `site.webmanifest`, `og-image.png` — and the home JSON-LD carries the real `VORYNTH_VERSION`.
- No horizontal overflow at 1280 / 768 / 390.
