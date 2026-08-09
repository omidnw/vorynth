import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import { ftsInsertArticle } from "../../src/db/fts-sync.js";
import type { PluginsService } from "../../src/modules/plugins/plugins.service.js";
import type { SourceListsService } from "../../src/modules/sources/source-lists.service.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { NewsService } from "../../src/modules/news/news.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { GenerateInput } from "../../src/modules/llm/llm-provider.js";

/**
 * Per-story Re-collect + corrupted-content repair + incomplete-translation
 * repair (v1.8.0). Offline: mocked fetch + deterministic LLM mock.
 */

const ARTICLE_HTML = (
	body: string,
) => `<!doctype html><html><head><title>T</title></head><body>
  <article><h1>T</h1><p>${body}</p><p>More body text.</p></article>
</body></html>`;

function longBody(seed: string, count = 8): string {
	return Array.from({ length: count }, () => seed).join(" ");
}

function mockFetch(routes: Record<string, string>): void {
	globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const hit = routes[url];
		if (hit === undefined) return new Response("not found", { status: 404 });
		return new Response(hit, {
			status: 200,
			headers: { "content-type": "text/html" },
		});
	}) as unknown as typeof fetch;
}

function seedSource(tdb: TestDb): void {
	tdb.service.rawDb
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES ('src-recollect', 'Recollect Source', 'https://example.com', 'rss', 'other', 'rss')`,
		)
		.run();
}

function seedArticle(
	tdb: TestDb,
	id: string,
	content: string,
	translatedContent: string | null,
): void {
	const raw = tdb.service.rawDb;
	raw
		.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, author, published_at, collected_at, hash, translated_content)
			 VALUES (?, 'src-recollect', ?, ?, 'https://example.com/story/' || ?, NULL, ?, ?, ?, ?)`,
		)
		.run(
			id,
			`Title ${id}`,
			content,
			id,
			Date.now() - 1000,
			Date.now(),
			randomUUID(),
			translatedContent,
		);
	ftsInsertArticle(raw, id, `Title ${id}`, content);
}

function makeCrawler(tdb: TestDb): CrawlerService {
	return new CrawlerService(
		tdb.service,
		{} as PluginsService,
		{} as SourceListsService,
	);
}

function makeIntelligence(tdb: TestDb): {
	svc: IntelligenceService;
	llm: {
		isAvailable: jest.Mock;
		analyze: jest.Mock;
		generate: jest.Mock;
	};
	news: { getArticleDetail: jest.Mock };
} {
	const llm = {
		isAvailable: jest.fn(async () => true),
		analyze: jest.fn(async () => ({
			summary: "Test summary",
			significance: "Sig",
			impact: "Imp",
			recommendedAction: "RA",
			importanceScore: 7,
			category: "ai",
		})),
		generate: jest.fn(async (input: GenerateInput) => {
			const items = JSON.parse(input.user as string) as Array<{
				id: string;
				title: string;
				content: string;
			}>;
			return JSON.stringify(
				items.map((i) => ({
					id: i.id,
					title: `T:${i.id}`,
					content: `B:${i.id}`,
				})),
			);
		}),
		summarize: jest.fn(),
	} as unknown as LlmService;
	const news = {
		getArticleDetail: jest.fn(async () => ({
			article: { id: "art-1" },
			sourceName: "Recollect Source",
			sourceCategory: "other",
		})),
	} as unknown as NewsService;
	const svc = new IntelligenceService(
		tdb.service,
		llm,
		news,
		undefined as unknown as HistoryService,
		makeCrawler(tdb),
	);
	return {
		svc,
		llm: llm as unknown as {
			isAvailable: jest.Mock;
			analyze: jest.Mock;
			generate: jest.Mock;
		},
		news: news as unknown as { getArticleDetail: jest.Mock },
	};
}

describe("CrawlerService.recollectArticleContent", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("re-fetches the origin and upgrades a short body, reporting the stale translation", async () => {
		seedArticle(tdb, "art-1", "Short snippet.", "Old translation");
		mockFetch({
			"https://example.com/story/art-1": ARTICLE_HTML(
				longBody("The full re-collected article body."),
			),
		});

		const res = await makeCrawler(tdb).recollectArticleContent("art-1");

		expect(res.changed).toBe(true);
		expect(res.hadTranslation).toBe(true);
		expect(res.content).toContain("The full re-collected article body.");
		const row = tdb.service.rawDb
			.prepare("SELECT content FROM articles WHERE id = 'art-1'")
			.get() as { content: string };
		expect(row.content).toContain("The full re-collected article body.");
	});

	it("keeps the stored body when the origin can't be read (never a downgrade)", async () => {
		seedArticle(tdb, "art-1", "Short snippet.", null);
		mockFetch({}); // all fetches 404

		const res = await makeCrawler(tdb).recollectArticleContent("art-1");

		expect(res.changed).toBe(false);
		const row = tdb.service.rawDb
			.prepare("SELECT content FROM articles WHERE id = 'art-1'")
			.get() as { content: string };
		expect(row.content).toBe("Short snippet.");
	});
});

describe("CrawlerService.backfillCorruptedContent", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("re-extracts a damaged body (inline JSON junk) into clean prose", async () => {
		seedArticle(
			tdb,
			"art-1",
			`Intro { "play_video": "Play video", "pause_video": "Pause video" } [[read-time]] junk`,
			null,
		);
		mockFetch({
			"https://example.com/story/art-1": ARTICLE_HTML(
				longBody("The clean article body."),
			),
		});

		const res = await makeCrawler(tdb).backfillCorruptedContent();

		expect(res.repaired).toBe(1);
		const row = tdb.service.rawDb
			.prepare("SELECT content FROM articles WHERE id = 'art-1'")
			.get() as { content: string };
		expect(row.content).toContain("The clean article body.");
		expect(row.content).not.toContain("play_video");
		expect(row.content).not.toContain("[[");
	});

	it("does not touch clean bodies", async () => {
		const clean = longBody("Perfectly clean body text.");
		seedArticle(tdb, "art-1", clean, null);
		mockFetch({});

		const res = await makeCrawler(tdb).backfillCorruptedContent();

		expect(res.repaired).toBe(0);
		const row = tdb.service.rawDb
			.prepare("SELECT content FROM articles WHERE id = 'art-1'")
			.get() as { content: string };
		expect(row.content).toBe(clean);
	});
});

describe("IntelligenceService.repairIncompleteTranslations", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("re-translates a truncated translation when an LLM is available", async () => {
		seedArticle(tdb, "art-1", "A".repeat(500), "ناقص");
		const { svc, llm } = makeIntelligence(tdb);

		const res = await svc.repairIncompleteTranslations();

		expect(res.retranslated).toBe(1);
		expect(llm.generate).toHaveBeenCalled();
		const row = tdb.service.rawDb
			.prepare("SELECT translated_content FROM articles WHERE id = 'art-1'")
			.get() as { translated_content: string | null };
		expect(row.translated_content).toBe("B:art-1");
	});

	it("clears the bad translation in news mode so the Translate pill returns", async () => {
		seedArticle(tdb, "art-1", "A".repeat(500), "ناقص");
		const { svc, llm } = makeIntelligence(tdb);
		llm.isAvailable.mockResolvedValue(false);

		const res = await svc.repairIncompleteTranslations();

		expect(res.cleared).toBe(1);
		const row = tdb.service.rawDb
			.prepare("SELECT translated_content FROM articles WHERE id = 'art-1'")
			.get() as { translated_content: string | null };
		expect(row.translated_content).toBeNull();
	});
});

describe("IntelligenceService.recollectStory (full pipeline)", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("re-collects content, repairs the stale translation, and fills the missing insight", async () => {
		seedArticle(tdb, "art-1", "Short snippet.", "Old translation");
		mockFetch({
			"https://example.com/story/art-1": ARTICLE_HTML(
				longBody("The re-collected full body."),
			),
		});
		const { svc, llm, news } = makeIntelligence(tdb);

		const detail = await svc.recollectStory("art-1");

		// Content upgraded from the snippet to the full body.
		const row = tdb.service.rawDb
			.prepare(
				"SELECT content, translated_content, original_title FROM articles WHERE id = 'art-1'",
			)
			.get() as {
			content: string;
			translated_content: string | null;
			original_title: string | null;
		};
		expect(row.content).toContain("The re-collected full body.");

		// The stale snippet-translation was re-translated against the new body
		// and the title translation was completed (generate → translate).
		expect(row.translated_content).toBe("B:art-1");
		expect(row.original_title).toBe("Title art-1");

		// The missing insight was generated.
		expect(llm.analyze).toHaveBeenCalled();
		const { c } = tdb.service.rawDb
			.prepare("SELECT COUNT(*) c FROM ai_insights WHERE article_id = 'art-1'")
			.get() as { c: number };
		expect(c).toBe(1);

		// Returns the refreshed detail.
		expect(news.getArticleDetail).toHaveBeenCalledWith("art-1");
		expect(detail).not.toBeNull();
	});

	it("fills a missing insight even when the body did not change", async () => {
		const full = longBody("Already full body text.");
		seedArticle(tdb, "art-1", full, null);
		mockFetch({
			"https://example.com/story/art-1": ARTICLE_HTML(full),
		});
		const { svc, llm } = makeIntelligence(tdb);

		await svc.recollectStory("art-1");

		expect(llm.analyze).toHaveBeenCalled();
		const { c } = tdb.service.rawDb
			.prepare("SELECT COUNT(*) c FROM ai_insights WHERE article_id = 'art-1'")
			.get() as { c: number };
		expect(c).toBe(1);
	});

	it("returns null for a missing article", async () => {
		const { svc } = makeIntelligence(tdb);
		await expect(svc.recollectStory("nope")).rejects.toThrow(/not found/);
	});
});

describe("IntelligenceService.generateInsight — bilingual (v1.8.0)", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => {
		tdb.close();
	});

	it("requests the source-language version and persists both languages", async () => {
		seedArticle(tdb, "art-1", "Full body text for analysis.", null);
		// User writes in Persian, the story's source is English → bilingual.
		tdb.service.rawDb
			.prepare(
				"UPDATE user_profile SET preferred_intelligence_language = 'fa' WHERE id = 'default'",
			)
			.run();
		tdb.service.rawDb
			.prepare("UPDATE sources SET language = 'en' WHERE id = 'src-recollect'")
			.run();

		const { svc, llm } = makeIntelligence(tdb);
		llm.analyze.mockResolvedValueOnce({
			summary: "خلاصه فارسی",
			significance: "اهمیت",
			impact: "تأثیر",
			recommendedAction: "اقدام پیشنهادی",
			importanceScore: 7,
			category: "ai",
			originalSummary: "English summary",
			originalSignificance: "English significance",
			originalImpact: "English impact",
			originalRecommendedAction: "English action",
		});

		const insight = await svc.generateInsight("art-1");

		// The ONE analyze call carried the story's source language.
		expect(llm.analyze).toHaveBeenCalledWith(
			expect.objectContaining({ sourceLanguage: "en" }),
		);
		// Both versions persisted — the DTO exposes the source-language one.
		expect(insight.summary).toBe("خلاصه فارسی");
		expect(insight.originalSummary).toBe("English summary");
		expect(insight.originalRecommendedAction).toBe("English action");
		const row = tdb.service.rawDb
			.prepare(
				"SELECT original_summary, original_recommended_action FROM ai_insights WHERE article_id = 'art-1'",
			)
			.get() as { original_summary: string; original_recommended_action: string };
		expect(row.original_summary).toBe("English summary");
		expect(row.original_recommended_action).toBe("English action");
	});
});
