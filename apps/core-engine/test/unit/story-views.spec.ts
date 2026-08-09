import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { DatabaseService } from "../../src/db/database.service.js";
import { StoryViewsService } from "../../src/modules/story-views/story-views.service.js";

/**
 * Story-view history (v1.8.0) — Brief page History tab.
 *
 * Business rules:
 *   • opening the insight records scope='insight'; opening the article records
 *     'article';
 *   • opening the OTHER surface within the 10-minute merge window upgrades the
 *     same row to 'both' (one sitting), instead of stacking two rows;
 *   • the list joins the article title at read time (R-A09 — never duplicated).
 */
describe("story-views service", () => {
	function makeHarness(): {
		db: DatabaseService;
		views: StoryViewsService;
		close(): void;
	} {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-story-views-"));
		const db = new DatabaseService(join(dir, "vorynth.sqlite"));
		db.onModuleInit();
		seedArticle(db.rawDb);
		return { db, views: new StoryViewsService(db), close: () => db.close() };
	}

	it("merges insight + article opens in one sitting into 'both'", () => {
		const { views, close } = makeHarness();
		try {
			const first = views.record("art-1", "insight");
			const second = views.record("art-1", "article");
			expect(second.scope).toBe("both");
			expect(second.id).toBe(first.id); // upgraded in place, not a new row

			const list = views.list();
			expect(list).toHaveLength(1);
			expect(list[0]).toMatchObject({
				articleId: "art-1",
				articleTitle: "Story One",
				scope: "both",
			});
			expect(list[0].viewedAt).toBeDefined();
		} finally {
			close();
		}
	});

	it("repeated opens of the SAME surface stay on that scope (one row)", () => {
		const { views, close } = makeHarness();
		try {
			views.record("art-1", "insight");
			views.record("art-1", "insight");
			const list = views.list();
			expect(list).toHaveLength(1);
			expect(list[0].scope).toBe("insight");
		} finally {
			close();
		}
	});

	it("opens outside the merge window start a NEW row", () => {
		jest.useFakeTimers();
		try {
			const { views, close } = makeHarness();
			try {
				jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
				views.record("art-1", "insight");
				// 11 minutes later — past the 10-minute window.
				jest.setSystemTime(new Date("2026-01-01T00:11:00Z"));
				views.record("art-1", "article");

				const list = views.list();
				expect(list).toHaveLength(2);
				expect(list[0].scope).toBe("article"); // newest first
				expect(list[1].scope).toBe("insight");
			} finally {
				close();
			}
		} finally {
			jest.useRealTimers();
		}
	});

	it("reports whether an article exists (record guard)", () => {
		const { views, close } = makeHarness();
		try {
			expect(views.articleExists("art-1")).toBe(true);
			expect(views.articleExists("nope")).toBe(false);
		} finally {
			close();
		}
	});
});

function seedArticle(raw: Database.Database) {
	raw
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES ('src-sv', 'S', 'https://s.com', 'rss', 'other', 'rss')`,
		)
		.run();
	raw
		.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, hash)
			 VALUES ('art-1', 'src-sv', 'Story One', 'body', 'https://s.com/1', 'hash-1')`,
		)
		.run();
}
