import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import {
	buildSummaryPrompt,
	parseSummaryDraft,
} from "../../src/modules/intelligence/prompts/summary.prompt.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { NewsService } from "../../src/modules/news/news.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import type { BriefEntry, PeriodSummary } from "@vorynth/types";

/**
 * Bilingual period summary (v1.8.0):
 *
 * 1. `summarizePeriod` resolves the ORIGINAL version's language — the user's
 *    `intelligence.summaryOriginalLanguage` setting, or "auto" = the majority
 *    language of the stories in the summary.
 * 2. ONE summarize call also returns the briefing in that language
 *    (`original*` fields), so the summary carries both versions for display
 *    and export.
 */

function makeEntry(overrides: {
	articleId?: string;
	language?: string | null;
	title?: string;
	category?: string;
} = {}): BriefEntry {
	return {
		rank: 1,
		article: {
			id: overrides.articleId ?? randomUUID(),
			sourceId: "src-test",
			title: overrides.title ?? "A story",
			content: "Body text.",
			url: "https://example.com/story",
			author: null,
			publishedAt: new Date(),
			collectedAt: new Date(),
			hash: randomUUID(),
			contentItemId: null,
			language: overrides.language ?? "en",
		},
		category: overrides.category ?? "ai",
		sourceNames: ["Test Blog"],
		score: 7,
		importanceTier: "signal",
		ranking: {
			sourceReliability: 1,
			freshnessScore: 1,
			lengthSignal: 1,
		},
		insight: null,
	};
}

function makeService(tdb: TestDb) {
	const llm = {
		isAvailable: jest.fn(async () => true),
		summarize: jest.fn(async () =>
			JSON.stringify({
				headline: "Headline in fa",
				themes: [{ name: "theme", rationale: "rationale [1]" }],
				takeaways: ["Takeaway one [1]"],
				recommendedActions: ["Do the thing [1]"],
				importanceScore: 8,
				category: "ai",
				originalHeadline: "Headline in en",
				originalThemes: [{ name: "theme", rationale: "rationale [1]" }],
				originalTakeaways: ["Takeaway one [1]"],
				originalRecommendedActions: ["Do the thing [1]"],
			}),
		),
		generate: jest.fn(),
		analyze: jest.fn(),
		summarizeSummary: jest.fn(),
	} as unknown as LlmService;
	const news = {
		buildBrief: jest.fn(async () => ({ entries: [makeEntry()] })),
	} as unknown as NewsService;
	const history = {
		getSetting: jest.fn(() => "auto"),
		recordBrief: jest.fn(),
	} as unknown as HistoryService;
	const svc = new IntelligenceService(
		tdb.service,
		llm,
		news,
		history,
		{} as unknown as CrawlerService,
	);
	return {
		svc,
		llm: llm as unknown as { summarize: jest.Mock },
		news: news as unknown as { buildBrief: jest.Mock },
		history: history as unknown as {
			getSetting: jest.Mock;
			recordBrief: jest.Mock;
		},
	};
}

describe("summarizePeriod — bilingual (v1.8.0)", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
	});

	afterEach(() => {
		tdb.close();
	});

	it("uses the majority language of the stories as the ORIGINAL version", async () => {
		const { svc, news, llm } = makeService(tdb);
		news.buildBrief.mockResolvedValue({
			entries: [
				makeEntry({ language: "en" }),
				makeEntry({ language: "en" }),
				makeEntry({ language: "en" }),
				makeEntry({ language: "fa" }),
				makeEntry({ language: "fa" }),
			],
		});

		const summary = await svc.summarizePeriod({
			targetLanguage: "fa",
			period: "week",
		});

		// The majority of the stories are English → the original version is en.
		expect(summary?.originalLanguage).toBe("en");
		expect(summary?.originalHeadline).toBe("Headline in en");
		// The translated version is the user's language.
		expect(summary?.headline).toBe("Headline in fa");
		// One summarize call carried the original language for the bilingual pass.
		expect(llm.summarize).toHaveBeenCalledTimes(1);
	});

	it("honors the user's explicit original-language setting", async () => {
		const { svc, history, news } = makeService(tdb);
		history.getSetting.mockReturnValue("de");
		// All stories are English — but the user pinned German.
		news.buildBrief.mockResolvedValue({
			entries: [makeEntry({ language: "en" })],
		});

		const summary = await svc.summarizePeriod({ targetLanguage: "fa" });

		expect(summary?.originalLanguage).toBe("de");
	});

	it("is single-language when the majority language equals the user's language", async () => {
		const { svc, news } = makeService(tdb);
		news.buildBrief.mockResolvedValue({
			entries: [makeEntry({ language: "en" })],
		});

		const summary = await svc.summarizePeriod({ targetLanguage: "en" });

		expect(summary?.originalLanguage).toBeUndefined();
		expect(summary?.originalHeadline).toBeUndefined();
	});

	it("persists the bilingual summary to history", async () => {
		const { svc, history } = makeService(tdb);

		await svc.summarizePeriod({ targetLanguage: "fa" });

		expect(history.recordBrief).toHaveBeenCalledWith(
			expect.objectContaining({
				result: expect.objectContaining({
					originalLanguage: "en",
					originalHeadline: "Headline in en",
				}) as PeriodSummary,
			}),
		);
	});
});

describe("summary prompt + parser — bilingual", () => {
	it("asks for the original-language version when languages differ", () => {
		const { system, user } = buildSummaryPrompt({
			period: "week",
			targetLanguage: "fa",
			originalLanguage: "en",
			stories: [{ title: "T", category: "ai", source: "S", when: "today" }],
		});
		expect(system).toContain("majority language");
		expect(user).toContain('"originalHeadline"');
		expect(user).toContain('"originalRecommendedActions"');
	});

	it("stays monolingual when the languages match", () => {
		const { user } = buildSummaryPrompt({
			period: "week",
			targetLanguage: "en",
			originalLanguage: "en",
			stories: [{ title: "T", category: "ai", source: "S", when: "today" }],
		});
		expect(user).not.toContain('"originalHeadline"');
	});

	it("parses the original* fields", () => {
		const draft = parseSummaryDraft(
			JSON.stringify({
				headline: "H",
				themes: [{ name: "t", rationale: "r" }],
				takeaways: ["a"],
				recommendedActions: ["b"],
				importanceScore: 5,
				category: "ai",
				originalHeadline: "OH",
				originalThemes: [{ name: "ot", rationale: "or" }],
				originalTakeaways: ["oa"],
				originalRecommendedActions: ["ob"],
			}),
		);
		expect(draft.originalHeadline).toBe("OH");
		expect(draft.originalTakeaways).toEqual(["oa"]);
		expect(draft.originalThemes).toEqual([{ name: "ot", rationale: "or" }]);
	});
});
