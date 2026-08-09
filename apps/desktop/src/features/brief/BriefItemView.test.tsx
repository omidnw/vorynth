import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { BriefEntry } from "@vorynth/types";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { BriefItemView } from "@/features/brief/BriefItemView.js";

// API layers mocked; the adapter + shared component are real.
const mocks = vi.hoisted(() => ({
	generateArticleInsight: vi.fn(),
	startTranslateOneJob: vi.fn(),
	startRecollectOneJob: vi.fn(),
	fetchBookmarks: vi.fn(),
	fetchProfile: vi.fn(),
	fetchJobs: vi.fn(),
	cancelJob: vi.fn(),
	startCollectJob: vi.fn(),
	startGenerateJob: vi.fn(),
	startSummarizeJob: vi.fn(),
	startAskJob: vi.fn(),
	startHealthCheckJob: vi.fn(),
	startRegenerateInsightsJob: vi.fn(),
	startTranslateStoriesJob: vi.fn(),
}));

vi.mock("@/features/reader/reader-api.js", () => ({
	generateArticleInsight: mocks.generateArticleInsight,
}));

vi.mock("@/features/jobs/jobs-api.js", () => ({
	startTranslateOneJob: mocks.startTranslateOneJob,
	startRecollectOneJob: mocks.startRecollectOneJob,
	fetchJobs: mocks.fetchJobs,
	cancelJob: mocks.cancelJob,
	startCollectJob: mocks.startCollectJob,
	startGenerateJob: mocks.startGenerateJob,
	startSummarizeJob: mocks.startSummarizeJob,
	startAskJob: mocks.startAskJob,
	startHealthCheckJob: mocks.startHealthCheckJob,
	startRegenerateInsightsJob: mocks.startRegenerateInsightsJob,
	startTranslateStoriesJob: mocks.startTranslateStoriesJob,
	isActive: () => false,
}));

vi.mock("@/features/profile/profile-api.js", () => ({
	fetchProfile: mocks.fetchProfile,
}));

vi.mock("@/features/archive/archive-api.js", () => ({
	fetchBookmarks: mocks.fetchBookmarks,
	createBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

function makeEntry(overrides: Partial<BriefEntry["article"]>): BriefEntry {
	return {
		rank: 1,
		article: {
			id: "art-1",
			sourceId: "src-1",
			title: "An Untranslated Story",
			content: "The body text of the story.",
			url: "https://example.com/story-1",
			author: "Jane Author",
			publishedAt: new Date("2026-08-01T00:00:00Z"),
			collectedAt: new Date("2026-08-01T00:00:00Z"),
			hash: "h1",
			contentItemId: null, // no spine → bookmark query stays disabled
			...overrides,
		},
		category: "ai",
		sourceNames: ["Example Blog"],
		score: 8,
		importanceTier: "signal",
		ranking: {
			sourceReliability: 1,
			freshnessScore: 1,
			lengthSignal: 1,
		},
		insight: null,
	};
}

function renderItem(entry: BriefEntry, intelligenceEnabled?: boolean) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/brief"]}>
				<Routes>
					<Route
						path="/brief"
						element={
							<BriefItemView
								entry={entry}
								intelligenceEnabled={intelligenceEnabled}
							/>
						}
					/>
					{/* Any other route (e.g. /articles/:id from card navigation). */}
					<Route path="*" element={<p>Navigated away</p>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("BriefItemView — per-story translate (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.generateArticleInsight.mockResolvedValue({ id: "insight-1" });
		mocks.startTranslateOneJob.mockResolvedValue({
			id: "job-tr-1",
			kind: "translate-one",
		});
		mocks.startRecollectOneJob.mockResolvedValue({
			id: "job-rc-1",
			kind: "recollect-one",
		});
		mocks.fetchJobs.mockResolvedValue({ active: [], recent: [] });
		mocks.fetchBookmarks.mockResolvedValue({ items: [], total: 0 });
		mocks.fetchProfile.mockResolvedValue({
			preferredIntelligenceLanguage: "en",
		} as never);
	});

	/** Open the card's More menu — footer actions live behind it (v1.8.0). */
	async function openMore() {
		const user = userEvent.setup();
		await user.click(
			screen.getByRole("button", { name: "More story actions" }),
		);
		return user;
	}

	it("shows a Translate action in the More menu on a story that has content but no translation", async () => {
		renderItem(makeEntry({}));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /translate/i }),
		).toBeInTheDocument();
	});

	it("sits in the More menu next to Re-collect", async () => {
		renderItem(makeEntry({}));
		await openMore();
		const translateBtn = screen.getByRole("menuitem", { name: /translate/i });
		const recollectBtn = screen.getByRole("menuitem", { name: /re-collect/i });
		// Both live as siblings inside the card's More menu (v1.8.0) — the
		// footer itself stays Read source · Save · More · source label.
		expect(translateBtn.parentElement).toBe(recollectBtn.parentElement);
	});

	it("hides Translate when the story's source language equals the user's language", async () => {
		// English story + English intelligence language → the engine would skip
		// the translation, so the action must not be offered. The profile query
		// resolves asynchronously, so wait for the card to settle.
		renderItem(makeEntry({ language: "en" }));
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /translate/i }),
			).not.toBeInTheDocument();
		});
		await openMore();
		expect(
			screen.queryByRole("menuitem", { name: /translate/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("menuitem", { name: /re-translate/i }),
		).not.toBeInTheDocument();
	});

	it("keeps Translate when the story language differs from the user's language", async () => {
		mocks.fetchProfile.mockResolvedValue({
			preferredIntelligenceLanguage: "fa",
		} as never);
		renderItem(makeEntry({ language: "en" }));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /translate/i }),
		).toBeInTheDocument();
	});

	it("keeps Translate when the story's language is unknown (null)", async () => {
		renderItem(makeEntry({ language: null }));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /translate/i }),
		).toBeInTheDocument();
	});

	it("shows the original text (not a stale translation) when the story's language matches the user's", async () => {
		// A story translated to Persian while the user had Persian set; they
		// switched to English — the card must show the original, not the stale
		// Persian translation.
		mocks.fetchProfile.mockResolvedValue({
			preferredIntelligenceLanguage: "en",
		} as never);
		renderItem(
			makeEntry({
				language: "en",
				translatedContent: "متن ترجمه شده به فارسی",
				originalTitle: "An Untranslated Story",
			}),
		);
		await waitFor(() => {
			expect(screen.queryByText(/متن ترجمه شده/)).not.toBeInTheDocument();
		});
		expect(screen.getByText(/The body text of the story/)).toBeInTheDocument();
	});

	it("shows a Translate action on a story that has a title but no body text", async () => {
		// A feed item with a title but an empty description is still not fully
		// translated — the action stays and clicking translates the title.
		renderItem(makeEntry({ content: "" }));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /translate/i }),
		).toBeInTheDocument();
	});

	it("replaces Translate with Re-translate once the story has a translation", async () => {
		// A translated story is fully done, so the plain Translate action goes
		// away — but Re-translate (v1.8.0) takes its place: the user can force a
		// fresh AI pass any time, e.g. after changing their language.
		renderItem(
			makeEntry({
				translatedContent: "داستانی که ترجمه شده",
				originalTitle: "Old",
			}),
		);
		await openMore();
		expect(
			screen.queryByRole("menuitem", { name: "Translate" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: /re-translate/i }),
		).toBeInTheDocument();
	});

	it("keeps the Translate action when only the title was translated", async () => {
		// Legacy title-only translation — the body still needs translating, so
		// the action stays until BOTH title and body carry a translation.
		renderItem(makeEntry({ originalTitle: "An Older Title" }));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /translate/i }),
		).toBeInTheDocument();
	});

	it("mirrors the title row for RTL titles so the pills trail on the left", () => {
		renderItem(
			makeEntry({
				title: "خبر فارسی",
				originalTitle: "Persian Story",
				translatedContent: "متن کامل خبر",
			}),
		);
		// The row (the h3's parent) carries dir="rtl" — the title leads from the
		// right and the Original/Translate pills follow on the left.
		const title = screen.getByText("خبر فارسی");
		expect(title.closest("div")).toHaveAttribute("dir", "rtl");
	});

	it("keeps the title row LTR for LTR titles", () => {
		renderItem(makeEntry({}));
		const title = screen.getByText("An Untranslated Story");
		expect(title.closest("div")).toHaveAttribute("dir", "ltr");
	});

	it("mirrors the body row for an RTL snippet so the toggle trails left", () => {
		renderItem(
			makeEntry({
				title: "English Title",
				originalTitle: "Old",
				translatedContent: "متن کامل خبر به فارسی که از راست خوانده میشود",
			}),
		);
		const snippet = screen.getByText(/متن کامل خبر/);
		expect(snippet.closest("div")).toHaveAttribute("dir", "rtl");
	});

	it("starts a translate job for that story on click", async () => {
		renderItem(makeEntry({}));
		const user = await openMore();
		await user.click(screen.getByRole("menuitem", { name: /translate/i }));
		expect(mocks.startTranslateOneJob).toHaveBeenCalledTimes(1);
		expect(mocks.startTranslateOneJob).toHaveBeenCalledWith({
			articleId: "art-1",
			force: false,
		});
	});

	it("does not navigate away when the Translate action is clicked", async () => {
		renderItem(makeEntry({}));
		const user = await openMore();
		await user.click(screen.getByRole("menuitem", { name: /translate/i }));
		// The card itself is a link (role=link) — the action must
		// stopPropagation, otherwise the click would bubble into card
		// navigation (→ /articles/:id).
		expect(mocks.startTranslateOneJob).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Navigated away")).not.toBeInTheDocument();
		expect(screen.getByText("An Untranslated Story")).toBeInTheDocument();
	});

	// ── Transparency: why a story has no AI insight (v1.8.0) ────────────────

	it("explains News mode when a story has no insight and no LLM is on", () => {
		renderItem(makeEntry({}), false);
		expect(
			screen.getByText(/Why It Matters \/ Impact \/ Takeaway/i),
		).toBeInTheDocument();
	});

	it("explains the analysis is pending when an LLM is on but insight is missing", () => {
		renderItem(makeEntry({}), true);
		expect(
			screen.getByText(/AI analysis hasn't run for this story yet/i),
		).toBeInTheDocument();
	});

	it("omits the note when intelligenceEnabled is not provided", () => {
		renderItem(makeEntry({}), undefined);
		expect(
			screen.queryByText(/Why It Matters \/ Impact \/ Takeaway/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/AI analysis hasn't run for this story yet/i),
		).not.toBeInTheDocument();
	});

	// ── Per-story Generate (v1.8.0) ─────────────────────────────────────────

	it("shows a Generate button on a pending story that has a body", () => {
		renderItem(makeEntry({}), true);
		expect(
			screen.getByRole("button", { name: /generate/i }),
		).toBeInTheDocument();
	});

	it("calls POST /articles/:id/insight when Generate is clicked", async () => {
		const user = userEvent.setup();
		renderItem(makeEntry({}), true);
		await user.click(screen.getByRole("button", { name: /generate/i }));
		expect(mocks.generateArticleInsight).toHaveBeenCalledTimes(1);
		expect(mocks.generateArticleInsight).toHaveBeenCalledWith("art-1");
	});

	it("shows the reason instead of a Generate button for a story with no body", () => {
		renderItem(makeEntry({ content: "" }), true);
		expect(
			screen.getByText(/Can't analyze this story — it has no body text/i),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /generate/i }),
		).not.toBeInTheDocument();
	});

	// ── Per-story Re-collect (v1.8.0) ───────────────────────────────────────

	it("shows a Re-collect action in the More menu next to Save", async () => {
		renderItem(makeEntry({}));
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /re-collect/i }),
		).toBeInTheDocument();
		// The Save button's accessible name is its aria-label, not its text.
		expect(
			screen.getByRole("button", { name: /bookmark this story/i }),
		).toBeInTheDocument();
	});

	it("starts a recollect job for that story on click", async () => {
		renderItem(makeEntry({}));
		const user = await openMore();
		await user.click(screen.getByRole("menuitem", { name: /re-collect/i }));
		expect(mocks.startRecollectOneJob).toHaveBeenCalledTimes(1);
		expect(mocks.startRecollectOneJob).toHaveBeenCalledWith({
			articleId: "art-1",
		});
	});

	it("does not navigate away when Re-collect is clicked", async () => {
		renderItem(makeEntry({}));
		const user = await openMore();
		await user.click(screen.getByRole("menuitem", { name: /re-collect/i }));
		expect(screen.queryByText("Navigated away")).not.toBeInTheDocument();
		expect(mocks.startRecollectOneJob).toHaveBeenCalledTimes(1);
	});

	// ── Per-story Re-translate (v1.8.0) ─────────────────────────────────────

	it("shows a Re-translate action when the engine flags the translation incomplete", async () => {
		renderItem(
			makeEntry({
				translatedContent: "متن خیلی کوتاه",
				originalTitle: "Old",
				translationIncomplete: true,
			}),
		);
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /re-translate/i }),
		).toBeInTheDocument();
		// No plain Translate action — the incomplete one replaces it.
		expect(
			screen.queryByRole("menuitem", { name: "Translate" }),
		).not.toBeInTheDocument();
	});

	it("shows a Re-translate action even when the translation is complete", async () => {
		// v1.8.0: Re-translate is offered for EVERY story that has a translation —
		// complete or incomplete — so the user can always force a fresh AI pass
		// (e.g. after switching the intelligence language).
		renderItem(
			makeEntry({
				translatedContent: "ترجمه کامل داستان",
				originalTitle: "Old",
				translationIncomplete: false,
			}),
		);
		await openMore();
		expect(
			screen.getByRole("menuitem", { name: /re-translate/i }),
		).toBeInTheDocument();
	});

	it("starts a re-translate job with force for an incomplete translation", async () => {
		renderItem(
			makeEntry({
				translatedContent: "متن خیلی کوتاه",
				originalTitle: "Old",
				translationIncomplete: true,
			}),
		);
		const user = await openMore();
		await user.click(screen.getByRole("menuitem", { name: /re-translate/i }));
		expect(mocks.startTranslateOneJob).toHaveBeenCalledTimes(1);
		expect(mocks.startTranslateOneJob).toHaveBeenCalledWith({
			articleId: "art-1",
			force: true,
		});
	});

	it("toggles the insight triad between the translation and its ORIGINAL (v1.8.0)", async () => {
		const user = userEvent.setup();
		const entry: BriefEntry = {
			...makeEntry({}),
			insight: {
				id: "ins-1",
				clusterId: null,
				articleId: "art-1",
				summary: "خلاصه فارسی",
				significance: "اهمیت به فارسی",
				impact: "تأثیر به فارسی",
				recommendedAction: "اقدام به فارسی",
				importanceScore: 7,
				importanceTier: "signal",
				category: "ai",
				generatedLanguage: "fa",
				originalSummary: "English summary",
				originalSignificance: "Why it matters in English",
				originalImpact: "Impact in English",
				originalRecommendedAction: "Action in English",
				createdAt: new Date(),
			},
		};
		renderItem(entry);

		// The translated triad shows by default (significance appears in both
		// the standfirst and the Why-it-matters field).
		await waitFor(() => {
			expect(screen.getAllByText("اهمیت به فارسی").length).toBeGreaterThan(0);
		});
		expect(
			screen.queryByText("Why it matters in English"),
		).not.toBeInTheDocument();

		// The insight's own Original pill flips the triad (and the standfirst)
		// to the source-language version.
		await user.click(screen.getByRole("button", { name: "Original" }));
		expect(
			screen.getAllByText("Why it matters in English").length,
		).toBeGreaterThan(0);
		expect(screen.getByText("Impact in English")).toBeInTheDocument();
		expect(screen.getByText("Action in English")).toBeInTheDocument();
		expect(screen.queryByText("اهمیت به فارسی")).not.toBeInTheDocument();
	});

	// ── Card view toggle in the footer (v1.8.0) ─────────────────────────────

	function insightEntry(): BriefEntry {
		return {
			...makeEntry({}),
			insight: {
				id: "ins-1",
				clusterId: null,
				articleId: "art-1",
				summary: "AI summary first line",
				significance: "Why it matters here",
				impact: "Impact text",
				recommendedAction: "Action text",
				importanceScore: 7,
				importanceTier: "signal",
				category: "ai",
				generatedLanguage: "en",
				originalSummary: "Original summary",
				originalSignificance: "Original significance",
				originalImpact: "Original impact",
				originalRecommendedAction: "Original action",
				createdAt: new Date(),
			},
		};
	}

	it("offers the insights view by default and switches to the article view from the footer", async () => {
		renderItem(insightEntry());
		// Default: insights view — the triad is the card's body and the headline
		// is the AI summary's first line.
		expect(screen.getByText("Impact text")).toBeInTheDocument();
		expect(screen.getByText("AI summary first line")).toBeInTheDocument();

		// The footer toggle offers the article view — the view you'd switch TO.
		const user = userEvent.setup();
		expect(
			screen.getByRole("button", { name: /article view/i }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /article view/i }));

		// Article view: the real story title + body appear, the triad is hidden.
		expect(screen.getByText("An Untranslated Story")).toBeInTheDocument();
		expect(screen.getByText(/The body text of the story/)).toBeInTheDocument();
		expect(screen.queryByText("Impact text")).not.toBeInTheDocument();

		// The footer toggle now offers the insights view to switch back.
		expect(
			screen.getByRole("button", { name: /insights view/i }),
		).toBeInTheDocument();
	});

	it("offers no view toggle on a story without an insight", async () => {
		renderItem(makeEntry({}));
		expect(
			screen.queryByRole("button", { name: /article view|insights view/i }),
		).not.toBeInTheDocument();
	});

	it("does not navigate away when the view toggle is clicked", async () => {
		renderItem(insightEntry());
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /article view/i }));
		// The card is a link (role=link) — the footer action must stopPropagation,
		// otherwise the click would bubble into card navigation.
		expect(screen.queryByText("Navigated away")).not.toBeInTheDocument();
		expect(screen.getByText("An Untranslated Story")).toBeInTheDocument();
	});
});
