---
name: docs-update
description: Keep the in-app Documentation/Tutorial page in sync with the product. Use whenever a new page, feature, setting, or behavior is added or changed — the in-app docs section for it must be created/updated with icons and flow diagrams, and the page and docs section must link to each other. Trigger phrases: "update docs", "documentation page", "docs section", "tutorial", "توضیحات".
---

# Docs Update — Vorynth

## Purpose

Every user-facing surface (page, feature, setting, behavior) has a matching section in the in-app Documentation/Tutorial page, with **bidirectional links**: the page links to its docs section, and the docs section links back to the page. Sections are built from **rich blocks** — paragraphs, icon-labeled feature rows, bullet lists, and visual flow diagrams — so the docs read with the app's design language, not plain walls of text.

## When to use

- Adding a new page or route.
- Adding/changing a user-visible feature, setting, filter, or behavior.
- Changing how something works (e.g. search relocation, new save model) — the docs must not describe the old behavior.
- The user asks for "توضیحات" / documentation / tutorial content.

## Structure (one file per page — keep it that way)

```
apps/desktop/src/features/docs/
├── types.ts              ← DocsSection, DocsBlock, FlowStep (shared types)
├── docs-data.ts          ← aggregator ONLY — imports sections, exports DOCS_SECTIONS + TRANSPARENCY_SECTIONS
└── sections/
    ├── brief.ts          ← Today's Brief
    ├── sources.ts        ← Sources
    ├── archive.ts        ← Archive
    ├── bookmarks.ts      ← Bookmarks
    ├── search.ts         ← Search & Ask AI
    ├── history.ts        ← History
    ├── media.ts          ← Media
    ├── docs.ts           ← Documentation itself
    └── transparency.ts   ← all 4 transparency sections
```

**Never dump all content into `docs-data.ts`.** Each page keeps its own file so diffs stay small and editing one section never touches another. Adding a new page → create `sections/<page>.ts` and register it in `docs-data.ts`.

## The section shape

```ts
import type { DocsSection } from "../types.js";

export const myPageSection: DocsSection = {
	id: "my-page",            // stable slug → /docs#my-page
	title: "My Page",
	summary: "One-line summary shown under the title.",
	icon: "widgets",          // Material Symbols name for the heading badge + sidebar
	pageRoute: "/my-page",    // link back to the page (bidirectional)
	blocks: [
		{ type: "paragraph", text: "Plain explanation." },
		{
			type: "features",
			items: [
				{ icon: "bolt", label: "A capability", text: "What it does." },
			],
		},
		{
			type: "flow",
			title: "How it works",
			steps: [
				{ icon: "cloud_download", label: "Collect" },
				{ icon: "speed", label: "Rank" },
				{ icon: "menu_book", label: "Read" },
			],
		},
		{ type: "bullets", items: ["One fact per line.", "Another fact."] },
	],
};
```

## Block types — pick the right one

| Block | Use for |
| --- | --- |
| `paragraph` | Prose explanation (the 'why', mechanics, caveats). |
| `features` | **Buttons, options, and capabilities** — one row per item with a Material icon + label + short text. This is where "what does this button do" belongs. |
| `flow` | **Step-by-step visual diagrams** (Collect → Rank → Analyze → Read). Shows how a thing works at a glance. |
| `bullets` | Short list of facts — use `chevron_right` rendering is automatic; one idea per item. |

**Every button/option/capability a page has should appear as a `features` row or in a `bullets` list — not hidden in prose.** If a user asks "دکمهها چی هستند", the answer must be findable as icon-labeled rows.

## Workflow

1. **Find the page's section file** under `sections/`; if it doesn't exist, create it and register in `docs-data.ts`.
2. **Describe honestly**: what it does, where it is, and any settings that affect it.
3. **Cover every interactive element**: header buttons, options (Period/Sort/Domains…), toggles, filters — each as a `features` row with its icon.
4. **Add a `flow`** when the page has a process (add a source, how Ask AI answers, how media works).
5. **Transparency content** where relevant: how data is collected, why titles/descriptions differ from the original, how importance/ranking is decided, how Ask AI or brief summaries work. Stored signals and real mechanics — never invented reasoning.
6. **Link the page → docs**: the page renders a docs link (icon/button, `aria-label` like "How this page works") pointing to `/docs#<id>`.
7. **Link docs → page**: the section carries `pageRoute` — the "Go to <page>" footer link is automatic.
8. **Verify**: render `/docs`, click the section, click through to the page, and confirm the page's docs link returns.

## Rules

- **Every page/feature ships with its docs section** — a feature is not complete until its docs section and links exist (R-D06).
- **One file per page** — never accumulate all content in `docs-data.ts`.
- **Every button/option gets an icon-labeled row** in `features` — capabilities must not be buried in prose.
- **Bidirectional links are mandatory**: page → `/docs#<id>` and docs → page. One-way documentation is a bug.
- **Never document what the code doesn't do** — docs describe real behavior; if it's aspirational, it doesn't belong in the in-app docs.
- **Transparency sections state mechanics, not promises** (e.g. ranking = stored signals like source reliability × freshness; never "the AI thinks this is important because…").
- UI strings for the docs page live in `en.ts` (R-A07), not hardcoded.

## Common mistakes

- Adding a page without a docs section (silently breaks the bidirectional contract).
- **Dumping everything into `docs-data.ts`** instead of the page's own `sections/` file.
- Writing capabilities as prose only — missing `features` rows means "دکمهها و قابلیتها" are not findable.
- Updating behavior in code but leaving the docs describing the old behavior — update both in the same change.
- Linking only one direction (page → docs but no docs → page, or vice versa).
- Writing marketing copy instead of "what does this do and how does it work".
- Using a `flow` for a linear capability list — `flow` is for step-by-step processes, `features` is for a list of things.

## Validation

- `pnpm --filter @vorynth/desktop typecheck` — docs data types are strict (`DocsSection`/`DocsBlock`).
- Manual: `/docs#<id>` renders; the in-page docs link opens the right section; the section's "Go to page" navigates to the page.
- Grep the section file: does every button/option on the page appear as a `features` row or `bullets` item? Does it include a `flow` where a process exists?
- A new page is only "done" when both links exist and resolve.
