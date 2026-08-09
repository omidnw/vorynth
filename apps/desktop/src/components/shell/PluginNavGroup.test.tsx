import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { PluginInfo } from "@vorynth/types";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { PluginNavGroup } from "@/components/shell/PluginNavGroup.js";
import { usePluginContributions } from "@/plugins/plugin-contributions.js";

// API layer mocked; the nav group + contribution store are real.
const mocks = vi.hoisted(() => ({
	fetchPlugins: vi.fn(),
}));

vi.mock("@/features/plugins/plugins-api.js", () => mocks);

const enabledPlugin: PluginInfo = {
	id: "reference",
	name: "Reference Plugin",
	description: "A built-in example of a runtime UI plugin.",
	version: "1.8.0",
	kind: "ui",
	type: "reference",
	adapter: "reference",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
};

function registerReferencePlugin() {
	usePluginContributions.getState().register({
		id: "reference",
		name: "Reference Plugin",
		version: "1.8.0",
		exports: {
			navItems: [{ id: "reference", label: "Reference", icon: "extension" }],
		},
	});
}

function renderNav() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter>
				<PluginNavGroup />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

/**
 * The flaky-nav regression: PluginNavGroup used to read the contribution store
 * once at render time without subscribing, so a plugin bundle that registered
 * AFTER the first paint (or after the plugins query resolved) never appeared —
 * the item flickered in/out across page refreshes depending on load order.
 * These tests pin the subscription behavior: a late-registering plugin must
 * always render, and a plugin the engine reports as disabled must never.
 */
describe("PluginNavGroup — contribution store subscription", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usePluginContributions.setState({ loaded: {} });
	});

	it("renders a plugin's nav item when it registers after first paint", async () => {
		mocks.fetchPlugins.mockResolvedValue([enabledPlugin]);
		renderNav();

		// Nothing registered yet → no item.
		expect(screen.queryByText("Reference")).not.toBeInTheDocument();

		// The host registers the bundle after mount (late load).
		registerReferencePlugin();

		// The store subscription re-renders the group → the item appears.
		expect(await screen.findByText("Reference")).toBeInTheDocument();
	});

	it("never renders nav items for plugins the engine reports as disabled", async () => {
		// The query stays pending while the bundle registers.
		let resolveFetch!: (v: PluginInfo[]) => void;
		mocks.fetchPlugins.mockReturnValue(
			new Promise<PluginInfo[]>((resolve) => {
				resolveFetch = resolve;
			}),
		);
		renderNav();
		registerReferencePlugin();

		// Engine resolves: reference is disabled → gated out of the sidebar.
		resolveFetch([
			{ ...enabledPlugin, enabled: false, effectiveEnabled: false },
		]);
		await waitFor(() =>
			expect(screen.queryByText("Reference")).not.toBeInTheDocument(),
		);
	});
});
