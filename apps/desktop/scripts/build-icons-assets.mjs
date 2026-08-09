/**
 * Offline Icon Pack Asset Builder (v1.8.0) — the Icon Pack core plugin's data.
 *
 * Emits into the gitignored `public/plugins/icons/`:
 *
 *   icons.lucide.json      Lucide icon set    — { icons: { "<kebab-name>": { v, e } } }
 *   icons.fa-solid.json    Font Awesome solid — same shape
 *   icons.fa-brands.json   Font Awesome brand — same shape
 *   fonts/fonts.css        All bundled @font-face rules (offline, unicode ranges kept)
 *   fonts/<name>.woff2     The font binaries referenced by fonts.css
 *   fonts/fonts.json       Catalog metadata for the gallery (family → weights/scripts)
 *
 * Icon data shape: each icon is `{ v: "minX minY width height", e: [[tag, attrs], …] }`
 * — the full SVG element tree, so circles/rects/lines survive (not just path `d`s).
 * The runtime SDK `Icon` component renders `e` inside an `<svg viewBox="v">`.
 *
 * Fonts: read the @fontsource css files (400/700 per family, italic where the
 * package ships it; CJK + script families get a single weight to control size),
 * rewrite the woff2 URLs to `/plugins/icons/fonts/…`, drop the woff fallbacks,
 * and copy the binaries. Keeps every unicode-range block intact, so the offline
 * fonts cover exactly what the CDN versions did.
 *
 * Usage:
 *   node scripts/build-icons-assets.mjs
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const FONTSOURCE = join(ROOT, "node_modules", "@fontsource");
const OUT_DIR = join(ROOT, "public", "plugins", "icons");
const FONTS_OUT = join(OUT_DIR, "fonts");

// ── Icon packages ─────────────────────────────────────────────────────────────

const { icons: lucideIcons } = await import("lucide");
const { fas } = await import("@fortawesome/free-solid-svg-icons");
const { fab } = await import("@fortawesome/free-brands-svg-icons");

/** PascalCase lucide name → kebab-case (AArrowDown → a-arrow-down). */
function pascalToKebab(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/** Serialize one lucide icon: [tag, attrs] tuples + fixed 24 viewBox. */
function lucideEntry(name) {
	return {
		v: "0 0 24 24",
		e: lucideIcons[name].map(([tag, attrs]) => [tag, attrs]),
	};
}

/** Serialize one Font Awesome icon: single path from icon[4], per-icon viewBox. */
function faEntry(definition) {
	const [w, h, , , d] = definition.icon;
	return { v: `0 0 ${w} ${h}`, e: [["path", { d }]] };
}

/** Build one icon-set JSON file. `icons` is a { name → entry } map. */
function writeIconSet(filename, icons, mode, defaultViewBox) {
	writeFileSync(
		join(OUT_DIR, filename),
		JSON.stringify({
			mode,
			...(defaultViewBox ? { v: defaultViewBox } : {}),
			icons,
		}) + "\n",
	);
	console.log(`  ✓ ${filename} (${Object.keys(icons).length} icons)`);
}

// ── Fonts ─────────────────────────────────────────────────────────────────────

/** @font-face blocks parse; src rewritten to the offline URL, woff dropped. */
function parseFontFaceBlocks(pkg, weight, style) {
	const cssFile = join(FONTSOURCE, pkg, `${weight}${style}.css`);
	if (!existsSync(cssFile)) return { blocks: [], files: [] };
	const css = readFileSync(cssFile, "utf8");
	const files = new Set();
	const blocks = [];
	const faceRe = /@font-face\s*\{([^}]*)\}/g;
	let m;
	while ((m = faceRe.exec(css)) !== null) {
		const body = m[1];
		const src = body.match(/src:\s*url\((['"]?)([^'")\s]+)\1\)\s*format\(['"]woff2['"]\)/);
		if (!src) continue;
		const woff2 = src[2]; // e.g. ./files/geist-latin-400-normal.woff2
		if (!woff2.startsWith("./files/")) continue;
		files.add(woff2.replace("./files/", ""));
		// Keep the block as-is but swap the src for the offline path.
		const rewritten = body.replace(
			/src:\s*url\((['"]?)([^'")\s]+)\1\)[^;]*/,
			`src: url('/plugins/icons/fonts/${woff2.replace("./files/", "")}') format('woff2');`,
		);
		blocks.push(`@font-face {${rewritten}\n}`);
	}
	return { blocks, files: [...files] };
}

/**
 * Font selection — which @fontsource packages/weights the pack ships.
 * Latin families get 400/700 (+ italic where available); CJK and script
 * families get a single weight to keep the bundle size sane.
 */
const FONT_SELECTION = [
	// Vorynth's own pair + popular English fonts.
	{ pkg: "newsreader", script: "latin", weights: [400, 500, 600, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "geist", script: "latin", weights: [400, 500, 600, 700], italic: false, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "inter", script: "latin", weights: [400, 500, 600, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "roboto", script: "latin", weights: [400, 500, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "lora", script: "latin", weights: [400, 600, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "open-sans", script: "latin", weights: [400, 600, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "montserrat", script: "latin", weights: [400, 600, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "poppins", script: "latin", weights: [400, 500, 700], italic: true, sample: "The quick brown fox jumps over the lazy dog — 0123456789" },
	{ pkg: "jetbrains-mono", script: "mono", weights: [400, 500, 700], italic: true, sample: "fn main() -> 42  // code 0123456789" },
	// Material Symbols Outlined (the app's icon font, now offline too).
	{ pkg: "material-symbols-outlined", script: "symbols", weights: [400, 500, 700], italic: false, sample: "settings dark_mode palette search book" },
	// Other scripts — single weight to control size.
	{ pkg: "vazirmatn", script: "persian", weights: [400, 700], italic: false, sample: "متن فارسی: الفبای فارسی و اعداد ۰۱۲۳" },
	{ pkg: "noto-sans-arabic", script: "arabic", weights: [400], italic: false, sample: "الحروف الأبجدية العربية ٠١٢٣" },
	{ pkg: "noto-sans-hebrew", script: "hebrew", weights: [400], italic: false, sample: "אַבְגָּדָה — עברית 0123" },
	{ pkg: "noto-sans-devanagari", script: "devanagari", weights: [400], italic: false, sample: "देवनागरी — हिन्दी ०१२३" },
	{ pkg: "noto-sans-thai", script: "thai", weights: [400], italic: false, sample: "ภาษาไทย ๐๑๒๓" },
	{ pkg: "noto-sans-jp", script: "japanese", weights: [400], italic: false, sample: "日本語のテキスト 0123" },
	{ pkg: "noto-sans-sc", script: "chinese", weights: [400], italic: false, sample: "简体中文文本 0123" },
	{ pkg: "noto-sans-kr", script: "korean", weights: [400], italic: false, sample: "한국어 텍스트 0123" },
];

/** The family name a fontsource package registers under (from its own css). */
function fontFamilyOf(pkg) {
	const css = readFileSync(join(FONTSOURCE, pkg, `${FONT_SELECTION.find((f) => f.pkg === pkg).weights[0]}.css`), "utf8");
	const m = css.match(/font-family:\s*(['"]?)([^;'"}\s]+)\1/);
	return m ? m[2] : pkg;
}

function buildFonts() {
	mkdirSync(FONTS_OUT, { recursive: true });
	// Start clean so removed weights don't linger.
	for (const f of readdirSync(FONTS_OUT)) {
		if (f !== "fonts.json") rmSync(join(FONTS_OUT, f), { force: true });
	}

	const cssBlocks = [];
	const catalog = [];
	let copied = 0;

	for (const entry of FONT_SELECTION) {
		const family = fontFamilyOf(entry.pkg);
		const weights = [];
		const styles = [];
		for (const weight of entry.weights) {
			for (const [style, suffix] of [
				["normal", ""],
				["italic", "-italic"],
			]) {
				if (style === "italic" && !entry.italic) continue;
				const { blocks, files } = parseFontFaceBlocks(entry.pkg, weight, suffix);
				if (blocks.length === 0) continue;
				for (const f of files) {
					const src = join(FONTSOURCE, entry.pkg, "files", f);
					if (existsSync(src)) {
						copyFileSync(src, join(FONTS_OUT, f));
						copied++;
					}
				}
				cssBlocks.push(...blocks);
				if (!weights.includes(String(weight))) weights.push(String(weight));
				if (!styles.includes(style)) styles.push(style);
			}
		}
		if (weights.length > 0) {
			catalog.push({ family, script: entry.script, weights, styles, sample: entry.sample });
		}
	}

	writeFileSync(join(FONTS_OUT, "fonts.css"), cssBlocks.join("\n"));
	writeFileSync(join(FONTS_OUT, "fonts.json"), JSON.stringify({ families: catalog }, null, 2) + "\n");
	console.log(`  ✓ fonts: ${catalog.length} families, ${copied} woff2 files, ${cssBlocks.length} @font-face rules`);
	return catalog;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`▶ building offline icon/font assets → ${OUT_DIR.replace(`${ROOT}/`, "")}`);
mkdirSync(OUT_DIR, { recursive: true });

// Lucide — every element tag (path/circle/rect/…) survives.
const lucideIconsOut = {};
for (const name of Object.keys(lucideIcons)) {
	lucideIconsOut[pascalToKebab(name)] = lucideEntry(name);
}
writeIconSet("icons.lucide.json", lucideIconsOut, "stroke", "0 0 24 24");

// Font Awesome solid + brands. `faHouse` → `house`, `faSquareRss` → `square-rss`.
const faSolidOut = {};
for (const [name, def] of Object.entries(fas)) {
	faSolidOut[pascalToKebab(name.replace(/^fa/, ""))] = faEntry(def);
}
writeIconSet("icons.fa-solid.json", faSolidOut, "fill");

const faBrandsOut = {};
for (const [name, def] of Object.entries(fab)) {
	faBrandsOut[pascalToKebab(name.replace(/^fa/, ""))] = faEntry(def);
}
writeIconSet("icons.fa-brands.json", faBrandsOut, "fill");

buildFonts();

// ── Self-check: the emitted assets must be parseable and self-consistent ─────

function sanityCheck() {
	const problems = [];
	const readJson = (file) => {
		try {
			return JSON.parse(readFileSync(join(OUT_DIR, file), "utf8"));
		} catch (err) {
			problems.push(`${file}: unparseable JSON (${err.message})`);
			return null;
		}
	};
	for (const file of ["icons.lucide.json", "icons.fa-solid.json", "icons.fa-brands.json"]) {
		const data = readJson(file);
		if (data && Object.keys(data.icons ?? {}).length === 0) {
			problems.push(`${file}: no icons`);
		}
	}
	const catalog = readJson(join("fonts", "fonts.json"));
	const css = readFileSync(join(FONTS_OUT, "fonts.css"), "utf8");
	const referenced = [...css.matchAll(/url\('\/plugins\/icons\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
	const onDisk = new Set(readdirSync(FONTS_OUT));
	const missing = [...new Set(referenced)].filter((f) => !onDisk.has(f));
	if (missing.length > 0) problems.push(`fonts.css references missing files: ${missing.join(", ")}`);
	if (catalog && catalog.families.length === 0) problems.push("fonts.json: no families");
	if (problems.length > 0) {
		console.error(`✗ icon/font asset self-check FAILED:\n  - ${problems.join("\n  - ")}`);
		process.exit(1);
	}
	console.log(`✓ self-check: ${referenced.length} font files referenced all present, ${catalog.families.length} families cataloged`);
}

sanityCheck();

console.log("✓ icon/font assets complete");
