import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ArchiveItem } from "@vorynth/types";
import { ArchivePage } from "@/pages/ArchivePage.js";

// The archive API layer is mocked; the page is real.
const mocks = vi.hoisted(() => ({
	fetchArchiveItems: vi.fn(),
	fetchCollections: vi.fn(),
	patchArchiveItem: vi.fn(),
	createBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
	deleteArchiveItem: vi.fn(),
}));

vi.mock("@/features/archive/archive-api.js", () => mocks);

// v1.8.1 — the in-page tab row is only shown in "inpage" navigation mode; the
// sidebar submenu is the default. These tests exercise the in-page row, so
// pin that mode.
vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: vi.fn(async () => ({ "ui.archiveNavMode": "inpage" })),
}));

const item: ArchiveItem = {
	contentItemId: "item-1",
	contentType: "article",
	note: null,
	collectionId: null,
	archivedAt: null,
	bookmarked: false,
	tags: [],
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
	title: "Deep learning paper",
	originalTitle: null,
	url: null,
	author: null,
	publishedAt: null,
	origin: { id: "article-1" },
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/archive"]}>
				<Routes>
					<Route path="/archive" element={<ArchivePage />} />
					<Route
						path="/archive/collections"
						element={<div>COLLECTIONS PAGE</div>}
					/>
					<Route path="/docs" element={<div>DOCS PAGE</div>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("ArchivePage — compact items browser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchArchiveItems.mockResolvedValue({
			items: [item],
			total: 1,
			hasMore: false,
		});
		mocks.fetchCollections.mockResolvedValue({ items: [] });
	});

	it("renders items with their type badge", async () => {
		renderPage();

		expect(
			await screen.findByRole("button", { name: "Deep learning paper" }),
		).toBeInTheDocument();
		// The item's own type badge (Story) renders beside it.
		expect(screen.getByText("Story")).toBeInTheDocument();
	});

	it("shows both the translated and the ORIGINAL title of a story (v1.8.0)", async () => {
		mocks.fetchArchiveItems.mockResolvedValue({
			items: [
				{
					...item,
					title: "عنوان ترجمه شده",
					originalTitle: "Deep learning paper",
				},
			],
			total: 1,
			hasMore: false,
		});
		renderPage();

		// The translated title is the card's main title…
		expect(await screen.findByText("عنوان ترجمه شده")).toBeInTheDocument();
		// …and the original source title stays visible beneath it.
		expect(screen.getByText(/Deep learning paper/)).toBeInTheDocument();
		// An Original/Translated toggle sits right under the type badge (v1.8.0).
		const toggle = screen.getByRole("button", { name: "Original" });
		expect(toggle).toHaveAttribute("aria-pressed", "false");
	});

	it("the Original/Translated toggle swaps which title is primary (v1.8.0)", async () => {
		mocks.fetchArchiveItems.mockResolvedValue({
			items: [
				{
					...item,
					title: "عنوان ترجمه شده",
					originalTitle: "Deep learning paper",
				},
			],
			total: 1,
			hasMore: false,
		});
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole("button", { name: "Original" }));
		// The ORIGINAL becomes the card's main title; the translation turns
		// into the muted line and the toggle reads "Translated".
		expect(screen.getByText("Deep learning paper")).toBeInTheDocument();
		expect(screen.getByText(/عنوان ترجمه شده/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Translated" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("archives a live item on the Archive action (v1.8.0 regression)", async () => {
		const user = userEvent.setup();
		mocks.patchArchiveItem.mockResolvedValue({ ...item, archivedAt: null });
		renderPage();
		await screen.findByRole("button", { name: "Deep learning paper" });

		await user.click(screen.getByRole("button", { name: "Archive" }));

		// The target state is the OPPOSITE of the current one — the bug passed
		// the current state (false for a live item), making the click a no-op.
		expect(mocks.patchArchiveItem).toHaveBeenCalledWith("item-1", {
			archived: true,
		});
	});

	it("unarchives an archived item on the Unarchive action", async () => {
		const user = userEvent.setup();
		mocks.fetchArchiveItems.mockResolvedValue({
			items: [
				{
					...item,
					archivedAt: "2026-08-01T12:00:00.000Z",
				},
			],
			total: 1,
			hasMore: false,
		});
		renderPage();
		// Switch to the archived view so the archived item shows (the default
		// view filters archived items out).
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		// The archived card appends an "Archived" chip to the title's accessible
		// name, so match by substring.
		await screen.findByRole("button", { name: /Deep learning paper/ });

		await user.click(screen.getByRole("button", { name: "Unarchive" }));

		expect(mocks.patchArchiveItem).toHaveBeenCalledWith("item-1", {
			archived: false,
		});
	});

	it("permanently deletes an archived item only after confirmation (v1.8.0)", async () => {
		const user = userEvent.setup();
		mocks.fetchArchiveItems.mockResolvedValue({
			items: [
				{
					...item,
					archivedAt: "2026-08-01T12:00:00.000Z",
				},
			],
			total: 1,
			hasMore: false,
		});
		renderPage();
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		await screen.findByRole("button", { name: /Deep learning paper/ });

		// The Delete action only exists on archived items.
		await user.click(
			screen.getByRole("button", { name: "Delete permanently" }),
		);

		// The confirm dialog gates the irreversible call (R-A12/R-A10).
		const dialog = await screen.findByRole("alertdialog");
		expect(mocks.deleteArchiveItem).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));

		expect(mocks.deleteArchiveItem).toHaveBeenCalledWith("item-1");
	});

	it("no longer embeds the collections tree", async () => {
		renderPage();
		await screen.findByRole("button", { name: "Deep learning paper" });

		// The explorer's "New category" control belongs to the Collections page.
		expect(
			screen.queryByRole("button", { name: "New category" }),
		).not.toBeInTheDocument();
	});

	it("renders the sub-page navigation with the current section active", async () => {
		renderPage();
		await screen.findByRole("button", { name: "Deep learning paper" });

		// One segmented row: Items · Collections · Bookmarks · Search · Trash.
		const nav = screen.getByRole("navigation", { name: "Archive sections" });
		for (const label of [
			"Items",
			"Collections",
			"Bookmarks",
			"Search",
			"Trash",
		]) {
			expect(
				within(nav).getByRole("link", { name: label }),
			).toBeInTheDocument();
		}
		// On /archive the "Items" pill carries the you-are-here signal; the
		// siblings don't.
		expect(within(nav).getByRole("link", { name: "Items" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			within(nav).getByRole("link", { name: "Collections" }),
		).not.toHaveAttribute("aria-current");
	});

	it("opens the Collections page from the header navigation", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Deep learning paper" });
		await user.click(screen.getByRole("link", { name: "Collections" }));

		expect(screen.getByText("COLLECTIONS PAGE")).toBeInTheDocument();
	});

	it("the 'How it works' help button opens the docs section", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Deep learning paper" });
		await user.click(screen.getByRole("button", { name: "How it works" }));

		expect(screen.getByText("DOCS PAGE")).toBeInTheDocument();
	});
});
