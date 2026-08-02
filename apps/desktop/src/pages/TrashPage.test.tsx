import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { TrashEntry } from "@vorynth/types";
import { TrashPage } from "@/pages/TrashPage.js";

// The API layer is mocked; the page, badges, and confirmation dialogs are real.
const mocks = vi.hoisted(() => ({
	fetchTrash: vi.fn(),
	restoreTrashEntry: vi.fn(),
	purgeTrashEntry: vi.fn(),
	emptyTrash: vi.fn(),
	fetchSettings: vi.fn(),
}));

vi.mock("@/features/trash/trash-api.js", () => mocks);
vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
}));

const collectionEntry: TrashEntry = {
	id: "cat-1",
	kind: "collection",
	name: "Research",
	deletedAt: "2026-08-01T00:00:00.000Z",
	subtitle: "Category · 2 sub-folders · 5 items",
	bookmarkedCount: 0,
};
const searchEntry: TrashEntry = {
	id: "search-1",
	kind: "search",
	name: "langgraph agents",
	deletedAt: "2026-08-02T00:00:00.000Z",
	bookmarkedCount: 1,
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/archive/trash"]}>
				<Routes>
					<Route path="/archive/trash" element={<TrashPage />} />
					<Route path="/docs" element={<div>DOCS</div>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("TrashPage — soft-deleted collections & history", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchTrash.mockResolvedValue({ items: [collectionEntry, searchEntry] });
		mocks.fetchSettings.mockResolvedValue({
			"trash.retentionValue": 7,
			"trash.retentionUnit": "days",
		});
		mocks.restoreTrashEntry.mockResolvedValue({ restored: true });
		mocks.purgeTrashEntry.mockResolvedValue({ removed: 1 });
		mocks.emptyTrash.mockResolvedValue({ removed: 2 });
	});

	it("lists trashed collections and history with their type badges", async () => {
		renderPage();

		expect(await screen.findByText("Research")).toBeInTheDocument();
		expect(screen.getByText("langgraph agents")).toBeInTheDocument();
		// Each entry wears its type on its sleeve (badge title — the nav row
		// also has a "Search" link, so scope by the badge's title attribute).
		expect(screen.getByText("Collection")).toBeInTheDocument();
		expect(screen.getByTitle("Type: Search")).toBeInTheDocument();
		expect(
			screen.getByText("Category · 2 sub-folders · 5 items"),
		).toBeInTheDocument();
		// The saved-item warning on the history entry.
		expect(screen.getByText("1 saved item")).toBeInTheDocument();
	});

	it("restores an entry with its kind and id", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByText("Research");
		await user.click(screen.getAllByRole("button", { name: "Restore" })[0]!);

		await waitFor(() => {
			expect(mocks.restoreTrashEntry).toHaveBeenCalledWith({
				kind: "collection",
				id: "cat-1",
			});
		});
	});

	it("deletes an entry forever only after confirmation, warning about saved items", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByText("langgraph agents");
		await user.click(screen.getAllByRole("button", { name: "Delete forever" })[1]!);

		const dialog = screen.getByRole("alertdialog");
		expect(
			within(dialog).getByText('Delete "langgraph agents" forever?'),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/1 saved item inside will be permanently removed/),
		).toBeInTheDocument();
		expect(mocks.purgeTrashEntry).not.toHaveBeenCalled();

		await user.click(
			within(dialog).getByRole("button", { name: "Delete forever" }),
		);
		await waitFor(() => {
			expect(mocks.purgeTrashEntry).toHaveBeenCalledWith({
				kind: "search",
				id: "search-1",
				force: true,
			});
		});
	});

	it("empties the trash after confirmation, warning about saved items", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByText("Research");
		await user.click(screen.getByRole("button", { name: "Empty trash" }));

		const dialog = screen.getByRole("alertdialog");
		expect(
			within(dialog).getByText(
				/1 saved item in the trash will be permanently removed too/,
			),
		).toBeInTheDocument();

		await user.click(
			within(dialog).getByRole("button", { name: "Empty trash" }),
		);
		await waitFor(() => {
			expect(mocks.emptyTrash).toHaveBeenCalledWith({ force: true });
		});
	});

	it("shows the retention hint from settings", async () => {
		renderPage();

		expect(
			await screen.findByText(/auto-deleted after 7 days/),
		).toBeInTheDocument();
	});
});
