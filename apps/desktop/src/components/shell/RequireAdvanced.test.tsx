import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { RequireAdvanced } from "@/components/shell/RequireAdvanced.js";

// API layer mocked; the guard (query + redirect) is real.
const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
}));

function renderGuard() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/plugins"]}>
				<Routes>
					<Route
						path="/plugins"
						element={
							<RequireAdvanced>
								<div>PLUGIN SURFACE</div>
							</RequireAdvanced>
						}
					/>
					<Route path="/" element={<div>HOME</div>} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchSettings.mockResolvedValue({});
});

describe("RequireAdvanced — the advanced-features route guard (v1.8.0)", () => {
	it("redirects home when 'Show advanced features' is off (the default)", async () => {
		renderGuard();
		expect(await screen.findByText("HOME")).toBeInTheDocument();
		expect(screen.queryByText("PLUGIN SURFACE")).not.toBeInTheDocument();
	});

	it("renders the protected surface when the setting is on", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.showAdvancedFeatures": true });
		renderGuard();
		expect(await screen.findByText("PLUGIN SURFACE")).toBeInTheDocument();
		expect(screen.queryByText("HOME")).not.toBeInTheDocument();
	});

	it("does not flash a redirect while settings load", async () => {
		// The query never resolves — the guard must stay silent, not redirect.
		mocks.fetchSettings.mockReturnValue(new Promise(() => {}));
		renderGuard();
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.queryByText("PLUGIN SURFACE")).not.toBeInTheDocument();
		expect(screen.queryByText("HOME")).not.toBeInTheDocument();
	});
});
