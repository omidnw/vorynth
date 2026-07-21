---
name: changelog
description: How to maintain the Vorynth changelog — bump version, pick a brand-themed codename, and record only genuinely impactful changes. Use whenever a meaningful piece of work has just landed (a feature shipped, a significant bug fixed, a behavior changed, security tightened), whenever the user says "log this", "changelog", "what changed", "bump version", "cut a release", or asks what's new. Also use proactively at the end of a non-trivial change to decide whether it deserves a changelog entry.
---

# Changelog — Vorynth

This skill records changes that materially move the project forward. It is not a commit log. Most commits are noise; this changelog is signal.

## When to log

Log a change when it meets **at least one** of these bars. When in doubt, ask: _"If a user only read the changelog, would they care about this?"_

- **New** — a user-facing feature, a new page, a new provider, a new capability they couldn't do before.
- **Improved** — a noticeable behavior change: faster, smoother, clearer, more accurate, redesigned.
- **Fixed** — a bug the user would have felt (broken button, wrong data, crash, silent failure).
- **Security** — anything that changes the trust boundary: key handling, auth, data exposure, sandboxing.

Do **not** log: refactors with no behavior change, dependency bumps (unless they fix a user-facing bug or break behavior), typo fixes, internal cleanup, formatting, CI tweaks, code moves. These are real work, but they aren't changelog material.

If you're unsure whether something counts, lean toward **not logging**. A short changelog that respects the reader beats a long one full of trivia. "Signal Over Noise" is the project's first brand principle — apply it here first.

## How to log

### 1. Decide the version bump

Read the current version first (it's in `apps/desktop/src/features/changelog/changelog-data.ts` at the top of the `RELEASES` array, and in the files listed in step 3). Then apply semantic versioning:

| Bump              | When                                                                      | Example                       |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------- |
| **patch** `x.y.Z` | A fix or small improvement that doesn't add capability or change behavior | Bug fix, perf tweak, copy fix |
| **minor** `x.Y.0` | A new capability, new page, new provider — backward-compatible            | Search page, period summaries |
| **major** `X.0.0` | A breaking change to what users rely on, or a foundational shift          | New architecture, new schema  |

Defaults when ambiguous:

- A bug fix → **patch**.
- "Added X" / "Now you can Y" → **minor**.
- Rewrote how something core works, removed a feature, or changed the data model → **major**.
- Multiple changes of mixed sizes in one release → bump to the **highest** level among them.

`1.0.0` is already taken — never reuse a version that exists in `RELEASES`.

### 2. Pick a codename

Every Vorynth release gets a two-or-three-word codename drawn from the project's brand language (see `references/codenames.md` for the full vocabulary and which ones are already used). The codename should fit the _theme_ of the release, not just the biggest change.

Quick palette to draw from (all defined in `project-details.md` §2 and §9):

- **Signal Over Noise** — finding what matters in the flood _(used: 1.0.0)_
- **Source Quality Over Quantity** — trusted sources beat many sources
- **Explain, Don't Just Summarize** — why + what-to-do, not just what
- **Privacy First** — local-first, user-controlled
- **Navigate the Maze** — helping humans find paths through complexity
- **Discovery & Navigation** — exploration, wayfinding
- **Intelligent Filtering** — ranking, dedup, importance
- **Minutes Not Hours** — time saved as the core value
- **Local Engine** — the engine runs on-device

Don't invent unrelated codenames ("Speedy Cheetah", "Autumn Release"). Stay in-brand. If the change genuinely doesn't fit any of the above, read `references/codenames.md` for the longer list and the composition rules.

### 3. Write the release entry

Edit **`apps/desktop/src/features/changelog/changelog-data.ts`** — prepend a new `Release` object to the `RELEASES` array (newest first). Use this exact shape:

```ts
{
  version: "1.1.0",                    // the bumped version, string
  codename: "Explain, Don't Just Summarize",  // from the brand palette
  date: "2026-07-20",                  // ISO YYYY-MM-DD, today's date
  summary: "One or two sentences framing the release in user-facing language. "
         + "What can they do now that they couldn't before? Why does it matter?",
  changes: [
    {
      type: "new",                     // "new" | "improved" | "fixed" | "security"
      text: "Search page — keyword and Ask-AI search across every collected article, with inline citations.",
    },
    {
      type: "fixed",
      text: "Brief no longer shows articles older than the source's fetch window.",
    },
  ],
},
```

Rules for the `changes` array:

- **One idea per entry.** Don't pack "added search and fixed the brief sort" into one line.
- **Write what the user experiences, not what the code did.** "Search page finds articles across all sources" beats "added SearchService.keyword()".
- **Include the _why_ when it's not obvious.** "Rate-limited to 5 req/min so your API key never hits RPM limits" — the limit is the what, the protection is the why.
- **Be specific.** "13 RSS sources across AI, Security, Cloud, Backend, DevOps, Open Source" beats "many sources added".
- **Past tense, active voice, no marketing words.** No "revolutionary", "seamless", "powerful". The changelog earns trust by being plain.
- **Categorize honestly.** A redesigned UI is `improved`, not `new`. A regression you're undoing is `fixed`. Key rotation or sandbox tightening is `security`.
- Aim for **3–10 entries** per release. Fewer is fine if fewer landed; more probably means you're logging noise.

### 4. Bump the version everywhere

Version strings live in five files and **must stay in sync**. After deciding the new version, update all of them:

```
package.json                              (root)
apps/core-engine/package.json
apps/desktop/package.json
apps/desktop/src-tauri/tauri.conf.json     → "version"
apps/desktop/src-tauri/Cargo.toml          → version = "..."
```

All five should carry the same version string (e.g. `1.1.0`). The engine reports its version to the frontend from `package.json`, and the desktop page highlights the matching release as "Current" — so a mismatch makes the Changelog page point at the wrong release.

### 5. Verify

After editing:

1. Run `pnpm format` from the repo root — the changelog data file uses tabs and Prettier will normalize it.
2. Run `pnpm --filter @vorynth/desktop typecheck` — the `Release` / `ChangeEntry` types are strict; a typo in `type` will fail the build.
3. Skim the rendered Changelog page mentally: does the newest entry sit at the top? Does the codename match the theme of what actually shipped?

You don't need to start the dev server for this — typecheck + format is enough.

## Worked examples

### Example A — "I just finished the search page"

- **Bump:** minor (1.0.0 → 1.1.0). New capability.
- **Codename:** "Explain, Don't Just Summarize" — search surfaces _why_ via citations.
- **Entries:** one `new` for the page (keyword + Ask-AI), one `new` for inline citations, maybe one `improved` if the topbar changed.
- Don't log the internal `SearchService.ask()` refactor — that's noise.

### Example B — "Fixed: brief shows stale articles"

- **Bump:** patch (1.1.0 → 1.1.1). Bug fix, no new capability.
- **Codename:** "Source Quality Over Quantity" — keeping only what's fresh.
- **Entries:** one `fixed`.
- Single-entry releases are fine.

### Example C — "Rewrote the job system to use a persistent queue"

- **Bump:** major (1.x → 2.0.0) if it breaks the public job API or changes how users interact with jobs; **minor** if it's purely internal and jobs look the same to users.
- The decision hinges on **what the user sees**, not how big the diff is. A 2000-line internal rewrite that changes nothing user-facing is _not_ a major bump — and probably isn't even a changelog entry.

## Anti-patterns to avoid

- **Logging every commit.** If you wouldn't put it in a release email to users, don't put it here.
- **Vague entries.** "Various improvements" tells the reader nothing. Either be specific or drop the entry.
- **Future tense.** "Will add support for X" has no place in a changelog — log it when it ships.
- **Reusing a codename.** Each release needs its own. Check `RELEASES` first.
- **Desynced versions.** Five files, one version. Always.
- **Inflating the bump.** A copy fix is not 1.1.0. A new button is not 2.0.0. Match the bump to the impact.

## Reference

- `references/codenames.md` — the full codename vocabulary, composition rules, and which names are already taken. Read this before picking a codename for a non-obvious release.
