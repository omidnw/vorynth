import { describe, expect, it } from "vitest";
import type { Source } from "@vorynth/types";
import {
	buildSourceListFile,
	slugify,
	sourceToDefinition,
} from "./source-list-export.js";

function makeSource(overrides: Partial<Source> = {}): Source {
	return {
		id: "src-1",
		name: "Example Feed",
		url: "https://example.com/feed.xml",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: {},
		enabled: true,
		listId: null,
		country: "US",
		city: null,
		language: "en",
		scope: "global",
		authority: "official",
		impactAreas: ["ai", "security"],
		tags: null,
		fetchWindowDays: 7,
		fetchFrom: null,
		fetchTo: null,
		lastCheckedAt: null,
		createdAt: new Date("2026-01-01"),
		...overrides,
	};
}

describe("source-list-export (v1.8.0)", () => {
	it("slugifies a display name into a URL-safe id", () => {
		expect(slugify("My RSS Feeds!")).toBe("my-rss-feeds");
		expect(slugify("  ")).toBe("my-sources");
		expect(slugify("فارسی")).toBe("my-sources");
	});

	it("maps a source to a community-list definition", () => {
		const def = sourceToDefinition(makeSource());
		expect(def).toMatchObject({
			id: "src-1",
			name: "Example Feed",
			url: "https://example.com/feed.xml",
			adapter: "rss",
			country: "US",
			authority: "official",
			fetchWindowDays: 7,
		});
	});

	it("builds a my-sources.json in the community-list format", () => {
		const json = buildSourceListFile(
			{ name: "My Feeds", description: "Cool feeds", nsfw: false },
			[makeSource()],
		);
		const parsed = JSON.parse(json) as Record<string, unknown>;
		expect(parsed.id).toBe("my-feeds");
		expect(parsed.name).toBe("My Feeds");
		expect(parsed.version).toBe("1");
		expect((parsed.sources as unknown[]).length).toBe(1);
		// The shape matches what the engine's parseListFile expects.
		const src = (parsed.sources as Record<string, unknown>[])[0];
		expect(src).toMatchObject({
			id: "src-1",
			adapter: "rss",
			url: "https://example.com/feed.xml",
		});
	});

	it("includes the curator when provided", () => {
		const json = buildSourceListFile(
			{ name: "My Feeds", description: "", nsfw: false, curator: "jane" },
			[makeSource()],
		);
		expect(JSON.parse(json).curator).toBe("jane");
	});
});
