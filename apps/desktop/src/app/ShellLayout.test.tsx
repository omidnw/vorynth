import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/i18n"; // register the react-i18next instance (bundled catalogs)
import { ShellLayout } from "@/app/ShellLayout.js";

// Heavy/live children stubbed out — this test pins the sidebar gating, not the
// tray/drawer/nav-group content.
vi.mock("@/features/jobs/JobsTray.js", () => ({ JobsTray: () => null }));
vi.mock("@/features/history/HistoryDrawer.js", () => ({
	HistoryDrawer: () => null,
}));
vi.mock("@/components/shell/ThemeToggle.js", () => ({
	ThemeToggle: () => null,
}));
vi.mock("@/components/shell/PluginNavGroup.js", () => ({
	PluginNavGroup: () => null,
}));
vi.mock("@/components/shell/DocsNavGroup.js", () => ({
	DocsNavGroup: () => null,
}));
vi.mock("@/components/shell/ArchiveNavGroup.js", () => ({
	ArchiveNavGroup: () => null,
}));

const mocks = vi.hoisted(() => ({
	fetchProfile: vi.fn(),
	fetchSettings: vi.fn(),
}));

vi.mock("@/features/profile/profile-api.js", () => ({
	fetchProfile: mocks.fetchProfile,
}));
vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
}));

function renderShell() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/brief"]}>
				<Routes>
					<Route element={<ShellLayout />}>
						<Route path="/brief" element={<div>BRIEF</div>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchProfile.mockResolvedValue({});
	mocks.fetchSettings.mockResolvedValue({});
});

afterEach(async () => {
	cleanup();
	// The language-switch test flips the shared i18n instance — put it back.
	await i18n.changeLanguage("en");
});

describe("ShellLayout — Plugins nav gated behind advanced features (v1.8.0)", () => {
	it("hides the Plugins sidebar item when 'Show advanced features' is off", async () => {
		renderShell();
		// Wait for the layout (profile query) to settle, then assert the
		// advanced surface is absent while regular nav is present.
		expect(await screen.findByText("Sources")).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /Plugins/ }),
		).not.toBeInTheDocument();
	});

	it("shows the Plugins sidebar item when the setting is on", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.showAdvancedFeatures": true });
		renderShell();
		// The shared nav item renders both an <a> and an inner div role="link",
		// so there are two matches — at least one must exist.
		const links = await screen.findAllByRole("link", { name: /Plugins/ });
		expect(links.length).toBeGreaterThan(0);
	});
});

describe("ShellLayout — sidebar labels follow the UI language (v1.8.0)", () => {
	it("translates the nav labels when the language changes", async () => {
		await i18n.changeLanguage("fa");
		renderShell();
		// Today's Brief → خلاصهٔ امروز, Sources → منابع, Local User fallback → کاربر محلی.
		expect(await screen.findByText("خلاصهٔ امروز")).toBeInTheDocument();
		expect(screen.getByText("منابع")).toBeInTheDocument();
		expect(screen.getByText("کاربر محلی")).toBeInTheDocument();
		expect(screen.queryByText("Sources")).not.toBeInTheDocument();
	});
});
