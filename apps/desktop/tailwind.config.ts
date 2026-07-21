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
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
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
				headline: ["Newsreader", "ui-serif", "Georgia", "serif"],
				body: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
				label: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
				mono: ["Geist", "ui-monospace", "SFMono-Regular", "monospace"],
			},
			fontSize: {
				// Ported verbatim from examples/colors/*.md.
				"display-lg": [
					"48px",
					{ lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "500" },
				],
				"headline-lg": [
					"32px",
					{ lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "500" },
				],
				"headline-lg-mobile": [
					"28px",
					{ lineHeight: "36px", fontWeight: "500" },
				],
				"headline-md": ["24px", { lineHeight: "32px", fontWeight: "500" }],
				"body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
				"body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
				"label-md": [
					"14px",
					{ lineHeight: "20px", letterSpacing: "0.02em", fontWeight: "600" },
				],
				"label-sm": [
					"12px",
					{ lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" },
				],
				"mono-technical": ["13px", { lineHeight: "20px", fontWeight: "400" }],
			},
			maxWidth: {
				content: "800px",
			},
		},
	},
};

export default config;
