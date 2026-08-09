import { describe, expect, it } from "vitest";
import {
	CURRENT_VERSION,
	RELEASES,
	type ChangeType,
} from "@/features/changelog/changelog-data.js";

/**
 * Changelog data integrity (v1.8.0).
 *
 * The changelog is the app's string-heaviest data file, and a single stray
 * double quote inside a double-quoted string broke esbuild's transform once —
 * the dev server died with a cryptic `Expected "}" but found "…"` pointing at
 * the middle of a sentence (the "Theme identity" technical entry). Two guards:
 *
 *   1. Importing the module here runs it through the exact same esbuild
 *      transform the dev server uses — a parse error fails the import and the
 *      whole test file, catching the breakage where tsc alone might be skipped.
 *   2. The structural checks below catch entries that *parse* but are broken:
 *      truncated text, empty summaries, duplicate/out-of-order versions.
 */

const VALID_TYPES: readonly ChangeType[] = [
	"new",
	"improved",
	"fixed",
	"security",
];

function toVersionTuple(v: string): [number, number, number] {
	const [major, minor, patch] = v.split(".").map(Number);
	return [major, minor, patch] as [number, number, number];
}

describe("changelog-data — data file integrity", () => {
	it("loads as a module (guards against string-escape/transform breakage)", () => {
		// If changelog-data.ts fails to parse, this import already throws and
		// the test errors — the exact failure mode that killed the dev server.
		expect(RELEASES).toBeInstanceOf(Array);
		expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("keeps the newest release in sync with the shipped version", () => {
		expect(RELEASES.length).toBeGreaterThan(0);
		expect(RELEASES[0]?.version).toBe(CURRENT_VERSION);
	});

	it("every release is well-formed", () => {
		for (const release of RELEASES) {
			expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
			expect(release.codename.trim().length).toBeGreaterThan(0);
			expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(release.summary.trim().length).toBeGreaterThan(0);
			expect(release.changes.length).toBeGreaterThan(0);
			for (const change of release.changes) {
				expect(VALID_TYPES).toContain(change.type);
				expect(change.text.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it("versions are unique and listed newest-first", () => {
		const versions = RELEASES.map((r) => r.version);
		expect(new Set(versions).size).toBe(versions.length);
		for (let i = 1; i < versions.length; i++) {
			const prev = toVersionTuple(versions[i - 1]!);
			const next = toVersionTuple(versions[i]!);
			const cmp = prev[0] - next[0] || prev[1] - next[1] || prev[2] - next[2];
			expect(cmp).toBeGreaterThan(0);
		}
	});

	it("the shipped release has its placeholder entries removed", () => {
		// The most recent release is the one users read first — a leftover
		// placeholder ("…", "TODO", "TBD") means a release was cut early.
		const latest = RELEASES[0]!;
		const allText = [latest.summary, ...latest.changes.map((c) => c.text)].join(
			" ",
		);
		expect(allText).not.toMatch(/TODO|TBD|placeholder|lorem ipsum/i);
	});
});
