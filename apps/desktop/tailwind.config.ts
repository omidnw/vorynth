import containerQueries from "@tailwindcss/container-queries";
import type { Config } from "tailwind";

/**
 * Vorynth Tailwind config.
 *
 * Colors are exposed as CSS variables (`--color-*`) defined per-theme in
 * `src/styles/theme.css`. Light tokens come from `examples/colors/vorynth-light.md`,
 * dark tokens from `examples/colors/vorynth-dark.md`. Pointing Tailwind at
 * `rgb(var(--color-x) / <alpha-value>)` means light + dark both work from day
 * one with zero component rewrites — flipping `<html class="dark">` is all it
 * takes.
 *
 * Type scale, spacing, and radii are ported verbatim from the color docs.
 */
const config: Config = {
	darkMode: "class",
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
		"../../packages/ui/src/**/*.{ts,tsx}",
	],
	plugins: [containerQueries],
	theme: {
		extend: {
			colors: {
				// Surfaces
				surface: "rgb(var(--color-surface) / <alpha-value>)",
				"surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
				"surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
				"surface-container-lowest":
					"rgb(var(--color-surface-container-lowest) / <alpha-value>)",
				"surface-container-low":
					"rgb(var(--color-surface-container-low) / <alpha-value>)",
				"surface-container":
					"rgb(var(--color-surface-container) / <alpha-value>)",
				"surface-container-high":
					"rgb(var(--color-surface-container-high) / <alpha-value>)",
				"surface-container-highest":
					"rgb(var(--color-surface-container-highest) / <alpha-value>)",
				"surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
				"surface-tint": "rgb(var(--color-surface-tint) / <alpha-value>)",
				background: "rgb(var(--color-background) / <alpha-value>)",

				// Content on surfaces
				"on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
				"on-surface-variant":
					"rgb(var(--color-on-surface-variant) / <alpha-value>)",
				"on-background": "rgb(var(--color-on-background) / <alpha-value>)",

				// Primary
				primary: "rgb(var(--color-primary) / <alpha-value>)",
				"on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
				"primary-container":
					"rgb(var(--color-primary-container) / <alpha-value>)",
				"on-primary-container":
					"rgb(var(--color-on-primary-container) / <alpha-value>)",
				"primary-fixed": "rgb(var(--color-primary-fixed) / <alpha-value>)",
				"primary-fixed-dim":
					"rgb(var(--color-primary-fixed-dim) / <alpha-value>)",
				"on-primary-fixed":
					"rgb(var(--color-on-primary-fixed) / <alpha-value>)",
				"on-primary-fixed-variant":
					"rgb(var(--color-on-primary-fixed-variant) / <alpha-value>)",

				// Secondary
				secondary: "rgb(var(--color-secondary) / <alpha-value>)",
				"on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
				"secondary-container":
					"rgb(var(--color-secondary-container) / <alpha-value>)",
				"on-secondary-container":
					"rgb(var(--color-on-secondary-container) / <alpha-value>)",
				"secondary-fixed": "rgb(var(--color-secondary-fixed) / <alpha-value>)",
				"secondary-fixed-dim":
					"rgb(var(--color-secondary-fixed-dim) / <alpha-value>)",
				"on-secondary-fixed":
					"rgb(var(--color-on-secondary-fixed) / <alpha-value>)",
				"on-secondary-fixed-variant":
					"rgb(var(--color-on-secondary-fixed-variant) / <alpha-value>)",

				// Tertiary
				tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
				"on-tertiary": "rgb(var(--color-on-tertiary) / <alpha-value>)",
				"tertiary-container":
					"rgb(var(--color-tertiary-container) / <alpha-value>)",
				"on-tertiary-container":
					"rgb(var(--color-on-tertiary-container) / <alpha-value>)",
				"tertiary-fixed": "rgb(var(--color-tertiary-fixed) / <alpha-value>)",
				"tertiary-fixed-dim":
					"rgb(var(--color-tertiary-fixed-dim) / <alpha-value>)",
				"on-tertiary-fixed":
					"rgb(var(--color-on-tertiary-fixed) / <alpha-value>)",
				"on-tertiary-fixed-variant":
					"rgb(var(--color-on-tertiary-fixed-variant) / <alpha-value>)",

				// Outline
				outline: "rgb(var(--color-outline) / <alpha-value>)",
				"outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",

				// Inverse
				"inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
				"inverse-on-surface":
					"rgb(var(--color-inverse-on-surface) / <alpha-value>)",
				"inverse-primary": "rgb(var(--color-inverse-primary) / <alpha-value>)",

				// Error
				error: "rgb(var(--color-error) / <alpha-value>)",
				"on-error": "rgb(var(--color-on-error) / <alpha-value>)",
				"error-container": "rgb(var(--color-error-container) / <alpha-value>)",
				"on-error-container":
					"rgb(var(--color-on-error-container) / <alpha-value>)",

				// Accent gold (dark theme — high-importance signals only)
				gold: "rgb(var(--color-gold) / <alpha-value>)",
			},
			borderRadius: {
				// "Soft-Technical": 4px base, 8px containers, no pills.
				DEFAULT: "0.125rem",
				sm: "0.125rem",
				md: "0.375rem",
				lg: "0.5rem",
				xl: "0.75rem",
				full: "9999px",
			},
			spacing: {
				unit: "4px",
				gutter: "24px",
				"margin-mobile": "20px",
				"margin-desktop": "48px",
				"sidebar-width": "260px",
				"max-content-width": "800px",
			},
			fontFamily: {
				// v1.8.0 — var-backed so the Settings font picker can re-skin the
				// whole app by overriding --font-* (globals.css :root defaults).
				headline: ["var(--font-headline)", "ui-serif", "Georgia", "serif"],
				body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
				label: [
					"var(--font-label)",
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
				],
				mono: [
					"var(--font-mono)",
					"ui-monospace",
					"SFMono-Regular",
					"monospace",
				],
			},
			fontSize: {
				// Ported verbatim from examples/colors/*.md. Sizes are scaled by
				// --font-scale (v1.8.0 font-size slider; defaults to 1).
				"display-lg": [
					"calc(48px * var(--font-scale))",
					{ lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "500" },
				],
				"headline-lg": [
					"calc(32px * var(--font-scale))",
					{ lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "500" },
				],
				"headline-lg-mobile": [
					"calc(28px * var(--font-scale))",
					{ lineHeight: "36px", fontWeight: "500" },
				],
				"headline-md": [
					"calc(24px * var(--font-scale))",
					{ lineHeight: "32px", fontWeight: "500" },
				],
				"body-lg": [
					"calc(18px * var(--font-scale))",
					{ lineHeight: "28px", fontWeight: "400" },
				],
				"body-md": [
					"calc(16px * var(--font-scale))",
					{ lineHeight: "24px", fontWeight: "400" },
				],
				"label-md": [
					"calc(14px * var(--font-scale))",
					{ lineHeight: "20px", letterSpacing: "0.02em", fontWeight: "600" },
				],
				"label-sm": [
					"calc(12px * var(--font-scale))",
					{ lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" },
				],
				"mono-technical": [
					"calc(13px * var(--font-scale))",
					{ lineHeight: "20px", fontWeight: "400" },
				],
			},
			maxWidth: {
				content: "800px",
			},
			// v1.8.0 — the motion system (R-D08): every panel/modal/sidebar that
			// opens or closes animates. Keyframes live here so `animate-*`
			// utilities are generated; the exit half is handled by keeping the
			// element mounted and toggling a data-exiting flag (see Reveal.tsx).
			keyframes: {
				"fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				"fade-out": {
					from: { opacity: "1" },
					to: { opacity: "0" },
				},
				"scale-in": {
					from: { opacity: "0", transform: "scale(0.96)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
				"slide-in-start": {
					from: { opacity: "0", transform: "translateX(1rem)" },
					to: { opacity: "1", transform: "translateX(0)" },
				},
				"slide-in-end": {
					from: { opacity: "0", transform: "translateX(-1rem)" },
					to: { opacity: "1", transform: "translateX(0)" },
				},
				// The history drawer: a real slide in from the inline-end edge.
				"slide-in-end-full": {
					from: { transform: "translateX(100%)" },
					to: { transform: "translateX(0)" },
				},
				// Exit halves — the exact reverse of the enter keyframes, so a
				// panel's close animation mirrors its open (R-D08: closing is
				// the reverse of opening, not a generic fade).
				"scale-out": {
					from: { opacity: "1", transform: "scale(1)" },
					to: { opacity: "0", transform: "scale(0.96)" },
				},
				"slide-out-start": {
					from: { opacity: "1", transform: "translateX(0)" },
					to: { opacity: "0", transform: "translateX(1rem)" },
				},
				"slide-out-end": {
					from: { opacity: "1", transform: "translateX(0)" },
					to: { opacity: "0", transform: "translateX(-1rem)" },
				},
				"slide-out-end-full": {
					from: { transform: "translateX(0)" },
					to: { transform: "translateX(100%)" },
				},
			},
			animation: {
				"fade-in": "fade-in 180ms ease-out",
				// Exit animations hold their end state (forwards) so a panel
				// stays hidden after its exit finishes until Reveal unmounts it
				// — without it, the element snaps back to full opacity the
				// moment the animation completes and the screen flickers.
				"fade-out": "fade-out 180ms ease-in forwards",
				"scale-in": "scale-in 160ms cubic-bezier(0.2, 0.8, 0.3, 1)",
				"slide-in-start": "slide-in-start 220ms cubic-bezier(0.2, 0.8, 0.3, 1)",
				"slide-in-end": "slide-in-end 220ms cubic-bezier(0.2, 0.8, 0.3, 1)",
				"slide-in-end-full":
					"slide-in-end-full 260ms cubic-bezier(0.2, 0.8, 0.3, 1)",
				"scale-out": "scale-out 160ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
				"slide-out-start":
					"slide-out-start 220ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
				"slide-out-end":
					"slide-out-end 220ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
				"slide-out-end-full":
					"slide-out-end-full 260ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
			},
		},
	},
};

export default config;
