import { createTestDb } from "./helpers/db.js";

/**
 * Harness smoke test — proves the Phase 0 test foundation works end-to-end:
 * temp SQLite creation, migrations, FTS5 setup, and seeding. If this fails,
 * nothing else in the suite can be trusted (native module, DDL, or env issue).
 */
describe("test harness", () => {
	it("creates a temp DB with migrations and seed data applied", () => {
		const { service, close } = createTestDb();
		try {
			const raw = service.rawDb;

			// Migrations ran — core tables exist.
			const tables = raw
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
				)
				.all() as Array<{ name: string }>;
			const names = tables.map((t) => t.name);
			for (const expected of [
				"sources",
				"articles",
				"ai_insights",
				"search_history",
				"brief_history",
				"generated_history",
				"app_settings",
			]) {
				expect(names).toContain(expected);
			}

			// FTS5 virtual table exists.
			expect(names).toContain("articles_fts");

			// Seed defaults applied.
			const sources = raw
				.prepare("SELECT COUNT(*) AS c FROM sources")
				.get() as { c: number };
			expect(sources.c).toBeGreaterThan(0);

			const settings = raw
				.prepare("SELECT COUNT(*) AS c FROM app_settings")
				.get() as { c: number };
			expect(settings.c).toBeGreaterThan(0);
		} finally {
			close();
		}
	});

	it("uses a fresh database per call (no shared state)", () => {
		const a = createTestDb();
		const b = createTestDb();
		try {
			const fileA = a.service.filePath;
			const fileB = b.service.filePath;
			expect(fileA).not.toBe(fileB);
			expect(a.service.rawDb.pragma("journal_mode", { simple: true })).toBe(
				"wal",
			);
		} finally {
			a.close();
			b.close();
		}
	});
});
