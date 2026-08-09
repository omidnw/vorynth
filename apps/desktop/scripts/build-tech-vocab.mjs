/**
 * Generate `src/vocab/tech-catalog.json` from `@sparring/tech-catalog`.
 *
 * The package is a build-time-only devDependency: this script extracts its
 * technology names + categories into a compact, committed JSON that the
 * runtime imports (no package in the shipped bundle). It is the
 * "vocabulary provider" for source-tag / category suggestions — never the
 * source of truth (tags stay free-form, R-A06).
 *
 *   pnpm build:plugins   (runs on predev + prebuild)
 *   node scripts/build-tech-vocab.mjs
 *
 * Fallback: if the package can't be imported (registry hiccup, broken build),
 * the script logs a warning and writes `{ names: [], types: [] }` — the app
 * degrades to its own vocabulary (categories + impact areas + existing tags)
 * instead of failing the build.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "vocab", "tech-catalog.json");

/** Same slug rule as the engine's tag normalizer. */
function slugify(name) {
	return String(name)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

let names = [];
let types = [];
try {
	const mod = await import("@sparring/tech-catalog");
	const all = mod.getTechnologies?.() ?? [];
	const unique = new Set();
	for (const tech of all) {
		const slug = slugify(tech.nombre ?? "");
		if (slug.length >= 2 && slug.length <= 64) unique.add(slug);
		if (typeof tech.tipo === "string" && tech.tipo.trim()) {
			const t = slugify(tech.tipo);
			if (t && !types.includes(t)) types.push(t);
		}
	}
	names = [...unique].sort();
	types.sort();
	console.log(
		`• tech-catalog: ${all.length} entries → ${names.length} tag slugs, ${types.length} types`,
	);
} catch (err) {
	console.warn(
		`⚠ @sparring/tech-catalog unavailable (${err.message}) — using an empty vocab; the app falls back to its own vocabulary`,
	);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ names, types }, null, "\t") + "\n", "utf8");
console.log(`✓ wrote ${outPath}`);
