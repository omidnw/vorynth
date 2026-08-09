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

**Two extra pages** live beside the home page, reachable via hash routes (GitHub Pages has no server rewrites):

- `#/changelog` — the app's release notes, rendered from the desktop's own `@/features/changelog/changelog-data.js` (`src/pages/ChangelogPage.tsx`).
- `#/roadmap` — renders the repo's `roadmap.md` via `?raw` + react-markdown (`src/pages/RoadmapPage.tsx`).

Routing is a tiny hash switch in `src/Root.tsx` (`main.tsx` renders `<Root/>`): hashes starting with `#/` pick a page; anything else is the home page, whose `#why` / `#faq` anchors keep scrolling natively. Route pages use their own `DocsHeader`, not the home nav.

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
4. **Docs pages** (`#/changelog`, `#/roadmap`): changelog data comes straight from the desktop (`@/features/changelog/changelog-data.js`); the roadmap is bundled via `roadmap.md?raw`. Page components live in `src/pages/`, routing in `src/Root.tsx`.
5. **Build for Pages:** `VITE_BASE_URL=/vorynth/ pnpm --filter @vorynth/landing build`.
6. **Verify** the real preview rendered (sidebar + toolbar + pills + items), theme matches the page, no horizontal overflow.
7. **Deploy:** push to `master` → `pages.yml` builds `@vorynth/landing` and deploys. (Doc-only changes to `docs/**` also re-trigger it.)

## Rules

- **The landing is a separate app.** Never fold it into `apps/desktop`, and never treat it as part of the Tauri deliverable.
- **Never hand-build a fake app UI.** The preview must render the REAL desktop components (imported from `apps/desktop/src` via the `@` alias in `vite.config.ts`). A hand-rebuilt lookalike is what caused the "doesn't look like the app" failures.
- **The preview is static and mocked.** The engine is not on GitHub Pages. `src/mock-engine.ts` stubs `fetch` per URL path; list-shaped endpoints default to `{ items: [] }` (several real hooks call `data.items.some(...)` and crash on `{}`).
- **Tailwind `content` MUST include the shared package:** `../../packages/ui/src/**/*.{ts,tsx}` (plus `../desktop/src/**/*.{ts,tsx}`). Classes that live only in `packages/ui` (e.g. `border-transparent`, `hover:bg-surface-variant`, `dark:*`) silently vanish otherwise — this produced the "border on every sidebar item" bug in BOTH the landing and the desktop app.
- **Version is auto-synced** from `@vorynth/types`. `docs/index.html` no longer exists — never recreate it; `pnpm version:sync` does not touch the landing.
- **Theme is one source.** `src/theme.ts` is a module singleton; `AppPreview` syncs it bidirectionally with the desktop theme-store. The toggle icon follows the desktop convention (shows the mode you switch TO), so the page nav and preview toggle always match.
- **The landing's CSS must not leak into the preview.** `.hero h1` is scoped `.hero > .container > h1` (a bare `.hero h1` hit the preview's sidebar brand at 67px), and there is no global `a:hover` underline (it leaked onto sidebar nav links).
- **Hash routes own `#/…`; home anchors own everything else.** New routes must start with `#/` (so home anchors like `#why` never collide), and new home-nav links that leave the page must also be `#/…`. Deep links work on any static host with zero config — no server rewrites.
- **Roadmap/changelog are live data, never copied.** The roadmap page bundles `roadmap.md?raw` (refresh the file, not the page) and the changelog page imports the desktop's `changelog-data.js` — editing either page's data source instead of the source file drifts the site.
- **Never run prettier on `apps/landing/dist`** — it's generated output; format `src/` only.

## Common mistakes

- Rebuilding the app preview by hand instead of rendering the real components — it drifts and looks wrong.
- Editing a version string in the landing — it derives from `@vorynth/types`.
- Adding a class to a desktop component but forgetting `packages/ui/src` in the landing Tailwind content → the landing (and desktop!) silently miss it.
- Two `useTheme` states desyncing — always go through the singleton in `src/theme.ts`.
- Global CSS (`a:hover underline`, unscoped `.hero h1`) leaking into the real-app preview.
- Mocking `/bookmarks` as `{}` → `data.items.some` throws.
- This environment's browser clicks/screenshots may time out; verify with locator reads + computed styles + the built CSS instead.

## Validation

```bash
pnpm --filter @vorynth/landing typecheck && lint && test && build   # all green
pnpm --filter @vorynth/desktop typecheck                            # landing changes never break the app
pnpm version:check
```

Serve the build, then confirm:

- The preview shows the REAL screen: "Today's Intelligence Brief", Generate Brief / Collect buttons, Range/Sort pills, sidebar.
- **Only the active sidebar item** has the primary left border; the rest are transparent.
- Theme toggles (page nav + preview top bar) show the same icon and flipping either updates both.
- `#/changelog` shows release cards with type badges and a working technical-details toggle; `#/roadmap` renders the roadmap tables.
- No horizontal overflow at 1280 / 768 / 390.
