/**
 * Plugin Bundle Builder (v1.9.0) — compiles each runtime UI plugin's source
 * into a self-contained ESM bundle the app loads at runtime.
 *
 * For every `plugins/<id>/src/index.tsx`:
 *   esbuild → `public/plugins/<id>/bundle.js`
 *
 * React, react-dom, and react/jsx-runtime are ALIASED to the host shims
 * (`src/plugins/host/*.ts`) instead of being bundled, so a plugin shares the
 * app's single React instance at runtime. `@vorynth/plugin-host` is aliased to
 * the SDK surface (`host-bridge.ts`) which reads `window.__VORYNTH_HOST__`.
 * `@vorynth/types` imports are type-only and dropped by esbuild.
 *
 * Output lands in `public/` so Vite serves it at `/plugins/<id>/bundle.js`
 * (dev and production), matching what `plugin-loader.ts` fetches.
 *
 * Usage:
 *   node scripts/build-plugin-bundles.mjs
 */

import { existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const OUT_DIR = join(ROOT, "public", "plugins");
const HOST_DIR = join(ROOT, "src", "plugins", "host");

const esbuild = await import("esbuild");

/** Plugin dirs that have a src/index.tsx entry. */
function discoverPlugins() {
	if (!existsSync(PLUGINS_DIR)) return [];
	return readdirSync(PLUGINS_DIR, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => join(PLUGINS_DIR, e.name))
		.filter((dir) => existsSync(join(dir, "src", "index.tsx")));
}

const plugins = discoverPlugins();
if (plugins.length === 0) {
	console.log("No runtime UI plugins to bundle.");
	process.exit(0);
}

console.log(`▶ bundling ${plugins.length} runtime UI plugin(s) → ${OUT_DIR}`);

for (const dir of plugins) {
	const id = dir.split(/[\\/]/).pop();
	const entry = join(dir, "src", "index.tsx");
	const outfile = join(OUT_DIR, id, "bundle.js");

	await esbuild.build({
		entryPoints: [entry],
		outfile,
		bundle: true,
		format: "esm",
		target: "es2022",
		jsx: "automatic",
		sourcemap: false,
		// Route React + the SDK through the host shims so plugin bundles stay
		// tiny and share the app's instances at runtime.
		alias: {
			react: join(HOST_DIR, "react.ts"),
			"react-dom": join(HOST_DIR, "react-dom.ts"),
			"react/jsx-runtime": join(HOST_DIR, "react-jsx-runtime.ts"),
			"@vorynth/plugin-host": join(HOST_DIR, "host-bridge.ts"),
		},
		logLevel: "warning",
	});
	console.log(`  ✓ ${id} → ${outfile.replace(`${ROOT}/`, "")}`);
}

console.log("✓ plugin bundles complete");
