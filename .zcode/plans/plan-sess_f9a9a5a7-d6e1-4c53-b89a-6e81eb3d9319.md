## Plan: Enrich PeriodSummary output (more takeaways, actions, themes, richer text)

### Root cause

The thinness is **not** just a weak prompt — it's an architectural bug. `summarizePeriod()` calls `llm.analyze()`, which:

1. Discards `buildSummaryPrompt()`'s carefully-written system message and re-wraps the call with the per-article `buildAnalyzePrompt()` system message (which says "distill **a single article**").
2. Returns a flat `InsightDraft` (single `summary`, `significance`, `impact`, `recommendedAction` strings — no arrays).
3. The service then hard-assembles: `takeaways = [draft.significance, draft.impact]` (max 2), `recommendedActions = [draft.recommendedAction]` (max 1), `themes = top 4 categories by count` (not LLM-generated, max 4).

### Fix strategy

Route `summarizePeriod()` through a **dedicated `llm.summarize()`** path that uses the existing `generate()` plumbing (which already sends `system` + `user` directly to every provider), then parse the array-bearing JSON the enriched prompt asks for. **No provider changes** — all four already implement `generate()`.

---

## Files to change

### 1. `apps/core-engine/src/modules/llm/llm.service.ts` — add `summarize()` method

Add a new public method mirroring `generate()`:

```ts
async summarize(input: GenerateInput): Promise<string> {
  const result = await this.invokeWithBudget("summarize", (provider) =>
    provider.generate(input),
  );
  return result.draft;
}
```

Reuses the existing rate-limit + usage recording via `invokeWithBudget`. The `operation: "summarize"` value is already in the union (`llm.service.ts:120`).

### 2. `apps/core-engine/src/modules/intelligence/prompts/summary.prompt.ts` — rewrite the prompt

New JSON schema with arrays:

- `headline` — 1-2 sentence synthesis, with citations
- `themes` — array of `{name, rationale}`, **4-6** entries, LLM-generated (semantic themes, not just categories)
- `takeaways` — array of strings, **4-6** entries, each 1-2 sentences with citations
- `recommendedActions` — array of strings, **2-3** entries, each concrete + actionable with citations
- `importanceScore`, `category` — keep as-is

The system message is rewritten to ask for a **rich, multi-point briefing** (not "the single most useful action"). Keep the strict citation discipline. The user message lists the stories with `[N]` markers (unchanged format).

### 3. `apps/core-engine/src/modules/intelligence/prompts/summary.prompt.ts` — add `parseSummaryDraft()` (new export)

A new parser next to `buildSummaryPrompt` that:

- Strips code fences, extracts the `{...}` block (same tolerance as `parseDraft`)
- Returns `{ headline, themes: {name, rationale}[], takeaways: string[], recommendedActions: string[], importanceScore, category }`
- Coerces types defensively: non-arrays → `[]`, non-strings → `String(...)`, non-numbers → `0`
- Trims + filters empty strings from the arrays

### 4. `apps/core-engine/src/modules/intelligence/intelligence.service.ts` — rewire `summarizePeriod()`

Replace lines 240-290:

- Call `buildSummaryPrompt()` and use **both** `system` and `user` (no longer discard `system`)
- Call `this.llm.summarize({ system, user, outputLanguage: targetLanguage })` instead of `this.llm.analyze(...)`
- Parse with `parseSummaryDraft()`
- Build `PeriodSummary`:
  - `headline` ← `draft.headline` (with the existing fallback)
  - `themes` ← `draft.themes` (LLM-generated with rationale). If the model returned an empty array, **fall back** to the current category-count approach (top 4) so the panel never shows zero themes.
  - `takeaways` ← `draft.takeaways`
  - `recommendedActions` ← `draft.recommendedActions`
  - `citations` ← `extractCitedNumbers(...all array items)` then `resolveCitations(...)`
- Recording to history (`history.recordBrief(...)`) is unchanged.

`extractCitedNumbers` already accepts variadic strings — I'll spread all array items into it.

### 5. `apps/desktop/src/features/brief/PeriodSummaryPanel.tsx` — bump preview count

Change `PREVIEW_TAKEAWAYS` from `2` → `3` so the inline preview shows more now that more are generated. The dedicated detail page still shows all of them.

### 6. `apps/desktop/src/pages/HistoryBriefDetailPage.tsx` — show theme rationale (optional polish)

The themes section currently shows just `{name} · {count}`. Since themes will now carry a `rationale` field, update the theme chip to show the rationale as a tooltip/title. **But** the `PeriodSummary.themes` type is `{name, count}[]` — I'd need to extend the type to `{name, count?, rationale?}[]`. I'll make this extension since it's backward-compatible (count becomes optional, rationale optional).

### 7. `packages/types/src/index.ts` — extend `PeriodSummary.themes`

```ts
themes: { name: string; count?: number; rationale?: string }[];
```

Backward-compatible: existing code reading `.count` keeps working (just becomes `undefined` for LLM-generated themes), and the category-count fallback still populates `count`. The frontend already handles `count` being absent (it's only displayed in a couple of places, both of which I'll guard).

---

## What does NOT change

- The `analyze()` path (per-article insights) — untouched, still works
- The four LLM providers — untouched (they already implement `generate()`)
- The `PeriodSummary` type's other fields
- History recording, citations resolution, the detail page rendering
- No DB migration (the `result` column is JSON)

## Risk

The new prompt asks for more output → slightly more tokens per summarize call. The rate limiter (5 req/min) and usage recording still apply. The parser is defensive (falls back to category counts if the model omits themes, falls back to empty arrays if it omits takeaways), so a malformed response degrades gracefully rather than throwing.
