import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ArchiveItem, Collection } from "@vorynth/types";
import { CollectionsPage } from "@/pages/CollectionsPage.js";
import { useArchiveUiStore } from "@/features/archive/archive-ui-store.js";

// The archive API layer is mocked; the page, icon grid, and dialogs are real.
const mocks = vi.hoisted(() => ({
	fetchCollections: vi.fn(),
	fetchArchiveItems: vi.fn(),
	patchArchiveItem: vi.fn(),
	createCollection: vi.fn(),
	updateCollection: vi.fn(),
	deleteCollection: vi.fn(),
}));

vi.mock("@/features/archive/archive-api.js", () => mocks);

const category: Collection = {
	id: "cat-1",
	name: "Research",
	description: null,
	parentId: null,
	kind: "category",
	llmGenerated: false,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
};
const folder: Collection = {
	id: "folder-1",
	name: "Papers",
	description: null,
	parentId: "cat-1",
	kind: "folder",
	llmGenerated: false,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
};
const item: ArchiveItem = {
	contentItemId: "item-1",
	contentType: "article",
	note: null,
	collectionId: "folder-1",
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
// A second item, owned directly by the category (Explorer: a category can hold
// its own items AND folders — each shows only what it owns).
const directItem: ArchiveItem = {
	contentItemId: "item-2",
	contentType: "article",
	note: null,
	collectionId: "cat-1",
	archivedAt: null,
	bookmarked: false,
	tags: [],
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
	title: "Research scratchpad",
	url: null,
	author: null,
	publishedAt: null,
	origin: { id: "article-2" },
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/archive/collections"]}>
				<Routes>
					<Route path="/archive/collections" element={<CollectionsPage />} />
					<Route path="/articles/:id" element={<div>ARTICLE READER</div>} />
					<Route path="/docs" element={<div>DOCS PAGE</div>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

/** Select the Research card (single-click) and wait for its items to load. */
async function selectResearch(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: "Research" }));
	await screen.findByRole("button", { name: "Research scratchpad" });
}

describe("CollectionsPage — Windows icon view", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useArchiveUiStore.setState({
			currentCollectionId: null,
			selectedCollectionId: null,
		});
		mocks.fetchCollections.mockResolvedValue({ items: [category, folder] });
		// The API mirrors the engine: `direct` returns only the collection's own
		// items; without a collectionId it returns everything (tree + add panel).
		mocks.fetchArchiveItems.mockImplementation(
			(params?: { collectionId?: string }) => {
				if (params?.collectionId === "cat-1") {
					return Promise.resolve({
						items: [directItem],
						total: 1,
						hasMore: false,
					});
				}
				if (params?.collectionId === "folder-1") {
					return Promise.resolve({
						items: [item],
						total: 1,
						hasMore: false,
					});
				}
				return Promise.resolve({
					items: [item, directItem],
					total: 2,
					hasMore: false,
				});
			},
		);
		mocks.patchArchiveItem.mockResolvedValue({ ...item, collectionId: null });
	});

	it("renders the top-level collections as folder cards", async () => {
		renderPage();

		// Root grid shows only root collections — "Papers" is nested inside
		// "Research", so it must not appear as a card yet.
		await screen.findByRole("button", { name: "Research" });
		expect(screen.queryByRole("button", { name: "Papers" })).not.toBeInTheDocument();
		// The card says what's inside at a glance — the sub-folder and both items
		// (the folder's item + the category's own).
		expect(screen.getByText("1 folder · 2 items")).toBeInTheDocument();
		expect(
			screen.getByText(/Click a folder to see everything inside it/),
		).toBeInTheDocument();
	});

	it("single-click lists only the category's own items (Explorer)", async () => {
		const user = userEvent.setup();
		renderPage();

		await selectResearch(user);

		// Breadcrumb shows the path to the selected folder.
		const breadcrumb = screen.getByLabelText("Breadcrumb");
		expect(within(breadcrumb).getByText("Research")).toBeInTheDocument();
		// The category lists ONLY its own item — the folder's item belongs to
		// the folder and must not leak into the parent's list.
		expect(
			screen.getByRole("button", { name: "Research scratchpad" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Deep learning paper" }),
		).not.toBeInTheDocument();
		// The query targets the folder directly (no subtree expansion).
		await waitFor(() => {
			expect(mocks.fetchArchiveItems).toHaveBeenCalledWith(
				expect.objectContaining({ collectionId: "cat-1", direct: true }),
			);
		});
	});

	it("double-click goes inside a folder — the grid moves in", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		await user.dblClick(screen.getByRole("button", { name: "Research" }));

		// Now "in" Research: its child "Papers" becomes a card, the header
		// offers "New folder", and the breadcrumb reflects the location.
		await screen.findByRole("button", { name: "Papers" });
		expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
		const breadcrumb = screen.getByLabelText("Breadcrumb");
		expect(within(breadcrumb).getByText("Research")).toBeInTheDocument();
		// Entering lists the folder's own items — the folder's item is not
		// here yet.
		expect(
			screen.getAllByRole("button", { name: "Research scratchpad" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByRole("button", { name: "Deep learning paper" }),
		).not.toBeInTheDocument();

		// Going inside Papers reveals its item.
		await user.dblClick(screen.getByRole("button", { name: "Papers" }));
		await screen.findByRole("button", { name: "Deep learning paper" });
	});

	it("⋯ menu renames a folder with an inline input", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		await user.click(screen.getByRole("button", { name: "Actions for Research" }));
		await user.click(screen.getByRole("menuitem", { name: "Rename" }));

		const input = screen.getByRole("textbox", { name: "Rename Research" });
		await user.clear(input);
		await user.type(input, "Machine Learning");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(mocks.updateCollection).toHaveBeenCalledWith("cat-1", {
				name: "Machine Learning",
			});
		});
	});

	it("⋯ menu moves a folder to the Trash only after confirmation", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		await user.click(screen.getByRole("button", { name: "Actions for Research" }));
		await user.click(screen.getByRole("menuitem", { name: "Delete" }));

		const dialog = screen.getByRole("alertdialog");
		expect(
			within(dialog).getByText('Move "Research" to Trash?'),
		).toBeInTheDocument();
		expect(mocks.deleteCollection).not.toHaveBeenCalled();

		await user.click(
			within(dialog).getByRole("button", { name: "Move to Trash" }),
		);
		await waitFor(() => {
			expect(mocks.deleteCollection).toHaveBeenCalledWith("cat-1");
		});
	});

	it("⋯ menu adds archive items into the folder", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		await user.click(screen.getByRole("button", { name: "Actions for Research" }));
		await user.click(screen.getByRole("menuitem", { name: "Add items" }));

		// The add-items panel opens; searching finds the archive item.
		expect(screen.getByText('Add items to "Research"')).toBeInTheDocument();
		await user.type(
			screen.getByRole("textbox", { name: "Search items" }),
			"deep",
		);
		await user.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() => {
			expect(mocks.patchArchiveItem).toHaveBeenCalledWith("item-1", {
				collectionId: "cat-1",
			});
		});
	});

	it("removes an item from its collection only after confirmation", async () => {
		const user = userEvent.setup();
		renderPage();

		await selectResearch(user);

		// The remove action stages a confirmation dialog — nothing is removed yet.
		await user.click(
			screen.getByRole("button", { name: "Remove from collection" }),
		);
		const dialog = screen.getByRole("alertdialog");
		expect(
			within(dialog).getByText('Remove from "Research"?'),
		).toBeInTheDocument();
		expect(mocks.patchArchiveItem).not.toHaveBeenCalled();

		// Confirming performs the removal (collectionId → null, item kept).
		await user.click(
			within(dialog).getByRole("button", { name: "Remove from collection" }),
		);
		await waitFor(() => {
			expect(mocks.patchArchiveItem).toHaveBeenCalledWith("item-2", {
				collectionId: null,
			});
		});
	});

	it("opens an item's detail page", async () => {
		const user = userEvent.setup();
		renderPage();

		await selectResearch(user);

		await user.click(
			screen.getByRole("button", { name: "Research scratchpad" }),
		);
		expect(screen.getByText("ARTICLE READER")).toBeInTheDocument();
	});

	it("creates a new category from the grid's + tile", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "New category" });
		// Wait for the queries to settle — the tile node is re-created by a later
		// async resolution, so clicking the stale reference misses the handler.
		await screen.findByText(/Click a folder to see everything inside it/);
		await user.click(screen.getByRole("button", { name: "New category" }));

		// The create form opens — at the root the kind is a category.
		const input = screen.getByRole("textbox", { name: "Collection name" });
		await user.type(input, "Deep Learning");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(mocks.createCollection).toHaveBeenCalledWith({
				name: "Deep Learning",
				kind: "category",
				parentId: undefined,
			});
		});
	});

	it("adds items to the folder you're inside via the items-area button", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		await user.dblClick(screen.getByRole("button", { name: "Research" }));
		await screen.findByRole("button", { name: "Papers" });

		// Inside Research, the items-area header offers "Add items" for it.
		await user.click(screen.getByRole("button", { name: "Add items" }));
		expect(screen.getByText('Add items to "Research"')).toBeInTheDocument();

		await user.type(
			screen.getByRole("textbox", { name: "Search items" }),
			"deep",
		);
		await user.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() => {
			expect(mocks.patchArchiveItem).toHaveBeenCalledWith("item-1", {
				collectionId: "cat-1",
			});
		});
	});

	it("the 'How it works' help button opens the docs section", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("button", { name: "Research" });
		// One predictable docs entry point in the header (icon-only + aria-label).
		await user.click(
			screen.getByRole("button", { name: "How it works" }),
		);
		expect(screen.getByText("DOCS PAGE")).toBeInTheDocument();
	});
});
