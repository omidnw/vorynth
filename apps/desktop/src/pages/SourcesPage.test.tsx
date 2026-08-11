import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type {
	PluginInfo,
	RefreshCatalogResult,
	Source,
	SourceListInfo,
} from "@vorynth/types";
import { SourcesPage } from "@/pages/SourcesPage.js";

// API layers mocked; the page + dialogs are real.
const mocks = vi.hoisted(() => ({
	fetchSources: vi.fn(),
	createSource: vi.fn(),
	deleteSource: vi.fn(),
	fetchSourceArticles: vi.fn(),
	toggleSource: vi.fn(),
	updateSource: vi.fn(),
	verifySource: vi.fn(),
	fetchPlugins: vi.fn(),
	fetchSourceLists: vi.fn(),
	enableSourceList: vi.fn(),
	disableSourceList: vi.fn(),
	refreshSourceLists: vi.fn(),
	fetchSettings: vi.fn(),
	enableSourceGroup: vi.fn(),
}));

vi.mock("@/features/sources/sources-api.js", () => ({
	fetchSources: mocks.fetchSources,
	createSource: mocks.createSource,
	deleteSource: mocks.deleteSource,
	fetchSourceArticles: mocks.fetchSourceArticles,
	toggleSource: mocks.toggleSource,
	updateSource: mocks.updateSource,
	verifySource: mocks.verifySource,
	fetchSourceLists: mocks.fetchSourceLists,
	enableSourceList: mocks.enableSourceList,
	disableSourceList: mocks.disableSourceList,
	refreshSourceLists: mocks.refreshSourceLists,
	enableSourceGroup: mocks.enableSourceGroup,
}));

vi.mock("@/features/plugins/plugins-api.js", () => ({
	fetchPlugins: mocks.fetchPlugins,
	setPluginEnabled: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
}));

const rssPlugin: PluginInfo = {
	id: "rss",
	name: "RSS",
	description: "Web feeds",
	version: "1.8.0",
	kind: "adapter",
	type: "rss",
	adapter: "rss",
	core: true,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [
		{ key: "feedUrl", label: "Feed URL", type: "url", required: true },
	],
};

const htmlPlugin: PluginInfo = {
	id: "html",
	name: "HTML Crawler",
	description: "CSS-selector page crawler",
	version: "1.8.0",
	kind: "adapter",
	type: "html",
	adapter: "html",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [
		{ key: "crawl.url", label: "Page URL", type: "url", required: true },
		{
			key: "crawl.itemSelector",
			label: "Item selector",
			type: "text",
			placeholder: "article",
		},
		{
			key: "crawl.contentSelector",
			label: "Content selector",
			type: "text",
		},
	],
};

const apiPlugin: PluginInfo = {
	id: "api",
	name: "JSON API",
	description: "Structured data endpoints",
	version: "1.8.0",
	kind: "adapter",
	type: "api",
	adapter: "api",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [
		{ key: "api.apiUrl", label: "API URL", type: "url", required: true },
		{
			key: "api.titleField",
			label: "Title field",
			type: "text",
			required: true,
		},
		{
			key: "api.headers",
			label: "Headers (JSON)",
			type: "textarea",
		},
	],
};

// ── list fixtures ───────────────────────────────────────────────────────────

const devList: SourceListInfo = {
	id: "developer",
	name: "Developer & Software Engineering",
	description: "Core dev feeds",
	origin: "official",
	nsfw: false,
	enabled: true,
	version: null,
	curator: null,
	canUpdate: false,
	sourceCount: 1,
	enabledCount: 1,
	updatedAt: null,
	createdAt: "2026-08-01T00:00:00.000Z",
};

const securityList: SourceListInfo = {
	id: "security-news",
	name: "Security News",
	description: "Community security feeds",
	origin: "community",
	nsfw: false,
	enabled: false,
	version: "1.0.0",
	curator: "omidnw",
	canUpdate: true,
	sourceCount: 3,
	enabledCount: 0,
	updatedAt: "2026-08-01T00:00:00.000Z",
	createdAt: "2026-08-01T00:00:00.000Z",
};

const adultList: SourceListInfo = {
	id: "adult-media",
	name: "Mature Media",
	description: "18+ content",
	origin: "community",
	nsfw: true,
	enabled: false,
	version: "1.0.0",
	curator: "someone",
	canUpdate: true,
	sourceCount: 2,
	enabledCount: 0,
	updatedAt: null,
	createdAt: "2026-08-01T00:00:00.000Z",
};

function makeSource(overrides: Partial<Source>): Source {
	return {
		id: "src-default",
		name: "OpenAI Blog",
		url: "https://openai.com/blog",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: { feedUrl: "https://openai.com/blog/feed.xml" },
		enabled: true,
		listId: null,
		fetchWindowDays: 7,
		fetchFrom: null,
		fetchTo: null,
		lastCheckedAt: null,
		country: null,
		city: null,
		language: null,
		scope: null,
		authority: null,
		impactAreas: null,
		tags: null,
		createdAt: new Date("2026-08-01T00:00:00.000Z"),
		...overrides,
	};
}

const openAiSource = makeSource({ id: "src-openai", listId: "developer" });
const mySource = makeSource({
	id: "src-mine",
	name: "My custom feed",
	url: "https://example.com/feed.xml",
	configuration: { feedUrl: "https://example.com/feed.xml" },
});

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/sources"]}>
				<SourcesPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

/**
 * Switch the page's group-by selector to the given view ("List", "Country", …).
 * The page defaults to Category, so list-mode tests opt into List explicitly.
 */
async function switchGroupBy(
	user: ReturnType<typeof userEvent.setup>,
	label: string,
) {
	await user.click(screen.getByRole("button", { name: "Group sources by" }));
	await selectOption(user, label);
}

/**
 * Pick a value from a themed Select: the `<li role="option">` wraps a button,
 * and userEvent dispatches on the element passed to click — so click the inner
 * button (the li has no handler of its own).
 */
async function selectOption(
	user: ReturnType<typeof userEvent.setup>,
	label: string,
) {
	const option = await screen.findByRole("option", { name: label });
	await user.click(within(option).getByRole("button"));
}

describe("SourcesPage — Add Source form config fields (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([]);
		mocks.fetchSourceLists.mockResolvedValue([]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.fetchPlugins.mockResolvedValue([rssPlugin, htmlPlugin, apiPlugin]);
		mocks.verifySource.mockResolvedValue({
			ok: true,
			itemCount: 3,
			samples: ["Post one", "Post two", "Post three"],
		});
		mocks.createSource.mockResolvedValue({} as Source);
		mocks.fetchSourceArticles.mockResolvedValue({ articles: [], total: 0 });
	});

	async function openAddForm() {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("button", { name: "Add Source" });
		await user.click(screen.getByRole("button", { name: "Add Source" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add new source",
		});
		return { user, dialog };
	}

	it("renders the RSS method's feed URL field by default", async () => {
		const { dialog } = await openAddForm();
		expect(within(dialog).getByLabelText("Feed URL")).toBeInTheDocument();
	});

	it("switching to HTML shows the selector fields from the manifest", async () => {
		const { user, dialog } = await openAddForm();
		await user.click(within(dialog).getByRole("button", { name: "html" }));

		expect(within(dialog).getByLabelText("Page URL")).toBeInTheDocument();
		expect(within(dialog).getByLabelText("Item selector")).toBeInTheDocument();
		expect(
			within(dialog).getByLabelText("Content selector"),
		).toBeInTheDocument();
	});

	it("switching to API shows the field-mapping inputs incl. the headers textarea", async () => {
		const { user, dialog } = await openAddForm();
		await user.click(within(dialog).getByRole("button", { name: "api" }));

		expect(within(dialog).getByLabelText("API URL")).toBeInTheDocument();
		expect(within(dialog).getByLabelText("Title field")).toBeInTheDocument();
		// textarea for the headers JSON.
		expect(within(dialog).getByLabelText("Headers (JSON)")).toBeInTheDocument();
	});

	it("Test dry-runs the config and shows what the adapter would collect", async () => {
		const { user, dialog } = await openAddForm();
		const feedUrl = within(dialog).getByLabelText("Feed URL");
		await user.type(feedUrl, "https://example.com/feed.xml");
		await user.click(within(dialog).getByRole("button", { name: "Test" }));

		expect(mocks.verifySource).toHaveBeenCalledWith({
			type: "rss",
			url: "https://example.com/feed.xml",
			configuration: { feedUrl: "https://example.com/feed.xml" },
		});
		// Success message with sample titles.
		expect(
			await screen.findByText(/Works — 3 item\(s\) found/),
		).toBeInTheDocument();
		expect(screen.getByText("Post one")).toBeInTheDocument();
	});

	it("builds a nested configuration from dotted keys on add", async () => {
		const { user, dialog } = await openAddForm();
		await user.type(within(dialog).getByLabelText("Name"), "Example news");
		await user.click(within(dialog).getByRole("button", { name: "html" }));
		await user.type(
			within(dialog).getByLabelText("Page URL"),
			"https://example.com/news",
		);
		await user.type(
			within(dialog).getByLabelText("Item selector"),
			"article.post",
		);
		await user.click(
			within(dialog).getByRole("button", { name: "Add Source" }),
		);

		expect(mocks.createSource).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "html",
				url: "https://example.com/news",
				configuration: {
					crawl: {
						url: "https://example.com/news",
						itemSelector: "article.post",
					},
				},
			}),
		);
	});
});

describe("SourcesPage — list groups + master switch (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([openAiSource]);
		mocks.fetchSourceLists.mockResolvedValue([devList]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.fetchPlugins.mockResolvedValue([rssPlugin, htmlPlugin, apiPlugin]);
		mocks.disableSourceList.mockResolvedValue({
			...devList,
			enabled: false,
		});
	});

	it("shows an enabled list as a group with its sources hidden until expanded", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");

		expect(
			await screen.findByRole("heading", {
				name: "Developer & Software Engineering",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Official")).toBeInTheDocument();
		expect(screen.getByText("1 sources")).toBeInTheDocument();
		// The source is inside the collapsed group — not visible yet.
		expect(screen.queryByText("OpenAI Blog")).not.toBeInTheDocument();
	});

	it("expanding a list reveals its sources", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");
		const expand = await screen.findByRole("button", {
			name: "Show sources in Developer & Software Engineering",
		});
		await user.click(expand);

		expect(screen.getByText("OpenAI Blog")).toBeInTheDocument();
		// List sources get edit but never delete (the list owns them, R-A10).
		expect(
			screen.getByRole("button", { name: "Edit OpenAI Blog" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Delete OpenAI Blog" }),
		).not.toBeInTheDocument();
	});

	it("master switch off calls disableSourceList (hide — nothing deleted)", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");
		const masterSwitch = await screen.findByRole("switch", {
			name: "Turn Developer & Software Engineering off",
		});
		expect(masterSwitch).toHaveAttribute("aria-checked", "true");
		await user.click(masterSwitch);

		expect(mocks.disableSourceList).toHaveBeenCalledWith("developer");
	});
});

describe("SourcesPage — browse community lists (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([]);
		mocks.fetchSourceLists.mockResolvedValue([securityList, adultList]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.enableSourceList.mockResolvedValue(securityList);
	});

	it("18+ lists are hidden from browsing by default", async () => {
		renderPage();

		// The safe community list is browsable…
		expect(await screen.findByText("Security News")).toBeInTheDocument();
		// …but the 18+ list is hidden until the user reveals it.
		expect(screen.queryByText("Mature Media")).not.toBeInTheDocument();
	});

	it("revealing 18+ lists shows them with an Add-list action", async () => {
		const user = userEvent.setup();
		renderPage();
		await user.click(
			await screen.findByRole("button", { name: "Show 18+ lists (1)" }),
		);

		expect(screen.getByText("Mature Media")).toBeInTheDocument();
		expect(screen.getByText("18+")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add list Mature Media" }),
		).toBeInTheDocument();
	});

	it("adding a non-18+ community list enables it immediately", async () => {
		const user = userEvent.setup();
		renderPage();
		const addButton = await screen.findByRole("button", {
			name: "Add list Security News",
		});
		await user.click(addButton);

		expect(mocks.enableSourceList).toHaveBeenCalledWith("security-news");
	});

	it("adding an 18+ list asks for confirmation before enabling", async () => {
		const user = userEvent.setup();
		renderPage();
		await user.click(
			await screen.findByRole("button", { name: "Show 18+ lists (1)" }),
		);
		await user.click(
			screen.getByRole("button", { name: "Add list Mature Media" }),
		);

		// Themed confirm dialog, not a native one (R-A12).
		const confirm = await screen.findByRole("alertdialog", {
			name: "Adult content",
		});
		expect(confirm).toBeInTheDocument();
		expect(
			within(confirm).getByText(/may contain content unsuitable for minors/),
		).toBeInTheDocument();

		// Confirm → the list is enabled.
		await user.click(within(confirm).getByRole("button", { name: "Add list" }));
		expect(mocks.enableSourceList).toHaveBeenCalledWith("adult-media");
		// Cancel path never enables.
		mocks.enableSourceList.mockClear();
		await user.click(
			screen.getByRole("button", { name: "Add list Mature Media" }),
		);
		await user.click(
			within(
				screen.getByRole("alertdialog", { name: "Adult content" }),
			).getByRole("button", { name: "Cancel" }),
		);
		expect(mocks.enableSourceList).not.toHaveBeenCalled();
	});

	it("Check GitHub for lists refreshes the catalog and reports the outcome", async () => {
		const user = userEvent.setup();
		const result: RefreshCatalogResult = {
			added: ["security-news"],
			updated: [],
			removed: [],
			unchanged: [],
			skipped: ["broken-list"],
		};
		mocks.refreshSourceLists.mockResolvedValue(result);
		renderPage();

		await user.click(
			await screen.findByRole("button", { name: "Check GitHub for lists" }),
		);

		expect(mocks.refreshSourceLists).toHaveBeenCalledTimes(1);
		expect(await screen.findByText("Added 1")).toBeInTheDocument();
		expect(screen.getByText("Skipped 1")).toBeInTheDocument();
	});
});

describe("SourcesPage — My sources + edit mode (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([mySource]);
		mocks.fetchSourceLists.mockResolvedValue([]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.fetchPlugins.mockResolvedValue([rssPlugin, htmlPlugin, apiPlugin]);
		mocks.updateSource.mockResolvedValue({} as Source);
	});

	it("user-created sources render with edit + delete actions", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");

		expect(await screen.findByText("My custom feed")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Edit My custom feed" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete My custom feed" }),
		).toBeInTheDocument();
	});

	it("edit form pre-fills name/category/config and saves via updateSource", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");

		await user.click(
			await screen.findByRole("button", { name: "Edit My custom feed" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Edit source" });

		// Pre-filled from the source row.
		const nameInput = within(dialog).getByLabelText("Name");
		expect(nameInput).toHaveValue("My custom feed");
		// Config field prefilled from source.configuration via the dotted key.
		expect(within(dialog).getByLabelText("Feed URL")).toHaveValue(
			"https://example.com/feed.xml",
		);
		// Type is fixed in edit mode — no method switcher.
		expect(
			within(dialog).queryByRole("button", { name: "html" }),
		).not.toBeInTheDocument();

		await user.clear(nameInput);
		await user.type(nameInput, "Renamed feed");
		await user.click(
			within(dialog).getByRole("button", { name: "Save changes" }),
		);

		expect(mocks.updateSource).toHaveBeenCalledWith("src-mine", {
			name: "Renamed feed",
			category: "ai",
			configuration: { feedUrl: "https://example.com/feed.xml" },
			country: null,
			city: null,
			language: null,
			scope: null,
			authority: null,
			impactAreas: [],
			tags: null,
		});
	});

	it("search filters My sources by name", async () => {
		mocks.fetchSources.mockResolvedValue([
			mySource,
			makeSource({
				id: "src-zebra",
				name: "Zebra Dev Blog",
				url: "https://zebra.dev/blog",
			}),
		]);
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "List");

		expect(await screen.findByText("Zebra Dev Blog")).toBeInTheDocument();
		await user.type(screen.getByPlaceholderText("Search sources…"), "zebra");

		expect(screen.getByText("Zebra Dev Blog")).toBeInTheDocument();
		expect(screen.queryByText("My custom feed")).not.toBeInTheDocument();
	});
});

describe("SourcesPage — geography tags on the source form (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([]);
		mocks.fetchSourceLists.mockResolvedValue([]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.fetchPlugins.mockResolvedValue([rssPlugin, htmlPlugin, apiPlugin]);
		mocks.createSource.mockResolvedValue({} as Source);
	});

	it("shows Country, City, and Language fields on the add form", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("button", { name: "Add Source" });
		await user.click(screen.getByRole("button", { name: "Add Source" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add new source",
		});

		expect(
			within(dialog).getByRole("button", { name: "Source country" }),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Source language" }),
		).toBeInTheDocument();
		expect(within(dialog).getByLabelText("City / region")).toBeInTheDocument();
	});

	it("add passes the selected geography tags to createSource", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("button", { name: "Add Source" });
		await user.click(screen.getByRole("button", { name: "Add Source" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add new source",
		});

		await user.type(within(dialog).getByLabelText("Name"), "Example news");
		await user.type(
			within(dialog).getByLabelText("Feed URL"),
			"https://example.com/feed.xml",
		);

		// Country: Germany → "DE".
		await user.click(
			within(dialog).getByRole("button", { name: "Source country" }),
		);
		await selectOption(user, "Germany");

		await user.type(within(dialog).getByLabelText("City / region"), "Berlin");

		// Language: German → "de".
		await user.click(
			within(dialog).getByRole("button", { name: "Source language" }),
		);
		await selectOption(user, "German");

		await user.click(
			within(dialog).getByRole("button", { name: "Add Source" }),
		);

		expect(mocks.createSource).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Example news",
				url: "https://example.com/feed.xml",
				country: "DE",
				city: "Berlin",
				language: "de",
			}),
		);
	});

	it("shows Scope, Authority, and Impact areas fields with suggestion chips", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("button", { name: "Add Source" });
		await user.click(screen.getByRole("button", { name: "Add Source" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add new source",
		});

		expect(
			within(dialog).getByRole("button", { name: "Source scope" }),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Source authority" }),
		).toBeInTheDocument();
		expect(within(dialog).getByLabelText("Impact areas")).toBeInTheDocument();
		// A suggested-vocabulary chip is present and toggles.
		expect(
			within(dialog).getByRole("button", { name: "security" }),
		).toHaveAttribute("aria-pressed", "false");
	});

	it("add passes the selected semantic metadata to createSource", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("button", { name: "Add Source" });
		await user.click(screen.getByRole("button", { name: "Add Source" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add new source",
		});

		await user.type(within(dialog).getByLabelText("Name"), "Example news");
		await user.type(
			within(dialog).getByLabelText("Feed URL"),
			"https://example.com/feed.xml",
		);

		// Scope: Global.
		await user.click(
			within(dialog).getByRole("button", { name: "Source scope" }),
		);
		await selectOption(user, "Global");
		// Authority: Official.
		await user.click(
			within(dialog).getByRole("button", { name: "Source authority" }),
		);
		await selectOption(user, "Official");
		// Impact areas — typed + a chip appends to the comma list.
		const areas = within(dialog).getByLabelText("Impact areas");
		await user.type(areas, "ai, security");
		await user.click(within(dialog).getByRole("button", { name: "cloud" }));
		expect(areas).toHaveValue("ai, security, cloud");

		await user.click(
			within(dialog).getByRole("button", { name: "Add Source" }),
		);

		expect(mocks.createSource).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Example news",
				url: "https://example.com/feed.xml",
				scope: "global",
				authority: "official",
				impactAreas: ["ai", "security", "cloud"],
				tags: null,
			}),
		);
	});
});

describe("SourcesPage — group by category/country/city/language (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSources.mockResolvedValue([
			makeSource({
				id: "src-openai",
				name: "OpenAI Blog",
				category: "ai",
				country: "US",
				city: "San Francisco",
				language: "en",
				scope: "global",
				authority: "official",
				impactAreas: ["ai", "llm"],
				tags: null,
			}),
			makeSource({
				id: "src-smashing",
				name: "Smashing Magazine",
				category: "web-development",
				country: "DE",
				city: "Freiburg",
				language: "en",
			}),
			makeSource({
				id: "src-krebs",
				name: "Krebs on Security",
				category: "security",
				country: "US",
				city: null,
				language: "en",
			}),
		]);
		mocks.fetchSourceLists.mockResolvedValue([]);
		mocks.fetchSettings.mockResolvedValue({} as never);
		mocks.fetchPlugins.mockResolvedValue([rssPlugin, htmlPlugin, apiPlugin]);
		mocks.enableSourceGroup.mockResolvedValue({ updated: 2 });
	});

	it("defaults to Category and groups the official sources into cards", async () => {
		renderPage();

		// Group cards render with counts — not one flat block.
		expect(
			await screen.findByRole("heading", { name: "ai" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "security" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "web-development" }),
		).toBeInTheDocument();
		expect(screen.getAllByText("1 sources")).toHaveLength(3);
		// Sources stay hidden until their group expands.
		expect(screen.queryByText("OpenAI Blog")).not.toBeInTheDocument();
	});

	it("expanding a group reveals its sources with a language badge", async () => {
		const user = userEvent.setup();
		renderPage();
		await user.click(
			await screen.findByRole("button", { name: "Show sources in ai" }),
		);

		expect(screen.getByText("OpenAI Blog")).toBeInTheDocument();
		// Language badge on the row + full name in its tooltip.
		const badge = screen.getByText("en");
		await user.hover(badge);
		expect(await screen.findByRole("tooltip")).toHaveTextContent("English");
		// Semantic metadata: the authority badge renders with its tooltip.
		const authorityBadge = screen.getByText("official");
		await user.hover(authorityBadge);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Official — how credible this source is",
		);
	});

	it("the group master switch calls the bulk endpoint for the whole category", async () => {
		const user = userEvent.setup();
		renderPage();
		const masterSwitch = await screen.findByRole("switch", {
			name: "Disable all ai sources",
		});
		expect(masterSwitch).toHaveAttribute("aria-checked", "true");
		await user.click(masterSwitch);

		expect(mocks.enableSourceGroup).toHaveBeenCalledWith({
			dimension: "category",
			value: "ai",
			enabled: false,
		});
	});

	it("grouping by Country shows region names with the ISO code tag", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "Country");

		expect(
			await screen.findByRole("heading", { name: "United States" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Germany" }),
		).toBeInTheDocument();
		// ISO code shown as a tag next to the region name.
		expect(screen.getByText("US")).toBeInTheDocument();
		// Bulk toggle targets the country dimension.
		await user.click(
			screen.getByRole("switch", {
				name: "Disable all United States sources",
			}),
		);
		expect(mocks.enableSourceGroup).toHaveBeenCalledWith({
			dimension: "country",
			value: "US",
			enabled: false,
		});
	});

	it("grouping by City buckets by region with untagged sources at the end", async () => {
		const user = userEvent.setup();
		renderPage();
		await switchGroupBy(user, "City");

		expect(
			await screen.findByRole("heading", { name: "San Francisco" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Freiburg" }),
		).toBeInTheDocument();
		// The source without a city lands in the Untagged group.
		expect(
			screen.getByRole("heading", { name: "Untagged" }),
		).toBeInTheDocument();
	});
});
