import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { StorageSection } from "./StorageSection.js";
import type { UsageStats } from "@vorynth/types";

// API + shell mocked; the section (rendering + confirm flow) is real.
const mocks = vi.hoisted(() => ({
	fetchUsage: vi.fn(),
	clearStories: vi.fn(),
	purgeLocalMedia: vi.fn(),
	appInstallSize: vi.fn(),
	isTauriShell: vi.fn(),
}));

vi.mock("./usage-api.js", () => ({
	fetchUsage: mocks.fetchUsage,
	clearStories: mocks.clearStories,
	purgeLocalMedia: mocks.purgeLocalMedia,
}));

vi.mock("@/features/updater/updater-api.js", () => ({
	appInstallSize: mocks.appInstallSize,
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

const usage: UsageStats = {
	dataDir: "/data",
	totalBytes: 1024 + 512,
	libraries: [
		{ key: "database", bytes: 1024 },
		{ key: "media", bytes: 512, items: 2 },
		{ key: "backups", bytes: 256, items: 1 },
		{ key: "plugins", bytes: 128, items: 1 },
	],
	stories: { total: 42, contentBytes: 2048 },
	process: {
		rssBytes: 1_000_000_000,
		heapTotalBytes: 500_000_000,
		heapUsedBytes: 200_000_000,
		cpuPercent: 3.5,
		uptimeSeconds: 3600,
		startedAt: new Date().toISOString(),
	},
	system: {
		totalMemBytes: 16_000_000_000,
		freeMemBytes: 8_000_000_000,
		cpuModel: "Apple M1",
		cpuCores: 8,
	},
	measuredAt: new Date().toISOString(),
};

function renderSection() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<StorageSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.isTauriShell.mockReturnValue(false);
	mocks.appInstallSize.mockResolvedValue(null);
	mocks.fetchUsage.mockResolvedValue(usage);
	mocks.clearStories.mockResolvedValue({
		deleted: 40,
		keptBookmarked: 1,
		keptInCollections: 1,
		freedContentBytes: 2000,
	});
	mocks.purgeLocalMedia.mockResolvedValue({ purged: 2 });
});

describe("StorageSection (v1.8.0)", () => {
	it("renders the library breakdown with sizes", async () => {
		renderSection();
		expect(
			await screen.findByText("Database (stories & everything)"),
		).toBeTruthy();
		expect(screen.getByText("Media library")).toBeTruthy();
		expect(screen.getByText("Backups")).toBeTruthy();
		expect(screen.getByText("Plugins")).toBeTruthy();
		// 1024 bytes → "1.0 KB"; totals row shows the sum.
		expect(screen.getByText("1.0 KB")).toBeTruthy();
		expect(screen.getByText("Total data")).toBeTruthy();
		// Story count row.
		expect(screen.getByText("42 stories")).toBeTruthy();
	});

	it("hides the App row in development (no install footprint)", async () => {
		renderSection();
		await screen.findByText("Total data");
		expect(screen.queryByText("App")).toBeNull();
	});

	it("clearing stories goes through the warning dialog and recommends auto-delete", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(
			await screen.findByRole("button", { name: "Clear all stories" }),
		);

		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent(
			"Bookmarked stories and stories inside collections are always kept.",
		);
		expect(dialog).toHaveTextContent("Not recommended");

		await user.click(
			screen.getByRole("button", { name: "Delete all stories" }),
		);
		await waitFor(() => expect(mocks.clearStories).toHaveBeenCalled());
	});

	it("clearing media goes through the confirmation dialog", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(
			await screen.findByRole("button", { name: "Clear media" }),
		);

		await screen.findByRole("alertdialog");
		await user.click(screen.getByRole("button", { name: "Delete media" }));
		await waitFor(() => expect(mocks.purgeLocalMedia).toHaveBeenCalled());
	});
});
