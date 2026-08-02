---
name: ui-guidance
description: Make every interactive element in the Vorynth UI self-explanatory. Use whenever adding an input, selector, button, icon, custom option, or any new control — or when a user says a field is confusing, a control does nothing, or an icon is decorative. Trigger phrases: "ورودی گیج‌کننده", "input confusing", "button does nothing", "decorative icon", "custom option needs explanation", "placeholder".
---

# UI Guidance — Vorynth

## Purpose

Every control a user can interact with must be self-explanatory at a glance: what it is, what it does, and (for inputs) what to type. Nothing decorative, nothing silent. This is R-D07.

## When to use

- Adding any input, number field, selector, button, icon button, or custom option.
- A user reports a control is confusing, does nothing, or looks decorative.
- Reviewing existing UI for hidden traps (icons that don't act, buttons without labels).

## Workflow — for each new interactive element

1. **Inputs (text / number / date):**
   - Placeholder says what to type, with an example: `placeholder="e.g. 45"` (not just "days").
   - A visible unit or suffix when the value is ambiguous: `days`, `hours`, `$`, `%`.
   - A one-line hint below when the meaning isn't obvious: "Keep articles from the last N days — older ones are pruned."
   - `aria-label` for screen readers.
2. **Icon-only buttons:** always an `aria-label` ("Edit note", "Remove bookmark") — never a bare icon.
3. **Selectors:** every option's label is human-readable ("7 days (default)", not "7"). If an option is special ("Custom…", "Unlimited"), make clear what it means.
4. **Custom / free-form options:** when "Custom…" reveals a raw input, the input itself must carry its unit + example + hint (see #1) — the user must not have to guess what number/format to enter.
5. **No decorative elements:** if an icon or button doesn't perform an action, remove it or make it genuinely functional. A `filter_list` icon that does nothing is a bug, not a design choice.
6. **Verify in the browser:** render the control, read it as a first-time user — could you answer "what do I type / what does this do?" from the screen alone?

## Rules

- Placeholder + unit + hint for every ambiguous input; `aria-label` for every icon button.
- **Never ship a decorative, non-functional element.**
- A "Custom…" option must never reveal a bare input — the input needs the same guidance as any other.
- If a control needs a paragraph to explain, the explanation belongs on the screen (or in the in-app docs via `/docs-update`), not in a tooltip nobody reads.

## Common mistakes

- Number input with `placeholder="days"` and no example → user doesn't know the scale or format.
- An icon (e.g. `filter_list`) placed next to an input that does nothing — remove it.
- Selector option "Custom…" opening a bare field with no hint.
- Icon buttons without `aria-label` (invisible to screen readers and unclear on hover).
- Guidance hidden only in `title` tooltips — visible hints are better.

## Validation

- `pnpm --filter @vorynth/desktop typecheck` + `lint`.
- Browser check: for every new control, can a first-time user tell what to type / what it does from the visible screen?
- Grep the touched file for `<input` without `placeholder`/`aria-label`, and for icon-only `<Icon` without a wrapping labelled button.
