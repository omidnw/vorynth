import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { AdvancedSection } from "@/features/settings/AdvancedSection.js";

// API layer mocked; the section (toggle) is real.
const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

function renderSection() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdvancedSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchSettings.mockResolvedValue({});
	mocks.patchSettings.mockResolvedValue({});
});

describe("AdvancedSection — show advanced features (v1.8.0)", () => {
	it("defaults to off — the Plugins page stays hidden until explicitly revealed", async () => {
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Show advanced features",
		});
		expect(toggle).toHaveAttribute("aria-checked", "false");
	});

	it("reflects the persisted (on) state from settings", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.showAdvancedFeatures": true });
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Show advanced features",
		});
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
	});

	it("persists the toggle via PATCH /settings", async () => {
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Show advanced features",
		});
		await user.click(toggle);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.showAdvancedFeatures": true,
		});
	});
});
