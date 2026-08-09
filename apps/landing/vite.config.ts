import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site under /vorynth/ — the Pages workflow sets
// VITE_BASE_URL. Locally (dev / preview) it defaults to "/".
const base = process.env.VITE_BASE_URL || "/";

export default defineConfig({
	plugins: [react()],
	base,
	server: {
		// Distinct from the desktop dev server (5173) so `pnpm dev:landing` and
		// `pnpm dev:desktop` can run side by side.
		port: 5174,
		strictPort: true,
	},
	resolve: {
		alias: {
			// The real desktop app source — the preview renders the actual
			// ShellLayout + BriefPage screens. Only the engine API is mocked
			// (see src/mock-engine.ts).
			"@": fileURLToPath(new URL("../desktop/src", import.meta.url)),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
	},
});
