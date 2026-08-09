import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { en } from "./en.js";

/**
 * Guards the i18n catalog against drift: every static `t("key")` used anywhere
 * in `src` (except the i18n folder itself and test files) must exist in the
 * English catalog. `t()` calls are NOT type-checked against `TranslationCatalog`,
 * so this test is the only thing that catches a typo'd or forgotten key.
 * Dynamic template keys (e.g. `t(\`categories.${d}\`)`) are excluded — their
 * namespaces are asserted manually below.
 */

const SRC = join(process.cwd(), "src");
const I18N_DIR = join(SRC, "i18n");

function flatten(obj: Record<string, unknown>, prefix = ""): Set<string> {
	const keys = new Set<string>();
	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null) {
			for (const k of flatten(value as Record<string, unknown>, path))
				keys.add(k);
		} else {
			keys.add(path);
		}
	}
	return keys;
}

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
	}
	return out;
}

describe("i18n key coverage", () => {
	const pluralSuffixes = ["_one", "_other", "_few", "_many", "_two", "_zero"];

	it("every static t() key used in src exists in the English catalog", () => {
		const enKeys = flatten(en);
		const used = new Set<string>();
		const re = /\bt\(\s*["`]([^"`$]+)["`]/g;
		for (const file of walk(SRC)) {
			if (file.startsWith(I18N_DIR + sep) || file.includes(".test.")) continue;
			const source = readFileSync(file, "utf8");
			let match: RegExpExecArray | null;
			while ((match = re.exec(source))) {
				if (match[1]) used.add(match[1]);
			}
		}
		const missing = [...used]
			.filter(
				(k) =>
					!k.includes("${") &&
					!enKeys.has(k) &&
					// i18next plural: t("key", {count}) resolves to key_one/key_other…
					!pluralSuffixes.some((s) => enKeys.has(k + s)),
			)
			.sort();
		expect(missing, "t() keys missing from en.ts").toEqual([]);
	});

	it("the dynamic-template key namespaces exist in the catalog", () => {
		const enKeys = flatten(en);
		for (const ns of ["categories", "tiers", "scope", "authority", "types"]) {
			expect(
				[...enKeys].some((k) => k.startsWith(`${ns}.`)),
				`namespace ${ns} present`,
			).toBe(true);
		}
	});
});
