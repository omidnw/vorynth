#!/usr/bin/env node
/**
 * Plugin Package Builder (v1.8.0) — zips a plugin folder into an installable
 * `.vorynth-plugin` package.
 *
 * A `.vorynth-plugin` file is what the Plugins page "Install plugin" button
 * accepts: a ZIP that must contain `plugin.json` (the manifest: id, name,
 * version) and `bundle.js` (the built ESM bundle). Every other file in the
 * folder — icons, fonts, images, JSON assets — is included as-is, so plugins
 * can ship extra assets alongside the code.
 *
 * Usage:
 *   node scripts/package-plugin.mjs <plugin-dir> [-o out.vorynth-plugin]
 *
 *   node scripts/package-plugin.mjs plugins/reference
 *   node scripts/package-plugin.mjs plugins/my-plugin -o dist/my-plugin.vorynth-plugin
 *
 * Typical authoring flow (see plugins/README.md):
 *   1. Write the plugin:  plugins/<id>/plugin.json + plugins/<id>/src/index.tsx
 *   2. Build the bundle:  node scripts/build-plugin-bundles.mjs   (→ public/plugins/<id>/bundle.js)
 *   3. Stage bundle.js next to plugin.json, then package the folder.
 *
 * The script is also importable as a library: `packagePlugin(srcDir, outFile)`.
 */

import { zipSync } from "fflate";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import {
	basename,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

/** Collect every file under `dir` as `{ relative/posix/path: Buffer }`. */
function walk(dir, base, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, base, out);
		} else if (entry.isFile()) {
			out[relative(base, full).split(sep).join("/")] = readFileSync(full);
		}
	}
	return out;
}

/**
 * Build a `.vorynth-plugin` package from a plugin folder.
 *
 * @param srcDir plugin folder containing `plugin.json` + `bundle.js`
 * @param outFile destination `.vorynth-plugin` path
 * @returns the output path
 */
export function packagePlugin(srcDir, outFile) {
	if (!existsSync(srcDir)) {
		throw new Error(`Plugin folder not found: ${srcDir}`);
	}
	const manifestFile = join(srcDir, "plugin.json");
	const bundleFile = join(srcDir, "bundle.js");
	if (!existsSync(manifestFile)) {
		throw new Error(
			"Missing plugin.json — the manifest needs id, name, and version.",
		);
	}
	if (!existsSync(bundleFile)) {
		throw new Error(
			"Missing bundle.js — build it first (node scripts/build-plugin-bundles.mjs) and place it next to plugin.json.",
		);
	}

	let manifest;
	try {
		manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
	} catch {
		throw new Error("plugin.json isn't valid JSON.");
	}
	if (!manifest?.id || !manifest.name || !manifest.version) {
		throw new Error("plugin.json needs id, name, and version.");
	}

	const files = walk(srcDir, srcDir, {});
	const zip = zipSync(files);
	writeFileSync(outFile, Buffer.from(zip));
	return outFile;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
	console.log(
		"Usage: node scripts/package-plugin.mjs <plugin-dir> [-o out.vorynth-plugin]",
	);
	process.exit(0);
}

const srcDir = resolve(args[0]);
const flagIdx = args.indexOf("-o") !== -1 ? args.indexOf("-o") : args.indexOf("--output");
const outFile =
	flagIdx !== -1
		? resolve(args[flagIdx + 1])
		: join(process.cwd(), `${basename(srcDir)}.vorynth-plugin`);

try {
	const result = packagePlugin(srcDir, outFile);
	console.log(`✓ ${basename(result)} (${statSync(result).size} bytes)`);
} catch (err) {
	console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
}
