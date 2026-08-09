/**
 * Generate `src/db/developer-seed.generated.ts` from `sources/developer.json`.
 *
 * The official "developer" source list lives as JSON in the repo's `sources/`
 * folder (the single source of truth — it is also served from the GitHub
 * catalog). The engine cannot import that file directly (it sits outside
 * `rootDir`), so this script derives a typed TS module from it; ncc then
 * inlines that module into the sidecar bundle at build time — the official
 * sources ship inside the app, no network needed.
 *
 *   node apps/core-engine/scripts/generate-seed.mjs
 *
 * Run it whenever `sources/developer.json` changes, then commit BOTH files.
 * A type-only import keeps the derived module's type reference to `ddl.ts`
 * (erased at runtime — no circular dependency).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const jsonPath = join(repoRoot, "sources", "developer.json");
const outPath = join(
	repoRoot,
	"apps",
	"core-engine",
	"src",
	"db",
	"developer-seed.generated.ts",
);

/** Render a JSON value as a TypeScript literal. */
function tsValue(v) {
	if (v === null) return "null";
	if (typeof v === "string") return JSON.stringify(v);
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (Array.isArray(v)) return `[${v.map(tsValue).join(", ")}]`;
	if (typeof v === "object") {
		const entries = Object.entries(v).map(
			([k, val]) => `${k}: ${tsValue(val)}`,
		);
		return `{ ${entries.join(", ")} }`;
	}
	throw new Error(`unsupported value: ${String(v)}`);
}

const list = JSON.parse(readFileSync(jsonPath, "utf8"));

if (!list.id || !Array.isArray(list.sources) || list.sources.length === 0) {
	throw new Error(
		"sources/developer.json must have an id and non-empty sources",
	);
}

// The SeedSource type carries `listId` and has no `fetchWindowDays` — the
// field is catalog-only (the crawler defaults it to 7 via enable()).
const sourceObjects = list.sources.map((s) => {
	const keys = [
		"id",
		"name",
		"url",
		"type",
		"category",
		"adapter",
		"configuration",
	];
	const lines = [
		keys.map((k) => `\t\t${k}: ${tsValue(s[k])},`).join("\n"),
		'\t\tlistId: "developer",',
		`\t\tcountry: ${tsValue(s.country ?? null)},`,
		`\t\tcity: ${tsValue(s.city ?? null)},`,
		`\t\tlanguage: ${tsValue(s.language ?? "en")},`,
	];
	return `\t{\n${lines.join("\n")}\n\t}`;
});

const header = `/**
 * AUTO-GENERATED from sources/developer.json — DO NOT EDIT BY HAND.
 * Regenerate with: node apps/core-engine/scripts/generate-seed.mjs
 *
 * The official "developer" source list. sources/developer.json is the single
 * source of truth (also served from the GitHub catalog); this module is the
 * build-time-bundled seed — ncc inlines it into the engine sidecar so the
 * official sources ship inside the app, offline.
 */
import type { SeedSource, SourceListSeed } from "./ddl.js";

export const DEVELOPER_SEED_LIST: SourceListSeed = {
\tid: ${tsValue(list.id)},
\tname: ${tsValue(list.name)},
\tdescription: ${tsValue(list.description)},
\torigin: "official",
\tnsfw: ${tsValue(list.nsfw ?? false)},
\tversion: ${tsValue(list.version ?? null)},
};

export const DEVELOPER_SEED_SOURCES: SeedSource[] = [
${sourceObjects.join(",\n")}
];
`;

writeFileSync(outPath, header, "utf8");
console.log(
	`✓ wrote ${outPath} (${list.sources.length} sources from ${jsonPath})`,
);
