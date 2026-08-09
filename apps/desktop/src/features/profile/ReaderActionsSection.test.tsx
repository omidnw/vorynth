import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // initializes i18next so t() resolves the bundled catalog
import { ReaderActionsSection } from "./ReaderActionsSection.js";

const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

function renderSection(pinned: string[]) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	mocks.fetchSettings.mockResolvedValue({ "ui.readerPinnedActions": pinned });
	return render(
		<QueryClientProvider client={queryClient}>
			<ReaderActionsSection />
		</QueryClientProvider>,
	);
}

/**
 * ReaderActionsSection (v1.8.0) — the bar is designed for five pinned actions;
 * pinning more shows a tip so the footer doesn't silently crowd.
 */
describe("ReaderActionsSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows the >5 tip when more than five actions are pinned", async () => {
		renderSection(["markRead", "save", "share", "back", "export", "recollect"]);
		expect(
			await screen.findByText(/designed for five actions/i),
		).toBeInTheDocument();
	});

	it("hides the tip when exactly five actions are pinned", async () => {
		renderSection(["markRead", "save", "share", "back", "export"]);
		// Wait for the settings query to resolve, then assert no tip.
		expect(await screen.findByText("Reader actions")).toBeInTheDocument();
		expect(
			screen.queryByText(/designed for five actions/i),
		).not.toBeInTheDocument();
	});
});
