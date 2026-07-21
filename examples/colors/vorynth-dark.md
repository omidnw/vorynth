---
name: Obsidian Intelligence
colors:
  surface: '#0e1513'
  surface-dim: '#0e1513'
  surface-bright: '#333b38'
  surface-container-lowest: '#09100e'
  surface-container-low: '#161d1b'
  surface-container: '#1a211f'
  surface-container-high: '#242b29'
  surface-container-highest: '#2f3634'
  on-surface: '#dde4e0'
  on-surface-variant: '#c2c8c5'
  inverse-surface: '#dde4e0'
  inverse-on-surface: '#2b3230'
  outline: '#8c9290'
  outline-variant: '#424846'
  surface-tint: '#b5cbc5'
  primary: '#b5cbc5'
  on-primary: '#203430'
  primary-container: '#1a2e2a'
  on-primary-container: '#809691'
  inverse-primary: '#4e635e'
  secondary: '#bacbbe'
  on-secondary: '#25342a'
  secondary-container: '#3b4a40'
  on-secondary-container: '#a9b9ac'
  tertiary: '#e6c183'
  on-tertiary: '#422c00'
  tertiary-container: '#3a2700'
  on-tertiary-container: '#ae8d54'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d0e7e1'
  primary-fixed-dim: '#b5cbc5'
  on-primary-fixed: '#0a1f1b'
  on-primary-fixed-variant: '#364b46'
  secondary-fixed: '#d6e7d9'
  secondary-fixed-dim: '#bacbbe'
  on-secondary-fixed: '#111e16'
  on-secondary-fixed-variant: '#3b4a40'
  tertiary-fixed: '#ffdeaa'
  tertiary-fixed-dim: '#e6c183'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5c4210'
  background: '#0e1513'
  on-background: '#dde4e0'
  surface-variant: '#2f3634'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
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
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1440px
---

## Brand & Style
The design system embodies a "High-Intelligence Obsidian" aesthetic, tailored for deep focus, strategic analysis, and executive clarity. The brand personality is authoritative yet quiet, prioritizing information density without sacrificing the premium feel of a luxury tool.

The visual style is a hybrid of **Minimalism** and **Tactile Depth**. It avoids the artificiality of "gamer" dark modes (no neon or indigo) in favor of organic, mineral tones. The UI should feel like a physical interface carved from volcanic glass and polished stone, utilizing subtle gradients to define structural depth rather than aggressive shadows. 

**Emotional Response:** Focused, secure, sophisticated, and intellectually empowered.

## Colors
The palette is rooted in Earth’s deep lithosphere. 

- **Primary (Deep Forest):** Used for structural brand moments and primary action backgrounds. It provides a biological warmth to the dark interface.
- **Surface (Deep Charcoal-Green):** The foundational canvas. It is not a flat black but a highly desaturated dark green to maintain atmospheric depth.
- **Accents (Sage & Gold):** 
    - **Muted Sage (#8A9A8E):** Used for positive trends, active states, and secondary emphasis.
    - **Gold (#C5A267):** Reserved exclusively for high-importance signals, premium features, or "North Star" metrics.
- **Text:** High clarity is maintained with an off-white tint (#E0E4E3) to reduce eye strain against the dark background while maintaining a crisp, paper-like legibility.

## Typography
The typography system uses three distinct typefaces to separate intent:
- **Hanken Grotesk (Headlines):** Provides a sharp, contemporary professional edge.
- **Manrope (Body):** Offers a balanced, calm reading experience for dense data and analysis.
- **Geist (Labels/Mono):** Used for technical metadata and labels to reinforce the "intelligence tool" precision.

Maintain tight tracking on display sizes and generous line heights for body copy to ensure the dark theme remains legible during extended sessions.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop to ensure data remains structured and predictable. 

- **Grid:** 12-column grid with 24px gutters.
- **Spacing Rhythm:** Based on a 4px baseline. Use 16px, 24px, and 48px increments for vertical rhythm.
- **Desktop:** Wide margins (64px) create a sense of premium "breathing room."
- **Mobile:** Transition to a fluid 4-column layout with 20px margins.

Content should be grouped into logical "clusters" using padding rather than heavy lines to maintain a clean, obsidian-like surface.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Subtle Gradients**. 

- **Surface Levels:** Instead of shadows, use slight color shifts. Base background is #0D1412; elevated cards use #141D1B.
- **Gradients:** Apply a very subtle linear gradient (Top: #1A2E2A at 10% opacity to Bottom: Transparent) on primary containers to simulate light hitting a polished stone surface.
- **Borders:** Use low-contrast "inner strokes" (1px, #FFFFFF at 5% opacity) on cards to define edges against the dark background.
- **Shadows:** Only used for floating modals—soft, large-radius blurs (#000000 at 40% opacity).

## Shapes
Shapes are disciplined and architectural. 

- **Corner Radius:** Use the "Soft" (0.25rem) setting for standard UI elements like inputs and small buttons. 
- **Cards:** Use `rounded-lg` (0.5rem) for main content containers to provide just enough softness to feel modern without losing the "Obsidian" precision.
- Avoid pill-shaped buttons unless used for tags or chips.

## Components
- **Buttons:** 
    - *Primary:* Deep Forest (#1A2E2A) background with a 1px Sage border.
    - *Secondary:* Transparent background with a subtle inner-glow border.
- **Input Fields:** Darker than the surface (#080B0A), utilizing an inset shadow and the Geist font for user-entered text.
- **Cards:** No outer shadows. Use a subtle 1px border (#232D2B) and a slight top-to-bottom dark gradient.
- **Importance Signals:** Use the Gold accent (#C5A267) sparingly for icons or thin 2px left-borders on urgent list items.
- **Data Visuals:** Charts should use the primary Sage and Deep Forest colors, with Gold for the singular "key" data point.