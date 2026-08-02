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
}));

vi.mock("@/features/archive/archive-api.js", () => mocks);

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
		for (const label of ["Items", "Collections", "Bookmarks", "Search", "Trash"]) {
			expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
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
