import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { StoryViewHistory } from "./StoryViewHistory.js";

const mocks = vi.hoisted(() => ({
	fetchStoryViews: vi.fn(),
}));

vi.mock("./story-views-api.js", () => ({
	fetchStoryViews: mocks.fetchStoryViews,
}));

function renderHistory() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/brief"]}>
				<Routes>
					<Route path="/brief" element={<StoryViewHistory />} />
					<Route path="/articles/:id" element={<div>article page</div>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchStoryViews.mockResolvedValue({ views: [] });
});

describe("StoryViewHistory — Brief History tab (v1.8.0)", () => {
	it("shows an empty state when nothing has been opened yet", async () => {
		renderHistory();
		expect(
			await screen.findByText(/stories you open will show here/i),
		).toBeInTheDocument();
	});

	it("lists each viewed story with its scope badge", async () => {
		mocks.fetchStoryViews.mockResolvedValue({
			views: [
				{
					id: 1,
					articleId: "art-1",
					articleTitle: "Story One",
					scope: "both",
					viewedAt: "2026-08-01T10:00:00.000Z",
				},
				{
					id: 2,
					articleId: "art-2",
					articleTitle: "Story Two",
					scope: "insight",
					viewedAt: "2026-08-01T09:00:00.000Z",
				},
				{
					id: 3,
					articleId: "art-3",
					articleTitle: "Story Three",
					scope: "article",
					viewedAt: "2026-08-01T08:00:00.000Z",
				},
			],
		});
		renderHistory();

		expect(await screen.findByText("Story One")).toBeInTheDocument();
		expect(screen.getByText("Story Two")).toBeInTheDocument();
		expect(screen.getByText("Story Three")).toBeInTheDocument();
		// Scope badges: insight / article / both.
		expect(screen.getByText("Insight")).toBeInTheDocument();
		expect(screen.getByText("Article")).toBeInTheDocument();
		expect(screen.getByText("Insight + article")).toBeInTheDocument();
	});

	it("navigates to the story when a row is clicked", async () => {
		mocks.fetchStoryViews.mockResolvedValue({
			views: [
				{
					id: 1,
					articleId: "art-9",
					articleTitle: "Clickable Story",
					scope: "article",
					viewedAt: "2026-08-01T10:00:00.000Z",
				},
			],
		});
		const user = userEvent.setup();
		renderHistory();

		await user.click(await screen.findByText("Clickable Story"));
		expect(await screen.findByText("article page")).toBeInTheDocument();
	});
});
