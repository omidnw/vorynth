import type { Source, SourceListSourceDefinition } from "@vorynth/types";

/**
 * my-sources.json export (v1.8.0).
 *
 * The exported file uses the EXACT community-list format the engine's
 * source-lists catalog accepts (`{id, name, description, nsfw, version,
 * curator, sources: [...]}`) — so it can be re-imported by anyone, shared, or
 * dropped into the Vorynth repo under `sources/<curator>/` to become a
 * community list. `buildSourceListFile` is pure (unit-testable); the download
 * is a plain Blob save, same as the i18n-catalog export.
 */

export interface SourceListExportMeta {
	name: string;
	description: string;
	nsfw: boolean;
	/** Optional curator/author for the file (used when publishing to the repo). */
	curator?: string;
}

/** "My RSS feeds" → "my-rss-feeds" — the file id must be a URL-safe slug. */
export function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48) || "my-sources"
	);
}

/** Map a stored source to a community-list source definition. */
export function sourceToDefinition(source: Source): SourceListSourceDefinition {
	return {
		id: source.id,
		name: source.name,
		url: source.url,
		type: source.type,
		category: source.category,
		adapter: source.adapter,
		configuration: source.configuration,
		fetchWindowDays: source.fetchWindowDays,
		country: source.country ?? undefined,
		city: source.city ?? undefined,
		language: source.language ?? undefined,
		scope: source.scope ?? undefined,
		authority: source.authority ?? undefined,
		impactAreas: source.impactAreas ?? undefined,
	};
}

/** Build the community-list JSON text for a set of sources. */
export function buildSourceListFile(
	meta: SourceListExportMeta,
	sources: Source[],
): string {
	const list = {
		id: slugify(meta.name),
		name: meta.name.trim(),
		description: meta.description.trim(),
		nsfw: meta.nsfw,
		version: "1",
		...(meta.curator?.trim() ? { curator: meta.curator.trim() } : {}),
		sources: sources.map(sourceToDefinition),
	};
	return JSON.stringify(list, null, 2);
}

/** Save the built file as `my-sources.json`. */
export function downloadSourceListFile(json: string): void {
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "my-sources.json";
	a.click();
	URL.revokeObjectURL(url);
}
