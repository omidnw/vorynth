---
name: github-release-notes
description: Write Vorynth GitHub release notes — a copy-paste-ready title and body in the established release style. Use whenever the user asks for GitHub release notes, a GitHub release draft, a release title/body, "توضیحات برای github", "release notes بده", "می‌خوام release کنم", or wants the announcement text for a new version. Always first asks the user to paste the previous release's notes as the style reference, then builds the draft from the in-app changelog entry (changelog-data.ts) and roadmap.md.
---

# GitHub Release Notes — Vorynth

## Purpose

Turn a version's in-app changelog entry into the GitHub Release draft (title + body) that mirrors the style of the previous release — so every release announcement reads as part of one series.

## When to use

- User asks for "release notes", "GitHub release", "release title/body", "توضیحات برای github", "release کنم", or any variant of wanting the announcement text for a version.
- A release is being cut and the GitHub Release draft needs its text.

Do NOT use for recording changes into `changelog-data.ts` — that's `/changelog`. This skill reads the changelog; it never writes it. If the target version has no changelog entry yet, run `/changelog` first.

## Preconditions

- The target version has a changelog entry in `apps/desktop/src/features/changelog/changelog-data.ts` (`version`, `codename`, `summary`, `changes[]`). If it doesn't, tell the user to run `/changelog` first — never invent an entry.
- The user has provided (or accepted) a style reference: the previous release's GitHub title + body. If they have none, fall back to `references/example-release.md` (the v1.5.0 release).

## Workflow

1. **Ask for the style reference.** Ask the user to paste the previous release's GitHub notes (title + body). If they can't, use `references/example-release.md` and tell them that's the fallback.
2. **Identify the target version.** From the user's request, or ask if ambiguous. ⚠️ The `RELEASES` array is newest-first — if the user is releasing an older version before a newer one (e.g. v1.6.0 while v1.7.0 is already the top entry), pick the entry by `version`, never by position.
3. **Read the sources.** `changelog-data.ts` → the target entry (`summary`, `changes[]`, `technical[]`, `codename`). `roadmap.md` §3/§5 → open known issues. If the entry has no `changes` array, stop and tell the user to run `/changelog`.
4. **Draft the title.** `Vorynth v<version> — <codename>` (codename from the changelog entry).
5. **Draft the body** in the reference's exact section structure (typically _What's new_ / _Improvements_ / _Fixes_ / _Known issues_ / _Full changelog_):
   - **Opening paragraph** — based on the entry's `summary`, extended with the release's headline items.
   - **What's new** — every `new` change entry.
   - **Improvements** — every `improved` change entry.
   - **Fixes** — every `fixed` change entry.
   - **Known issues** — only issues still true per `roadmap.md` (today: plugin/source-adapter gap, no scheduled weekly/monthly reports, no Intel macOS DMG, experimental FreeBSD).
   - **Full changelog** — "See changelog-data.ts for the complete release history."
   - Keep `technical[]` items (schema changes, invariants, infrastructure) out of the user-facing body — they live behind the in-app "Technical details" toggle.
6. **Match the reference's tone and granularity.** Same bullet lengths, same voice, no new section names, no marketing words. Reuse the changelog's wording so both tell the same story.
7. **Output.** Title + body in a single fenced code block, ready to paste into the GitHub release form. Offer to draft the next release in the same format.

## Rules

- **Never fabricate.** Every bullet maps to exactly one `changes` entry. No invented items, no "pending" work, no features that aren't in the changelog entry.
- **Consistency is a feature.** The GitHub release must tell the same story as the in-app Changelog page — reuse its wording rather than rewriting.
- Section names and order come from the style reference, not from what seems nice.
- Known issues must still be true — check `roadmap.md` and drop any that the target release fixed.
- If a version's changelog entry is missing, stop and refer to `/changelog` instead of improvising.

## Common mistakes

- Grabbing the wrong entry — the array is newest-first; always select by `version` (this happened with v1.6.0 vs v1.7.0).
- Leaking `technical[]` items (schema changes, invariants, infra) into the user-facing body.
- Copying a Known issue that the target release already fixed.
- Renaming sections or changing the title format away from the reference.
- Skipping the opening paragraph or the final changelog link.
- Writing the release body but not the title, or vice versa — the user pastes both into the GitHub form.

## Validation

- Every section and bullet traces to one source: a `changes` entry, an open `roadmap.md` known issue, or the reference format.
- Version + codename match the changelog entry exactly.
- Section names match the reference's sections, in the same order.
- No bullet goes beyond what `changes[]` says.
- Title + body are copy-paste-ready in one fenced code block.
