import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Article, ArticleDetail, ExportableContent } from "@vorynth/types";
import { ArticleDetailPage } from "@/pages/ArticleDetailPage.js";
import { usePluginContributions } from "@/plugins/plugin-contributions.js";

// API layers mocked; the page + dialogs are real.
const mocks = vi.hoisted(() => ({
	fetchArticleDetail: vi.fn(),
	fetchArticleMedia: vi.fn(),
	setMediaKeep: vi.fn(),
	releaseArticleMedia: vi.fn(),
	translateArticle: vi.fn(),
	fetchSettings: vi.fn(),
	recordStoryView: vi.fn(),
}));

vi.mock("@/features/reader/reader-api.js", () => ({
	fetchArticleDetail: mocks.fetchArticleDetail,
	fetchArticleMedia: mocks.fetchArticleMedia,
	setMediaKeep: mocks.setMediaKeep,
	releaseArticleMedia: mocks.releaseArticleMedia,
	translateArticle: mocks.translateArticle,
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
}));

vi.mock("@/features/story-views/story-views-api.js", () => ({
	recordStoryView: mocks.recordStoryView,
}));

function makeArticle(overrides: Partial<Article>): Article {
	return {
		id: "art-1",
		sourceId: "src-1",
		title: "Untranslated Story Title",
		content: "The body text of the story.",
		url: "https://example.com/story-1",
		author: "Jane Author",
		publishedAt: new Date("2026-08-01T00:00:00Z"),
		collectedAt: new Date("2026-08-01T00:00:00Z"),
		hash: "h1",
		...overrides,
	};
}

function renderPage(detail: ArticleDetail) {
	mocks.fetchArticleDetail.mockResolvedValue(detail);
	mocks.fetchArticleMedia.mockResolvedValue([]);
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/articles/art-1"]}>
				<Routes>
					<Route path="/articles/:id" element={<ArticleDetailPage />} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

/** A fake plugin panel proving the reader renders StoryExports contributions. */
function FakeExportPanel({
	content,
	onClose,
}: {
	content: ExportableContent;
	onClose: () => void;
}) {
	return (
		<div>
			<p>Export {content.title}</p>
			<button type="button">Download Markdown</button>
			<button type="button" onClick={onClose}>
				Close
			</button>
		</div>
	);
}

describe("ArticleDetailPage — per-story translate + export (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usePluginContributions.getState().clear();
		mocks.recordStoryView.mockResolvedValue(undefined);
		// The support-author reminder reads this setting — keep it off so the
		// modal doesn't cover the reader in tests. Pin every footer action so
		// the Export button renders directly in the bar (v1.8.0: unpinned
		// actions live behind the More ⋮ menu).
		mocks.fetchSettings.mockResolvedValue({
			"reader.supportAuthorReminder": false,
			"ui.readerPinnedActions": [
				"markRead",
				"save",
				"recollect",
				"retranslate",
				"share",
				"export",
				"openOriginal",
				"back",
			],
		} as never);
	});

	it("records the open as a story view (article scope) on mount", async () => {
		renderPage({
			article: makeArticle({}),
			sourceName: null,
			sourceCategory: null,
		});
		expect(mocks.recordStoryView).toHaveBeenCalledWith({
			articleId: "art-1",
			scope: "article",
		});
	});

	it("shows the Translate button before the title when the story has no translation", async () => {
		renderPage({
			article: makeArticle({}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		const translate = await screen.findByRole("button", { name: "Translate" });
		expect(translate).toBeInTheDocument();
	});

	it("hides the Translate button once the story is translated", async () => {
		renderPage({
			article: makeArticle({
				title: "Translated Title",
				originalTitle: "Untranslated Story Title",
				translatedContent: "Translated body.",
			}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		// The translated title renders and the Original/Translated pill shows
		// (its accessible name is the "Original"/"Translated" label) — but the
		// Translate action is gone.
		await screen.findByText("Translated Title");
		expect(
			screen.getAllByRole("button", { name: "Original" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByRole("button", { name: "Translate" }),
		).not.toBeInTheDocument();
	});

	it("translates on click and disables while in flight", async () => {
		const user = userEvent.setup();
		renderPage({
			article: makeArticle({}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		const translate = await screen.findByRole("button", { name: "Translate" });
		mocks.translateArticle.mockReturnValue(new Promise(() => {})); // stays pending
		await user.click(translate);

		expect(mocks.translateArticle).toHaveBeenCalledWith("art-1");
		// Disabled + "Translating…" label while the request is in flight.
		const busy = await screen.findByRole("button", { name: "Translating…" });
		expect(busy).toBeDisabled();
	});

	it("shows an inline error when translation fails", async () => {
		const user = userEvent.setup();
		renderPage({
			article: makeArticle({}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		mocks.translateArticle.mockRejectedValue(new Error("provider down"));
		const translate = await screen.findByRole("button", { name: "Translate" });
		await user.click(translate);

		expect(await screen.findByText(/Translation failed/)).toBeInTheDocument();
	});

	it("offers Re-translate in the footer next to Re-collect for a translated story", async () => {
		const user = userEvent.setup();
		renderPage({
			article: makeArticle({
				title: "Translated Title",
				originalTitle: "Untranslated Story Title",
				translatedContent: "Translated body.",
			}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		// The footer carries Re-collect and Re-translate side by side. (The title
		// row ALSO shows a Re-translate pill for a fully-translated story, so
		// scope to the footer's own element.)
		const recollect = await screen.findByRole("button", { name: "Re-collect" });
		const footer = recollect.closest("footer");
		expect(footer).not.toBeNull();
		const retranslate = within(footer!).getByRole("button", {
			name: "Re-translate",
		});
		expect(recollect).toBeInTheDocument();
		expect(retranslate).toBeInTheDocument();

		// Clicking it forces a fresh translation (force: true).
		mocks.translateArticle.mockResolvedValue({
			article: makeArticle({
				title: "Translated Title",
				originalTitle: "Untranslated Story Title",
				translatedContent: "Translated body v2.",
			}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});
		await user.click(retranslate);
		expect(mocks.translateArticle).toHaveBeenCalledWith("art-1", {
			force: true,
		});
	});

	it("hides the footer Re-translate action for a never-translated story", async () => {
		renderPage({
			article: makeArticle({}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		await screen.findByRole("button", { name: "Re-collect" });
		expect(
			screen.queryByRole("button", { name: "Re-translate" }),
		).not.toBeInTheDocument();
		// The Translate pill covers the untranslated case instead.
		expect(
			screen.getByRole("button", { name: "Translate" }),
		).toBeInTheDocument();
	});

	it("renders the Export action in the footer and opens the plugin panel", async () => {
		usePluginContributions.getState().register({
			id: "story-renderer",
			name: "Story Renderer",
			version: "1.8.0",
			exports: { StoryExports: FakeExportPanel },
		});
		const user = userEvent.setup();
		renderPage({
			article: makeArticle({}),
			sourceName: "Example Blog",
			sourceCategory: "other",
		});

		const exportBtn = await screen.findByRole("button", { name: "Export" });
		await user.click(exportBtn);

		// The plugin's StoryExports panel renders inside the dialog.
		const dialog = await screen.findByRole("dialog", {
			name: "Export",
		});
		expect(
			within(dialog).getByText("Export Untranslated Story Title"),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Download Markdown" }),
		).toBeInTheDocument();

		// Close via the panel's own Close button — it calls onClose, hiding the
		// dialog. We assert the callback fired by checking the dialog is gone.
		await user.click(within(dialog).getByRole("button", { name: "Close" }));
		expect(
			screen.queryByRole("dialog", { name: "Export" }),
		).not.toBeInTheDocument();
	});
});
