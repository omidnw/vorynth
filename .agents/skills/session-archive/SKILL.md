---
name: session-archive
description: Record a finished ZCode session in the Vorynth roadmap. When a chat ends, the user compacts it and adds its session ID to the project archive so roadmap.md always reflects what was done. Trigger when the user says "add my session", "compact and archive", "session archive", "add session to roadmap", or after any completed chat.
---

# Session Archive — Vorynth

## Purpose

Record a finished ZCode session in `roadmap.md` so the project's memory is never lost — one row per session, appended.

`roadmap.md` is the canonical project history: the status snapshot plus the full session archive. When a chat ends, its session ID must be recorded there so a future fork can see what was done without depending on any single conversation.

## When to use

- User says "session رو به roadmap اضافه کن" / "add this session to the roadmap" / "compact and archive" / "archive this session"
- After any completed fork/chat — the user's standard flow is: work → compact → add session ID to roadmap.md
- Before starting a new fork, when you need to know what was already done

## Workflow

1. **Get the session ID** — the user provides it (e.g. `sess_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), or it's visible in the current context. If missing, ask for it — never invent one.
2. **Read `roadmap.md`** — find the §8 "Session archive (for traceability)" table.
3. **Append a row** — newest last, in this shape:

   ```md
   | 24 | `sess_<id>` | <one-line theme of what was done> |
   ```

   Number = previous last row number + 1. Keep the theme short (what the session achieved, not the file list).
4. **Update the §1 snapshot** if the session changed project state:
   - Current release / working-tree status
   - "Working tree: N files modified" if the diff count changed
5. **If the session shipped meaningful user-visible work** — the changelog should already have been updated (per `/changelog` skill); verify, don't double-log.

## Rules

- One row per session. If the same session is re-added, update its row instead of duplicating.
- Session IDs must be copied exactly — a wrong ID breaks traceability.
- Do NOT write release entries or version bumps here — that's the `/changelog` skill's job.
- If the session revealed new always-true rules or repeatable processes, propose adding them to `AGENTS.md` / a new skill instead of burying them in the table.

## Common mistakes (gotchas)

- **Inventing a session ID** — never; ask the user.
- **Skipping the snapshot update** — the snapshot is what a future fork reads first; a stale version/status row misleads the next session.
- **Logging changelog material in the archive** — sessions are process history, releases are user-facing history. Keep them separate.
- **Deleting old rows** — append-only; the archive is the project's memory.

## Validation

- The new row renders in the §8 table with the correct next number.
- Snapshot row (§1) reflects reality: version, release, working-tree status.
- No duplicate session IDs exist in the table.
- `roadmap.md` opens cleanly (no broken table syntax).
