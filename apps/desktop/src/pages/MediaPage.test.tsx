import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { LocalMediaSummary, PluginInfo } from "@vorynth/types";
import { MediaPage } from "@/pages/MediaPage.js";

// API + attribution layers mocked; the page + dialogs are real.
const mocks = vi.hoisted(() => ({
	fetchLocalMediaSummary: vi.fn(),
	purgeLocalMedia: vi.fn(),
	releaseArticleMedia: vi.fn(),
	fetchLocalMediaFile: vi.fn(),
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
	fetchPlugins: vi.fn(),
	patchPlugin: vi.fn(),
	drawAttributionBar: vi.fn(),
	downloadBlob: vi.fn(),
}));

vi.mock("@/features/reader/reader-api.js", () => ({
	fetchLocalMediaSummary: mocks.fetchLocalMediaSummary,
	purgeLocalMedia: mocks.purgeLocalMedia,
	releaseArticleMedia: mocks.releaseArticleMedia,
	fetchLocalMediaFile: mocks.fetchLocalMediaFile,
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

vi.mock("@/features/plugins/plugins-api.js", () => ({
	fetchPlugins: mocks.fetchPlugins,
	patchPlugin: mocks.patchPlugin,
}));

vi.mock("@/features/media/attribution.js", () => ({
	// Re-export the pure helpers (slugify, extFromUrl, fileStem,
	// buildAttributionText) and stub the two IO functions the page actually
	// drives.
	slugify: (text: string) =>
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "media",
	extFromUrl: (url: string) => {
		const m = url.match(/\.([a-z0-9]{2,4})(\?|#|$)/i);
		return m?.[1]?.toLowerCase() ?? "bin";
	},
	fileStem: (title: string, caption: string | null) =>
		caption ? `${slug(title)}-${slug(caption).slice(0, 40)}` : slug(title),
	buildAttributionText: (opts: {
		sourceName: string | null;
		creditTitle: string;
		sourceUrl: string | null;
		noSourceLabel: string;
		dateLabel: string;
		labels?: { copyright?: string; source?: string; downloadedVia?: string };
	}) => {
		const labels = {
			copyright: "©",
			source: "Source: ",
			downloadedVia: "Downloaded via Vorynth",
			...(opts.labels ?? {}),
		};
		return {
			line1: `${labels.copyright} ${new Date().getFullYear()} ${opts.sourceName || opts.noSourceLabel} — ${opts.creditTitle}`,
			line2: opts.sourceUrl
				? `${labels.source}${opts.sourceUrl}`
				: opts.noSourceLabel,
			line3: `${labels.downloadedVia} · ${opts.dateLabel}`,
		};
	},
	drawAttributionBar: mocks.drawAttributionBar,
	downloadBlob: mocks.downloadBlob,
}));

function slug(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "media"
	);
}

const mediaPlugin: PluginInfo = {
	id: "media-copyright",
	name: "Copyright & Attribution",
	description: "Credit media downloads",
	version: "1.8.0",
	kind: "ui",
	type: "media-copyright",
	adapter: "media-copyright",
	core: true,
	locked: true,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
	configuration: {},
};

const summary: LocalMediaSummary = {
	totalBytes: 100,
	totalItems: 2,
	articles: [
		{
			articleId: "art-1",
			articleTitle: "Media Article",
			articleOriginalTitle: null,
			articleUrl: "https://blog.example.com/post/1",
			sourceName: "Example Blog",
			collectedAt: "2026-08-01T00:00:00.000Z",
			itemCount: 2,
			bytes: 100,
			items: [
				{
					id: "m1",
					kind: "image",
					url: "https://blog.example.com/img.png",
					mime: "image/png",
					bytes: 50,
					caption: "Chart",
					keptAt: "2026-08-01T00:00:00.000Z",
				},
				{
					id: "m2",
					kind: "video",
					url: "https://blog.example.com/demo.mp4",
					mime: "video/mp4",
					bytes: 50,
					caption: "Demo",
					keptAt: "2026-08-01T00:00:00.000Z",
				},
			],
		},
	],
};

function renderPage(
	settings: Record<string, unknown> = {},
	data: LocalMediaSummary = summary,
) {
	mocks.fetchLocalMediaSummary.mockResolvedValue(data);
	mocks.fetchSettings.mockResolvedValue(settings as never);
	mocks.fetchPlugins.mockResolvedValue([mediaPlugin]);
	mocks.fetchLocalMediaFile.mockResolvedValue(new Blob(["bytes"]));
	mocks.drawAttributionBar.mockResolvedValue(new Blob(["png"]));
	mocks.patchSettings.mockResolvedValue({} as never);
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/media"]}>
				<MediaPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

async function openMenu(
	user: ReturnType<typeof userEvent.setup>,
	caption: string,
) {
	const button = await screen.findByRole("button", {
		name: `Download ${caption}`,
	});
	await user.click(button);
	return screen.findByRole("menu");
}

describe("MediaPage — download with copyright (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// jsdom has no canvas/image decoding — stub the bitmap decoder the
		// attribution path uses.
		globalThis.createImageBitmap = vi.fn(async () => ({}) as ImageBitmap);
	});

	it("lists every kept item with a per-item Download button", async () => {
		renderPage();
		await screen.findByText("Media Article");
		expect(
			screen.getByRole("button", { name: "Download Chart" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Download Demo" }),
		).toBeInTheDocument();
	});

	it("previews the kept bytes — an image thumbnail and an inline video player", async () => {
		const { container } = renderPage();
		await screen.findByText("Media Article");

		// Image → a clickable thumbnail served straight from the local file
		// endpoint (works offline — no source URL involved).
		const img = screen.getByRole("img", { name: "Chart" });
		expect(img).toHaveAttribute(
			"src",
			expect.stringContaining("/media/local/m1/file"),
		);
		expect(img.getAttribute("src")).not.toContain("smoke.example.com");

		// Video → an inline player with native controls.
		const video = container.querySelector("video") as HTMLVideoElement;
		expect(video).toBeInTheDocument();
		expect(video.getAttribute("src")).toContain("/media/local/m2/file");
	});

	it("opens the zoom overlay when the image thumbnail is clicked", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("Media Article");

		await user.click(screen.getByRole("button", { name: "Preview Chart" }));

		// Full-size preview joins the thumbnail (both from the local file
		// endpoint) plus a themed Close control (R-A12 — no native dialog).
		expect(screen.getAllByRole("img", { name: "Chart" })).toHaveLength(2);
		const close = await screen.findByRole("button", { name: "Close" });
		expect(close).toBeInTheDocument();

		// Close restores the page.
		await user.click(close);
		expect(
			screen.queryByRole("button", { name: "Close" }),
		).not.toBeInTheDocument();
	});

	it("opens a menu on an image offering attribution and original", async () => {
		renderPage();
		const user = userEvent.setup();
		const menu = await openMenu(user, "Chart");

		expect(
			within(menu).getByRole("menuitem", { name: /Download with attribution/ }),
		).toBeInTheDocument();
		expect(
			within(menu).getByRole("menuitem", { name: /Download original/ }),
		).toBeInTheDocument();
	});

	it("shows the one-time disclaimer and persists 'don't show again'", async () => {
		renderPage();
		const user = userEvent.setup();
		const menu = await openMenu(user, "Chart");
		await user.click(
			within(menu).getByRole("menuitem", { name: /Download with attribution/ }),
		);

		// The disclaimer dialog (ConfirmDialog, role=alertdialog) appears.
		const dialog = await screen.findByRole("alertdialog", {
			name: "Check this blog's policy",
		});
		// "Don't show again" is checked, then confirmed.
		const checkbox = within(dialog).getByRole("checkbox");
		await user.click(checkbox);
		await user.click(within(dialog).getByRole("button", { name: "Download" }));

		// The setting is persisted and the download proceeds to the image.
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"media.showDownloadWarning": false,
		});
		expect(mocks.fetchLocalMediaFile).toHaveBeenCalledWith("m1");
		expect(mocks.downloadBlob).toHaveBeenCalledWith(
			expect.any(Blob),
			"media-article-chart-credit.png",
		);
		// Credit cites the blog + article title (never translated).
		const credit = mocks.drawAttributionBar.mock.calls[0]?.[1] as {
			line1: string;
		};
		expect(credit.line1).toContain("Example Blog");
		expect(credit.line1).toContain("Media Article");
	});

	it("cites the ORIGINAL title in the credit when the story was translated", async () => {
		const translated: LocalMediaSummary = {
			...summary,
			articles: [
				{
					...summary.articles[0]!,
					articleTitle: "عنوان ترجمه شده",
					articleOriginalTitle: "Original Published Title",
				},
			],
		};
		renderPage({ "media.showDownloadWarning": false }, translated);

		const user = userEvent.setup();
		const menu = await openMenu(user, "Chart");
		await user.click(
			within(menu).getByRole("menuitem", { name: /Download with attribution/ }),
		);

		const credit = mocks.drawAttributionBar.mock.calls[0]?.[1] as {
			line1: string;
		};
		expect(credit.line1).toContain("Original Published Title");
		expect(credit.line1).not.toContain("عنوان ترجمه شده");
	});

	it("downloads the original without credit when the warning is off", async () => {
		renderPage({ "media.showDownloadWarning": false });
		const user = userEvent.setup();
		const menu = await openMenu(user, "Chart");
		await user.click(
			within(menu).getByRole("menuitem", { name: /Download original/ }),
		);

		// No disclaimer dialog — straight to the original file.
		expect(
			screen.queryByRole("alertdialog", { name: "Check this blog's policy" }),
		).not.toBeInTheDocument();
		expect(mocks.fetchLocalMediaFile).toHaveBeenCalledWith("m1");
		expect(mocks.downloadBlob).toHaveBeenCalledWith(
			expect.any(Blob),
			"media-article-chart.png",
		);
		expect(mocks.drawAttributionBar).not.toHaveBeenCalled();
	});

	it("videos only offer the original download and are saved as-is", async () => {
		renderPage({ "media.showDownloadWarning": false });
		const user = userEvent.setup();
		const menu = await openMenu(user, "Demo");

		expect(
			within(menu).queryByRole("menuitem", {
				name: /Download with attribution/,
			}),
		).not.toBeInTheDocument();
		await user.click(
			within(menu).getByRole("menuitem", { name: /Download original/ }),
		);

		expect(mocks.fetchLocalMediaFile).toHaveBeenCalledWith("m2");
		expect(mocks.downloadBlob).toHaveBeenCalledWith(
			expect.any(Blob),
			expect.stringMatching(/\.mp4$/),
		);
	});
});
