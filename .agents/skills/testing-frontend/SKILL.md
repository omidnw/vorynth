---
name: testing-frontend
description: How to write frontend tests for the Vorynth desktop app — Vitest + Testing Library for components, Playwright for e2e critical journeys. Use whenever adding or changing React UI, or when the task mentions frontend tests, playwright, aria/role, a11y, or component tests. Hard contract: NO data-test-id — tests select by role, accessible name, and standard HTML semantics.
---

# Frontend Testing — Vorynth

## Purpose

Test the UI the way a user experiences it — by role, accessible name, and visible text — so the test suite doubles as the a11y contract. Component tests (Vitest + Testing Library) cover behavior; Playwright covers the critical user journeys end-to-end against a running engine.

## When to use

- Adding or modifying any React component, page, or feature.
- Any UI string / i18n change that affects what a user reads.
- Landing a new page → add its section to the Playwright journey suite.

## Preconditions

- `pnpm install` if `@testing-library/*`, `jsdom`, or `playwright` were just added.
- Playwright browsers installed (`pnpm --filter @vorynth/desktop exec playwright install chromium`).

## Workflow

1. **Component tests** (`*.test.tsx` beside the component, under `src/`):
   - Import `{ describe, it, expect, vi }` from `"vitest"` explicitly (no globals).
   - `render(<Component />)` from `@testing-library/react`; interact with `userEvent`.
   - Select with `screen.getByRole(...)` / `getByLabelText(...)` / `getByText(...)`. If there's no obvious role/name, **fix the component** to expose one — that's the a11y baseline, not a workaround.
   - Setup (`src/test/setup.ts`) auto-cleans between tests.
2. **E2E journeys** (Playwright, `e2e/`): cover the critical flows, not every page: collect → bookmark → archive → search → history → docs, plus the `/search?q=&mode=` → `/archive` redirect regression. Select via `getByRole`/`getByLabel` — same contract as unit tests.
3. **Run**: `pnpm --filter @vorynth/desktop test` (vitest); `pnpm --filter @vorynth/desktop test:e2e` (playwright).
4. **Verify types**: `pnpm --filter @vorynth/desktop typecheck` (test files live in `src`, so they're typechecked).

## Rules

- **Never add `data-test-id` (or `data-testid`, `data-cy`, …).** Tests use roles/aria-labels/standard tags. A missing accessible name is a real a11y bug — surface it, don't test around it.
- **Prefer semantic HTML**: `button`, `a`, `nav`, `main`, `h1`–`h6`, `label`, `ul/li` — roles come free from real elements. Reserve `role="..."` overrides for composite widgets (tabs, dialog, combobox).
- **Every user-facing string goes through `useTranslation()`** (i18n R-A07, `en.ts`) — tests assert on the *key-resolved* text.
- **Keep unit tests fast and isolated** — mock API calls (TanStack Query fetchers) rather than booting a server.
- **Playwright = journeys, not page loads** — one broad journey that exercises the real flow beats twenty smoke page-loads.

## Common mistakes

- Testing with `data-testid` because "it's easier" — this breaks the a11y contract and Playwright parity.
- `screen.getByText` on strings not actually rendered (i18n keys vs resolved values) — assert on `t("...")` output or the translated text.
- Forgetting `userEvent` setup (`userEvent.setup()`), which leads to flaky click handling.
- Component tests that render routes/pages needing a Router or QueryClient wrapper — use `MemoryRouter`/`QueryClientProvider` in the test, don't mock the router.
- Playwright tests that hit the real engine's LLM path — journeys must use News mode or seeded data (rate limit 5 rpm in dev; be patient).

## Validation

- `pnpm --filter @vorynth/desktop test` → all component suites pass.
- `pnpm --filter @vorynth/desktop test:e2e` → all journeys pass.
- `pnpm --filter @vorynth/desktop typecheck` + `lint` → clean.
- Manual: the affected screen still behaves identically for a real user.
