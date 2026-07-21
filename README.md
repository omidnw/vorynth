# Vorynth

> Less reading. More understanding.

A **local-first personal intelligence engine** that turns the flood of global
information into a short, personalized intelligence brief. Spend minutes
understanding what matters instead of hours searching for it.

## Architecture

```
apps/
├── desktop/        Tauri + React 18 + TypeScript  (UI shell)
└── core-engine/    NestJS → bundled SEA → Tauri sidecar
                    SQLite + Drizzle, LangGraph.js intelligence workflow
packages/
└── types/          shared DTOs (Source, Article, Insight, Report, …)
```

The desktop app is a thin client over the Core Engine — **no business logic in
React.** The engine owns collecting, normalizing, ranking, AI analysis,
localization and report generation. Everything runs on the user's device; API
keys, history and reports stay under the user's control.

## Workspace scripts

```bash
pnpm install          # install everything (monorepo)
pnpm dev              # run desktop + core-engine in parallel
pnpm dev:desktop      # frontend only (Vite, http://localhost:5173)
pnpm dev:core         # core engine only (NestJS/Fastify)
pnpm db:migrate       # apply Drizzle migrations
pnpm db:seed          # seed the slice RSS source
pnpm typecheck        # tsc --noEmit across the workspace
pnpm lint             # eslint across the workspace
pnpm test             # vitest across the workspace
pnpm format           # prettier
```

## Status

Concept / development planning. See `project-details.md` for the full product
specification and `examples/` for the reference UI/UX.
