# Plan: Re-Collect All Sources from Settings

## What changes

### Backend — CrawlerService `persistDeduped` gets a force mode

**`apps/core-engine/src/modules/crawler/crawler.service.ts`**

- Extend `collectSource(id, opts?: { force?: boolean })` — accepts an optional `force` flag.
- Extend `collectAll(onProgress?, opts?: { force?: boolean })` — passes `force` to each `collectSource` call.
- Change `persistDeduped(items, sourceId, force?)`: when `force=true`, use Drizzle's `onConflictDoUpdate({ target: articles.hash, set: { content, author, url, title, collectedAt } })` instead of the current `onConflictDoNothing`. This updates existing articles in place when a hash collision is found (same article re-fetched). Related data (insights, media) is preserved because the row `id` stays unchanged.

### Backend — JobsController accept `force` flag

**`apps/core-engine/src/modules/jobs/jobs.controller.ts`**

- `POST /jobs/collect` currently takes no body. Add `@Body() body: { force?: boolean } = {}` and pass `{ force: body.force === true }` to `crawler.collectAll()`.
- The job label changes to "Re-collecting sources" when force is true.

### Frontend — jobs-api.ts

**`apps/desktop/src/features/jobs/jobs-api.ts`**

- Extend `startCollectJob(opts?: { force?: boolean })` to accept an options object. When `force: true`, pass `{ force: true }` in the POST body.

### Frontend — Settings page new section

**`apps/desktop/src/pages/SettingsPage.tsx`**

- Add a new GhostCard section **after** the engine status card (before the LLM sections) called "Re-collect all sources".
- Shows a **warning-style message** (using the existing UI patterns):  
  _"Only re-collect if articles have changed at their source or you're testing a new app feature. For a single source, use Sources → [per-source collect button]. Re-collecting all is not generally recommended."_
- A **"Re-collect all" button** that, when clicked, shows a confirmation dialog (browser `confirm()`) with the same warning text, plus "Are you sure?"
- On confirm, calls `useJobsStore().startForceCollect()` — the progress shows in the existing JobsTray, no extra progress UI needed.

### Types — extend `JobKind`

**`packages/types/src/index.ts`**

- The existing `JobKind = "collect" | "generate" | "summarize"` is sufficient — no new kind needed since the force flag is just a body parameter on the existing collect job. The message/label difference comes from the job progress text.

### i18n

**`apps/desktop/src/i18n/en.ts`**

- Add a `settings.recollect*` key block (title, warning, button, confirm text).

## Files changed (8 total)

| File                                                         | Change                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/core-engine/src/modules/crawler/crawler.service.ts`    | Extend `collectSource` + `collectAll` + `persistDeduped` with force flag |
| `apps/core-engine/src/modules/jobs/jobs.controller.ts`       | Add `@Body() body` to `POST /jobs/collect`                               |
| `apps/desktop/src/features/jobs/jobs-api.ts`                 | Extend `startCollectJob` with options                                    |
| `apps/desktop/src/features/jobs/jobs-store.ts`               | Add `startForceCollect` (or extend `startCollect` to pass force)         |
| `apps/desktop/src/pages/SettingsPage.tsx`                    | New "Re-collect" section with warning + button                           |
| `apps/desktop/src/i18n/en.ts`                                | New i18n keys                                                            |
| `packages/types/src/index.ts`                                | No change needed                                                         |
| `apps/core-engine/src/modules/crawler/crawler.controller.ts` | No change needed                                                         |

## Verification

- `pnpm --filter @vorynth/core-engine typecheck && pnpm --filter @vorynth/core-engine lint`
- `pnpm --filter @vorynth/desktop typecheck && pnpm --filter @vorynth/desktop lint`
- Run the app and check Settings page visually
