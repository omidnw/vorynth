---
name: Vorynth
colors:
  surface: '#f8fafa'
  surface-dim: '#d8dada'
  surface-bright: '#f8fafa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f4'
  surface-container: '#eceeee'
  surface-container-high: '#e6e8e9'
  surface-container-highest: '#e1e3e3'
  on-surface: '#191c1d'
  on-surface-variant: '#424846'
  inverse-surface: '#2e3131'
  inverse-on-surface: '#eff1f1'
  outline: '#727876'
  outline-variant: '#c2c8c5'
  surface-tint: '#4e635e'
  primary: '#051916'
  on-primary: '#ffffff'
  primary-container: '#1a2e2a'
  on-primary-container: '#809691'
  inverse-primary: '#b5cbc5'
  secondary: '#4f625e'
  on-secondary: '#ffffff'
  secondary-container: '#cfe4df'
  on-secondary-container: '#536662'
  tertiary: '#111716'
  on-tertiary: '#ffffff'
  tertiary-container: '#262b2b'
  on-tertiary-container: '#8d9292'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e7e1'
  primary-fixed-dim: '#b5cbc5'
  on-primary-fixed: '#0a1f1b'
  on-primary-fixed-variant: '#364b46'
  secondary-fixed: '#d2e7e2'
  secondary-fixed-dim: '#b6cbc6'
  on-secondary-fixed: '#0c1f1c'
  on-secondary-fixed-variant: '#384a47'
  tertiary-fixed: '#dee3e2'
  tertiary-fixed-dim: '#c2c7c7'
  on-tertiary-fixed: '#171d1c'
  on-tertiary-fixed-variant: '#424847'
  background: '#f8fafa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e3'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '500'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-technical:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 48px
  sidebar-width: 260px
  max-content-width: 800px
---

## Brand & Style
The design system is engineered for Vorynth, a personal intelligence engine that prioritizes signal over noise. The brand personality is rooted in high-fidelity precision, functioning as a sophisticated tool for thought rather than a typical social or consumer application. It targets professionals who value intellectual clarity and "local-first" privacy.

The visual direction follows a **Precision Minimalism** movement. It avoids the saturated gradients and "glow" effects common in AI products, opting instead for a "precision instrument" aesthetic. The UI relies on structural integrity, generous whitespace, and masterfully handled typography to create a sense of calm authority and technical excellence. The emotional response should be one of quiet focus and undistracted insight.

## Colors
The palette is a departure from traditional tech blues and indigos, utilizing a restrained, "Forest & Slate" spectrum that feels grounded and premium.

- **Primary (#1A2E2A):** A deep, near-black Forest Green used for high-contrast accents, primary buttons, and critical text. It provides the "anchor" for the technical aesthetic.
- **Secondary (#4A5D59):** A muted Sage Slate used for iconography and secondary UI elements.
- **Tertiary (#E5EAE9):** A soft, cool grey used for structural dividers and subtle background shifts.
- **Neutral (#F9FBFB):** The foundational canvas color. It is a high-clarity, atmospheric white that reduces eye strain and emphasizes content.

The system uses a "low-ink" approach: color is used only to denote action or status, never for decoration.

## Typography
Typography is the primary vehicle for brand expression in this design system. It utilizes a "Technical Editorial" pairing:

- **Headlines:** Newsreader (Medium weight) provides a traditional, authoritative, and literary feel. It creates a sense of "archival quality" for personal insights.
- **Body & Interface:** Geist is used for all functional text. Its precise, developer-friendly proportions reinforce the technical nature of the engine.

Use high-contrast sizing to create hierarchy. Use `label-sm` in all-caps with light tracking for domain tags and metadata to maintain a clean, organized appearance.

## Layout & Spacing
The layout follows a **Fixed-Column Insight** model. For high readability, the main content area is constrained to a maximum width of 800px, centered on the screen or offset by the sidebar.

- **Grid:** A 12-column grid is used for dashboard views, but the primary "understanding" view is single-column.
- **Sidebar:** A persistent 260px left navigation contains high-level domains and navigation. It uses a very subtle tertiary background to distinguish it from the main canvas.
- **Rhythm:** Spacing follows a strict 4px/8px baseline. Use 48px or 64px of vertical space between major content sections to maintain the "calm" atmosphere.

## Elevation & Depth
This design system rejects shadows and floating layers. Depth is communicated through **Tonal Segmentation** and **Structural Outlines**.

- **Surfaces:** Use shifts in background color (Neutral to Tertiary) to indicate hierarchy.
- **Borders:** Instead of shadows, use 1px solid dividers in Tertiary (#E5EAE9) to separate sections.
- **Atmospheric Depth:** Subtle gradients (white to #F4F6F6) may be used on long vertical scrolls to prevent the UI from feeling flat or "dead," but they should remain nearly imperceptible.

## Shapes
The shape language is "Soft-Technical." Elements use a 0.25rem (4px) base radius, creating a look that is precise and architectural without being aggressive. 

- **Small Components:** Inputs and badges use the base 4px radius.
- **Large Components:** Sections or containers use the `rounded-lg` (8px) radius.
- **Strict Rule:** No fully rounded "pill" shapes. All buttons and tags should maintain a defined rectangular structure with soft corners.

## Components

### Buttons
- **Primary:** Background `#1A2E2A`, text `#F9FBFB`, 4px radius. No shadows.
- **Secondary:** Transparent background, 1px border `#1A2E2A`, text `#1A2E2A`.
- **Ghost:** Transparent background, text `#4A5D59`, transitions to a subtle Tertiary background on hover.

### Importance Badges & Tags
- **Badges:** Small, technical labels using `label-sm`. They should not use bright colors. Use a light grey background with dark grey text for low importance, and the Primary color background with white text for "Signal" alerts.
- **Domain Tags:** Use `label-sm` with a 1px border of Tertiary and no background fill.

### Input Fields
- Understated design. A simple 1px border on the bottom or a full 1px border in Tertiary. Use Geist for input text. Focus state is indicated by the border color shifting to Secondary (#4A5D59).

### Cards
- Avoid traditional cards with shadows. Use "ghost cards" defined by a 1px Tertiary border and a slight background color change on hover to indicate interactivity.

### Sidebar Navigation
- Vertical list of items using `body-md`. The active state is indicated by a subtle vertical 2px line in the Primary color to the left of the label, rather than a full background highlight.