// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Root ESLint flat config.
 *
 * Applies to every workspace package. Mirrors the conventions of the
 * LangGraph starter (strict TS rules, no unused vars, browser + node globals
 * where appropriate). Per-package overrides can extend this.
 */
export default tseslint.config(
	{
		ignores: [
			"**/dist/**",
			"**/build/**",
			"**/node_modules/**",
			"**/coverage/**",
			"apps/desktop/src-tauri/**",
			"apps/desktop/dist/**",
			"apps/core-engine/dist/**",
			"examples/**",
			"**/*.config.{js,cjs,mjs,ts}",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" },
			],
		},
	},
	{
		files: ["apps/desktop/src/**/*.{ts,tsx}"],
		languageOptions: {
			globals: {
				window: "readonly",
				document: "readonly",
				localStorage: "readonly",
				fetch: "readonly",
				console: "readonly",
			},
		},
	},
);
