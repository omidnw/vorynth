---
name: ui-ux-approval
description: Coordinate structural UI/UX page changes with the user BEFORE implementing. Use whenever a task would restructure a page — adding/removing/moving sections, tabs, navigation, reordering flows, changing where elements live, or introducing new interactive patterns. The model must present a short proposal and wait for explicit approval first, because whether a UX is usable is a human judgment, not something the model can decide alone.
---

# UI/UX Approval — Vorynth

## Purpose

Stop the agent from unilaterally restructuring pages. Structural UI/UX changes change how the product feels to a person, and "is this usable?" is a human decision. When a task would restructure a page, the agent proposes the change in plain terms and waits for the user's explicit approval before writing any code.

## When to use

Trigger at the START of a task when the change affects a page's STRUCTURE or interaction, for example:

- Adding, removing, or moving a page **section**, **tab**, or **panel** (e.g. a new tab on the Brief page, a settings section moved elsewhere).
- Reordering a **flow** (onboarding steps, dialogs, wizard order).
- Changing **navigation** (sidebar items, back buttons, where a feature lives).
- Introducing a new **interactive pattern** (a chip input, a drawer, a combobox) that changes how the user works with the page.
- Merging or splitting pages.

Do NOT trigger for trivial tweaks that don't change structure: wording/i18n strings, colors, spacing, icon swaps, simple label changes.

## Preconditions

- The task is understood well enough to know whether it touches page structure.
- If unsure whether a change counts as structural, ask — don't guess (a wrong guess means an expensive rebuild).

## Workflow

1. **Detect** — read the request and decide: is this a structural UI/UX change (When to use) or a trivial tweak? Structural → continue. Trivial → implement normally.
2. **Propose** — before touching code, send the user a SHORT, scannable proposal:
   - What moves / is added / is removed, and from where (page + section).
   - The resulting UX in one or two plain sentences (what the user will see/do).
   - A rough layout sketch (ASCII) when it helps, e.g. `Brief: [tab A | tab B]` → `Brief: (just the brief)`.
   - Why the change is proposed (only if it wasn't the user's own request).
3. **Wait** — stop and wait for explicit approval. Explicit = "approve", "بله", "درست است", "اینو بزن", "ok", "good". NOT approval = "go ahead", "do it", "sounds good" without a clear yes (mirrors the repo's commit-approval convention — when uncertain, ask again).
4. **Implement** — only after approval, code the smallest change that matches the plan.
5. **Verify with the user** — after shipping (dev or installed build), tell the user what to look at and let THEM judge the UX. A follow-up tweak is expected and fine.

## Rules

- A structural UI/UX change is NEVER implemented without a proposal + explicit approval. The cost of reverting (build + install) makes "just build it and I'll react" expensive.
- The proposal is short. A wall of text buries the decision. A few lines + a sketch beats paragraphs.
- When the user gives feedback on a shipped change, treat their words as the spec — iterate to match their mental model, not the model's.
- Keep the existing behavior intact unless the user's request or approval explicitly changes it.

## Common mistakes

- **Deciding the UX is "obviously better" without asking** — e.g. adding a History tab to the Brief page because it seemed useful; the user found it confusing. The model cannot judge usability.
- Treating vague go-aheads ("sounds good", "بزن بریم") as approval when the proposal had real options — ask which option.
- Confirming only AFTER building the app — the proposal must come before code, not before install.
- Over-triggering: flagging trivial text/color tweaks as structural, which buries real proposals in noise.

## Validation

- The task's structural change was only implemented after the user sent an explicit approval message.
- The user, not the agent, confirmed the shipped UX is usable (or gave follow-up tweaks).
- No structural change landed in a build without a preceding proposal in the conversation.
