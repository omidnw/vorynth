import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { DataHealthSection } from "@/features/settings/DataHealthSection.js";

// API + jobs layers mocked; the section (toggle + run button) is real.
const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
	startHealthCheck: vi.fn(),
	isActive: vi.fn(() => false),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

vi.mock("@/features/jobs/jobs-store.js", () => ({
	useJobsStore: (selector: (s: unknown) => unknown) =>
		selector({
			isActive: mocks.isActive,
			startHealthCheck: mocks.startHealthCheck,
		}),
}));

function renderSection() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<DataHealthSection />
		</QueryClientProvider>,
	);
}

describe("DataHealthSection — data health check (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSettings.mockResolvedValue({});
		mocks.patchSettings.mockResolvedValue({});
		mocks.isActive.mockReturnValue(false);
		mocks.startHealthCheck.mockResolvedValue({ id: "job-1" });
	});

	it("enables the automatic daily check by default", async () => {
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Automatic daily check",
		});
		expect(toggle).toHaveAttribute("aria-checked", "true");
	});

	it("persists the toggle off via PATCH /settings", async () => {
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Automatic daily check",
		});
		await user.click(toggle);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"dataHealth.autoCheck": false,
		});
	});

	it("starts the health-check job from the run button (with confirmation)", async () => {
		const user = userEvent.setup();
		renderSection();
		const run = await screen.findByRole("button", {
			name: "Run data check now",
		});
		await user.click(run);
		// The confirmation dialog explains the token use; confirm to start.
		const dialog = screen.getByRole("alertdialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Run data check now" }),
		);
		expect(mocks.startHealthCheck).toHaveBeenCalledTimes(1);
	});
});
