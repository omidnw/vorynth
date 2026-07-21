---
name: standard-packages
description: Prefer well-maintained, standard npm packages over hand-rolled code — but only when the package is healthy, lightweight, and actively maintained. Use whenever implementing something non-trivial that the ecosystem likely already solves well: language/region data, date formatting, text normalization, UI components, validation, etc. Also use when evaluating whether to add a new dependency.
---

# Standard Packages — Vorynth

## Principle

**Don't hand-roll what the community has already built and vetted.** The open-source ecosystem exists so we don't rebuild wheels. Before writing custom logic for anything standardised (language lists, country data, date formatting, text normalisation, MIME types, etc.), check for a well-established package.

But: **not every package is worth adding.** A package must clear the quality bar below, or we write it ourselves.

---

## Quality bar — must clear ALL of these

### 1. Actively maintained

- Last published **≤ 2 years ago** (≤ 1 year preferred).
- GitHub repo shows recent commits, open issues get replies, PRs get merged.
- Has a **license** (MIT, Apache-2.0, ISC — avoid unknown or restrictive licenses).

### 2. Community trust

- **≥ 1M weekly downloads** on npm for critical dependencies (date formatting, i18n, language data).
- **≥ 100K weekly downloads** for smaller utilities (MIME types, slugify, etc.).
- Multiple dependents — if other well-known packages rely on it, that's a strong signal.

### 3. Lean dependency tree

- **Zero or near-zero transitive dependencies.** A package that pulls in 50 sub-packages inflates install time, CI time, and attack surface.
- Check with `pnpm why <pkg>` or `npm ls <pkg>` before adding.
- Prefer packages that leverage Node.js / browser built-ins over those that re-implement them.

### 4. Stable API

- Follows semver honestly.
- Major version bumps are rare and well-documented.
- No breaking changes in patch releases.

### 5. Bundle-size aware (frontend only)

- Check bundle footprint via [bundlephobia.com](https://bundlephobia.com) before adding.
- Prefer tree-shakeable ESM exports over CommonJS-heavy packages.
- A utility that adds 50 KB+ to the bundle needs a strong justification.

---

## Decision flow

```
Need some data or behaviour that feels "standard"?

  ┌─ Is there a native browser / Node.js API?
  │   ✅ Use it. (Intl, URL, fetch, crypto, etc.)
  │
  └─ No native API — is there a well-known package?
      │
      ├─ Does it clear the quality bar above?
      │   ✅ Install it.
      │
      └─ No, or it fails the bar → write it ourselves.
```

### Examples from this project

| Need                       | Decision                              | Reasoning                                                                |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| ISO 639-1 language codes   | `iso-639-1` ✅                        | 1.6M weekly downloads, zero deps, 2.3 KB, actively maintained since 2016 |
| Persian text normalisation | `@persian-tools/persian-tools` ✅     | Dedicated library, well-tested, covers exactly what we need              |
| Date formatting            | Use `Intl.DateTimeFormat` (native) ✅ | Built into every runtime, zero deps                                      |
| FTS5 tokenisation          | `Intl.Segmenter` (native) ✅          | ICU-backed, zero deps, language-aware                                    |
| UI language translations   | JSON catalogs + `i18next` ✅          | Industry standard for i18n                                               |

---

## What NOT to do

- ❌ Hand-roll an ISO language list, country list, currency list, timezone list — these are standardised data sets with well-maintained packages.
- ❌ Write a custom date formatter — `Intl.DateTimeFormat` exists natively; for advanced needs use `date-fns` (tree-shakeable, 0 deps).
- ❌ Add a package that hasn't been updated in 3+ years — it's abandoned, even if it still works today.
- ❌ Add a package with 100+ transitive dependencies for a single function.
- ❌ Remove a package and re-implement its logic by hand _unless_ the package fails the quality bar.

## What TO do

- ✅ Check for a native API first — it's free, tested, and maintained by the platform.
- ✅ When a package is the right call, install it and delete the hand-rolled code it replaces.
- ✅ Favour zero-dependency packages when the functionality is small (like `iso-639-1`, `nanoid`, `p-limit`).
- ✅ Document _why_ a package was chosen in the commit message or PR — it helps future reviewers.
- ✅ Re-evaluate dependencies periodically — if a package we rely on becomes unmaintained, plan a migration.
