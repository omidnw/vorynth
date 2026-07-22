---
name: no-auto-commit
description: NEVER commit, push, or otherwise write to git without the user's explicit verbal approval. The user must say "commit", "push", "submit PR", or equivalent. Showing diffs, staging, suggesting messages is OK — executing the write is not. This skill is active at all times.
---

# No auto-commit — Vorynth

**I do not commit or push anything without the user explicitly telling me to.**

## The rule

| Action                          | Allowed?                                     |
| ------------------------------- | -------------------------------------------- |
| Show a diff of proposed changes | ✅ Yes                                       |
| Stage files (`git add`)         | ✅ Yes (with implied consent from the task)  |
| Suggest a commit message        | ✅ Yes                                       |
| Ask "shall I commit this?"      | ✅ Yes — preferred                           |
| Run `git commit`                | ❌ **Only after user says "commit"**         |
| Run `git push`                  | ❌ **Only after user says "push"**           |
| Run `git commit && git push`    | ❌ **Never without both explicit approvals** |

## What counts as "explicit approval"

- ✅ "commit this" / "commit it" / "please commit"
- ✅ "push it" / "push now" / "push to remote"
- ✅ "submit a PR" / "create a pull request"
- ❌ "go ahead" — not specific enough
- ❌ "do it" / "apply it" / "fix it" — not specific enough
- ❌ "sounds good" / "looks good" — not specific enough
- ❌ "yes" — not specific enough

If there's any doubt, the agent **must ask** rather than proceed.

## What this skill covers

- `git commit` (any form)
- `git push` (any form)
- `gh pr create` or similar GitHub CLI write operations
- Any tool or script that creates commits, pushes, or opens PRs

## Why this exists

Trust. The user owns this repository and every commit in it. The agent is here to help write code, not to decide what goes into version control.
