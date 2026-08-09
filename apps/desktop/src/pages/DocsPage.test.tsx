import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { DocsPage } from "@/pages/DocsPage.js";

// The docs data is real; the plugin hooks are stubbed to contribute one section.
const mocks = vi.hoisted(() => ({
	usePluginDocsSections: vi.fn(),
}));

vi.mock("@/plugins/plugin-hooks.js", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		usePluginDocsSections: mocks.usePluginDocsSections,
	};
});

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/docs"]}>
				<DocsPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("DocsPage — plugin-contributed sections (v1.9.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.usePluginDocsSections.mockReturnValue([]);
	});

	it("renders a plugin docs section alongside the built-in guides", async () => {
		mocks.usePluginDocsSections.mockReturnValue([
			{
				id: "reference",
				title: "Reference Plugin",
				summary: "A plugin guide.",
				icon: "extension",
				blocks: [
					{ type: "paragraph", text: "This is the plugin's own guide." },
				],
			},
		]);
		renderPage();

		expect(await screen.findByText("Reference Plugin")).toBeInTheDocument();
		expect(
			screen.getByText("This is the plugin's own guide."),
		).toBeInTheDocument();
	});

	it("renders no plugin section when none are contributed", () => {
		renderPage();
		expect(screen.queryByText("Reference Plugin")).not.toBeInTheDocument();
	});
});
