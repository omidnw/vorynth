import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Vitest config for the desktop app (component/unit tests).
 *
 * Mirrors `vite.config.ts` (same react plugin + `@` alias) so tests resolve
 * imports exactly like the app. jsdom environment; CSS imports are stubbed
 * (components importing `globals.css`-adjacent styles are common).
 *
 * Playwright e2e (critical user journeys) lives separately — see
 * `playwright.config.ts` once the journey suite lands.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			// The plugin SDK — aliased the same way the bundle builder aliases it
			// (esbuild `alias: { "@vorynth/plugin-host": host-bridge.ts }`), so
			// plugin source imports resolve identically in tests.
			"@vorynth/plugin-host": fileURLToPath(
				new URL("./src/plugins/host/host-bridge.ts", import.meta.url),
			),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		css: false,
	},
});
