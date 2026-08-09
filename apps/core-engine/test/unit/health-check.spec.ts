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
 * Data health check (v1.8.0) — full-text backfill, stale-translation repair,
 * and missing-insight backfill. Offline: mocked fetch + a deterministic LLM
 * mock (testing-backend: no network).
 */

const ARTICLE_HTML = (
	body: string,
) => `<!doctype html><html><head><title>T</title></head><body>
  <article><h1>T</h1><p>${body}</p><p>More body text.</p></article>
</body></html>`;

/** A body long enough to clear the extraction quality floor (100 chars). */
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
			 VALUES ('src-health', 'Health Source', 'https://example.com', 'rss', 'other', 'rss')`,
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
			 VALUES (?, 'src-health', ?, ?, ?, NULL, ?, ?, ?, ?)`,
		)
		.run(
			id,
			`Title ${id}`,
			content,
			`https://example.com/story/${id}`,
			Date.now() - 1000,
			Date.now(),
			randomUUID(),
			translatedContent,
		);
	ftsInsertArticle(raw, id, `Title ${id}`, content);
}

function row(
	tdb: TestDb,
	id: string,
): { content: string; translated_content: string | null } {
	return tdb.service.rawDb
		.prepare("SELECT content, translated_content FROM articles WHERE id = ?")
		.get(id) as { content: string; translated_content: string | null };
}

function makeCrawler(tdb: TestDb): CrawlerService {
	return new CrawlerService(
		tdb.service,
		{} as PluginsService,
		{} as SourceListsService,
	);
}

function makeIntelligence(
	tdb: TestDb,
	llmOverrides: Partial<LlmService> = {},
): {
	svc: IntelligenceService;
	llm: { isAvailable: jest.Mock; analyze: jest.Mock; generate: jest.Mock };
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
		...llmOverrides,
	} as unknown as LlmService;
	const svc = new IntelligenceService(
		tdb.service,
		llm,
		{
			// generateInsight now finishes by translating the story, which ends
			// with a getArticleDetail lookup — stub it so the insight tests stay
			// focused on the insight write.
			getArticleDetail: jest.fn(async () => null),
		} as unknown as NewsService,
		undefined as unknown as HistoryService,
		{} as unknown as CrawlerService,
	);
	return {
		svc,
		llm: llm as unknown as {
			isAvailable: jest.Mock;
			analyze: jest.Mock;
			generate: jest.Mock;
		},
	};
}

describe("CrawlerService.backfillFullText", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("upgrades short/empty articles to the full extracted text + FTS", async () => {
		seedArticle(tdb, "art-short", "Short snippet.", null);
		seedArticle(tdb, "art-empty", "", null);
		mockFetch({
			"https://example.com/story/art-short": ARTICLE_HTML(
				longBody("Full body one"),
			),
			"https://example.com/story/art-empty": ARTICLE_HTML(
				longBody("Full body two"),
			),
		});

		const res = await makeCrawler(tdb).backfillFullText();

		expect(res.upgraded).toBe(2);
		expect(row(tdb, "art-short").content).toContain("Full body one");
		expect(row(tdb, "art-empty").content).toContain("Full body two");
		// FTS follows the rewritten body so search matches the full text.
		const fts = tdb.service.rawDb
			.prepare("SELECT content FROM articles_fts WHERE article_id = ?")
			.get("art-short") as { content: string };
		expect(fts.content).toContain("Full body one");
	});

	it("reports stale translation ids and never downgrades full articles", async () => {
		seedArticle(tdb, "art-short", "Short snippet.", "old snippet translation");
		seedArticle(tdb, "art-full", "x".repeat(900), null);
		mockFetch({
			"https://example.com/story/art-short": ARTICLE_HTML(
				longBody("Full body text"),
			),
		});

		const res = await makeCrawler(tdb).backfillFullText();

		expect(res.upgraded).toBe(1);
		expect(res.staleTranslationIds).toEqual(["art-short"]);
		expect(row(tdb, "art-full").content).toBe("x".repeat(900));
	});

	it("keeps the snippet when the page can't be fetched", async () => {
		seedArticle(tdb, "art-short", "Short snippet.", null);
		mockFetch({});

		const res = await makeCrawler(tdb).backfillFullText();

		expect(res.upgraded).toBe(0);
		expect(row(tdb, "art-short").content).toBe("Short snippet.");
	});
});

describe("IntelligenceService.repairStaleTranslations", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("re-translates stale body translations when Intelligence mode is on", async () => {
		seedArticle(
			tdb,
			"art-1",
			longBody("Full origin body text"),
			"old snippet translation",
		);
		const { svc, llm } = makeIntelligence(tdb);

		const res = await svc.repairStaleTranslations(["art-1"]);

		expect(llm.generate).toHaveBeenCalledTimes(1);
		expect(res).toEqual({ retranslated: 1, cleared: 0 });
		expect(row(tdb, "art-1").translated_content).toBe("B:art-1");
	});

	it("clears stale body translations in news mode (no LLM)", async () => {
		seedArticle(
			tdb,
			"art-1",
			longBody("Full origin body text"),
			"old snippet translation",
		);
		const { svc, llm } = makeIntelligence(tdb, {
			isAvailable: jest.fn(async () => false),
		});

		const res = await svc.repairStaleTranslations(["art-1"]);

		expect(llm.generate).not.toHaveBeenCalled();
		expect(res).toEqual({ retranslated: 0, cleared: 1 });
		expect(row(tdb, "art-1").translated_content).toBeNull();
	});

	it("no-ops for an empty id list", async () => {
		const { svc, llm } = makeIntelligence(tdb);
		await expect(svc.repairStaleTranslations([])).resolves.toEqual({
			retranslated: 0,
			cleared: 0,
		});
		expect(llm.generate).not.toHaveBeenCalled();
	});
});

describe("IntelligenceService.backfillMissingInsights", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("generates insights for content-bearing articles without one", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		seedArticle(tdb, "art-2", "Full content here for article two.", null);
		const { svc, llm } = makeIntelligence(tdb);

		const n = await svc.backfillMissingInsights();

		expect(n).toBe(2);
		expect(llm.analyze).toHaveBeenCalledTimes(2);
		const { c } = tdb.service.rawDb
			.prepare(
				"SELECT COUNT(*) c FROM ai_insights WHERE article_id IN ('art-1','art-2')",
			)
			.get() as { c: number };
		expect(c).toBe(2);
	});

	it("skips articles that already have an insight", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		seedArticle(tdb, "art-2", "Full content here for article two.", null);
		tdb.service.rawDb
			.prepare(
				`INSERT INTO ai_insights (id, cluster_id, article_id, summary, significance, impact, importance_score, importance_tier, category, recommended_action, generated_language)
				 VALUES (?, NULL, ?, 'S', 'Sig', 'Imp', 7, 'signal', 'ai', 'RA', 'en')`,
			)
			.run(randomUUID(), "art-1");
		const { svc } = makeIntelligence(tdb);

		const n = await svc.backfillMissingInsights();

		expect(n).toBe(1); // only art-2 is missing an insight
	});

	it("no-ops in news mode — never spends tokens", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		const { svc, llm } = makeIntelligence(tdb, {
			isAvailable: jest.fn(async () => false),
		});

		const n = await svc.backfillMissingInsights();

		expect(n).toBe(0);
		expect(llm.analyze).not.toHaveBeenCalled();
		const { c } = tdb.service.rawDb
			.prepare("SELECT COUNT(*) c FROM ai_insights")
			.get() as { c: number };
		expect(c).toBe(0);
	});
});

describe("IntelligenceService.generateInsight (per-story)", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => tdb.close());

	it("generates and persists an insight for one content-bearing article", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		const { svc, llm } = makeIntelligence(tdb);

		const insight = await svc.generateInsight("art-1");

		expect(llm.analyze).toHaveBeenCalledTimes(1);
		expect(insight.articleId).toBe("art-1");
		expect(insight.significance).toBe("Sig");
		const { c } = tdb.service.rawDb
			.prepare("SELECT COUNT(*) c FROM ai_insights WHERE article_id = 'art-1'")
			.get() as { c: number };
		expect(c).toBe(1);
	});

	it("also translates the story so the brief's Translate pill can disappear", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		const { svc, llm } = makeIntelligence(tdb);

		await svc.generateInsight("art-1");

		// Generate = insight + translation (v1.8.0): the story now carries a
		// translated title and body, which the UI detects and hides the pill.
		expect(llm.generate).toHaveBeenCalled();
		const row = tdb.service.rawDb
			.prepare(
				"SELECT original_title, translated_content FROM articles WHERE id = 'art-1'",
			)
			.get() as {
			original_title: string | null;
			translated_content: string | null;
		};
		expect(row.original_title).toBe("Title art-1");
		expect(row.translated_content).toBe("B:art-1");
	});

	it("is idempotent — returns the existing insight without re-analyzing", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		tdb.service.rawDb
			.prepare(
				`INSERT INTO ai_insights (id, cluster_id, article_id, summary, significance, impact, importance_score, importance_tier, category, recommended_action, generated_language)
				 VALUES (?, NULL, 'art-1', 'S', 'Existing sig', 'Imp', 7, 'signal', 'ai', 'RA', 'en')`,
			)
			.run(randomUUID());
		const { svc, llm } = makeIntelligence(tdb);

		const insight = await svc.generateInsight("art-1");

		expect(llm.analyze).not.toHaveBeenCalled();
		expect(insight.significance).toBe("Existing sig");
	});

	it("refuses in news mode with a clear reason (INSIGHT_LLM_UNAVAILABLE)", async () => {
		seedArticle(tdb, "art-1", "Full content here for article one.", null);
		const { svc, llm } = makeIntelligence(tdb, {
			isAvailable: jest.fn(async () => false),
		});

		await expect(svc.generateInsight("art-1")).rejects.toThrow(
			/needs Intelligence mode/,
		);
		expect(llm.analyze).not.toHaveBeenCalled();
	});

	it("refuses an empty-body story with a clear reason (INSIGHT_NO_CONTENT)", async () => {
		seedArticle(tdb, "art-1", "", null);
		const { svc, llm } = makeIntelligence(tdb);

		await expect(svc.generateInsight("art-1")).rejects.toThrow(/no body text/);
		expect(llm.analyze).not.toHaveBeenCalled();
	});

	it("throws 404 for a missing article", async () => {
		const { svc } = makeIntelligence(tdb);
		await expect(svc.generateInsight("nope")).rejects.toThrow(/not found/);
	});
});
