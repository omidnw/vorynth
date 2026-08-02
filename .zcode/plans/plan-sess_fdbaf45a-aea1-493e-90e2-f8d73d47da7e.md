## Fix: Dark mode button hover readability

### Changes in 3 files:

### 1. `apps/desktop/src/components/ui/Button.tsx`

**Secondary variant — fix invisible hover text:**
```
- "hover:bg-primary-container hover:text-on-primary"
+ "hover:bg-primary-container hover:text-on-primary-container"
```
`on-primary-container` in dark mode = `#809691` (medium gray-green on `#1A2E2A` bg) — readable.
In light mode: `#809691` on `#1A2E2A` — also readable.

**Primary variant — fix opacity breaking contrast:**
```
- "hover:opacity-90"
+ "hover:brightness-105"
```
`brightness` scales bg AND text equally, **preserving the contrast ratio**. Works in both modes:
- Light: near-black bg → subtle brightening ✓
- Dark: light bg → subtle brightening, text stays readable ✓

### 2. `apps/desktop/src/components/shell/ThemeToggle.tsx`

**Improve hover visibility in dark mode:**
```
- "hover:text-primary"
+ "hover:text-on-surface"
```
In dark mode: `#C2C8C5` → `#DDE4E0` (brighter, clearly visible). 
In light mode: `#424846` → `#191C1D` (darker, clearly visible).

### No changes needed
- **Ghost variant** — already has `dark:hover:bg-tertiary-container` with light text, contrast is fine.
- **Page-level buttons** (period chips, sort toggles, delete icons) — their hover colors (surface-variant bg, error red) are readable in dark mode.
- **Toggle.tsx** — no hover styles, but the icon color (`text-on-surface-variant` = `#C2C8C5`) is visible on dark bg.
