import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { SettingsPage } from "@/pages/SettingsPage.js";

// API + Tauri shell layers mocked; the page (categories, rail, search) is real.
const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
	fetchEngineStatus: vi.fn(),
	verifyLlm: vi.fn(),
	fetchProviders: vi.fn(),
	fetchMode: vi.fn(),
	fetchStatus: vi.fn(),
	saveProvider: vi.fn(),
	deleteProvider: vi.fn(),
	activateProvider: vi.fn(),
	setMode: vi.fn(),
	fetchNetworkInfo: vi.fn(),
	fetchUsage: vi.fn(),
	resetUsage: vi.fn(),
	exportBackup: vi.fn(),
	restoreBackup: vi.fn(),
	deleteAllData: vi.fn(),
	listBackups: vi.fn(),
	deleteBackup: vi.fn(),
	isTauriShell: vi.fn(() => false),
	invoke: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

vi.mock("@/features/brief/brief-api.js", () => ({
	fetchEngineStatus: mocks.fetchEngineStatus,
	verifyLlm: mocks.verifyLlm,
}));

vi.mock("@/features/llm/llm-api.js", () => ({
	fetchProviders: mocks.fetchProviders,
	fetchMode: mocks.fetchMode,
	fetchStatus: mocks.fetchStatus,
	saveProvider: mocks.saveProvider,
	deleteProvider: mocks.deleteProvider,
	activateProvider: mocks.activateProvider,
	setMode: mocks.setMode,
}));

vi.mock("@/features/llm/usage-api.js", () => ({
	fetchUsage: mocks.fetchUsage,
	resetUsage: mocks.resetUsage,
}));

vi.mock("@/features/network/network-api.js", () => ({
	fetchNetworkInfo: mocks.fetchNetworkInfo,
}));

vi.mock("@/features/backup/backup-api.js", () => ({
	exportBackup: mocks.exportBackup,
	restoreBackup: mocks.restoreBackup,
	deleteAllData: mocks.deleteAllData,
	listBackups: mocks.listBackups,
	deleteBackup: mocks.deleteBackup,
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

vi.mock("@tauri-apps/api/core", () => ({
	invoke: mocks.invoke,
}));

// No runtime UI plugins contribute settings sections in this test.
vi.mock("@/features/plugins/PluginSettingsSections.js", () => ({
	PluginSettingsSections: () => null,
}));

const EMPTY_USAGE = {
	totalRequests: 0,
	totalTokens: 0,
	promptTokens: 0,
	completionTokens: 0,
	failedRequests: 0,
	byOperation: {},
	byProvider: {},
	last30d: { requests: 0, tokens: 0 },
	windowStart: new Date(0).toISOString(),
};

function renderSettingsPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/settings"]}>
				<SettingsPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchSettings.mockResolvedValue({});
	mocks.patchSettings.mockResolvedValue({});
	mocks.fetchEngineStatus.mockResolvedValue({
		ready: true,
		version: "test",
		llm: { configured: false, providerKind: null, mode: "news" },
		sources: { total: 0, enabled: 0 },
		articles: { total: 0 },
	});
	mocks.verifyLlm.mockResolvedValue({ ok: true });
	mocks.fetchProviders.mockResolvedValue([]);
	mocks.fetchMode.mockResolvedValue({ mode: "news" });
	mocks.fetchStatus.mockResolvedValue({
		configured: false,
		providerKind: null,
		rateLimit: { capacity: 5, inFlight: 0, spacingMs: 12000 },
		unavailableReason: "not-configured",
	});
	mocks.fetchUsage.mockResolvedValue(EMPTY_USAGE);
	mocks.resetUsage.mockResolvedValue(undefined);
	mocks.saveProvider.mockResolvedValue({});
	mocks.deleteProvider.mockResolvedValue(undefined);
	mocks.activateProvider.mockResolvedValue(undefined);
	mocks.setMode.mockResolvedValue(undefined);
	mocks.fetchNetworkInfo.mockResolvedValue({
		accessMode: "local",
		allowedIps: [],
		host: "127.0.0.1",
		port: 34117,
		lanIps: [],
		backendUrl: "http://127.0.0.1:34117",
	});
	mocks.exportBackup.mockResolvedValue({
		path: "",
		sizeBytes: 0,
		createdAt: "",
	});
	mocks.restoreBackup.mockResolvedValue(undefined);
	mocks.deleteAllData.mockResolvedValue(undefined);
	mocks.listBackups.mockResolvedValue({ backups: [] });
	mocks.deleteBackup.mockResolvedValue(undefined);
	mocks.invoke.mockResolvedValue(undefined);
});

describe("SettingsPage — category rail + search (category chrome)", () => {
	it("renders the category rail with all five category labels", () => {
		const { container } = renderSettingsPage();
		// The rail and the narrow-screen chips row both render a button per
		// category (the rail is hidden below lg, chips above lg) — assert each
		// label is present in the navigation.
		const nav = container.querySelector("nav[aria-label='Settings']");
		expect(nav).not.toBeNull();
		for (const label of [
			"General",
			"Intelligence",
			"Data & Health",
			"Sources",
			"Plugins",
		]) {
			const buttons = within(nav as HTMLElement).getAllByRole("button", {
				name: label,
			});
			expect(buttons.length).toBeGreaterThan(0);
		}
		// And every category group heading is visible on first render.
		expect(
			screen.getByRole("heading", { name: "General" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Data & Health" }),
		).toBeInTheDocument();
	});

	it("sits the rail inside the settings page alongside the search box", () => {
		renderSettingsPage();
		expect(
			screen.getByRole("searchbox", { name: "Search settings…" }),
		).toBeInTheDocument();
	});

	it("filters categories when typing in the search box", async () => {
		const user = userEvent.setup();
		const { container } = renderSettingsPage();
		const input = screen.getByRole("searchbox", { name: "Search settings…" });
		await user.type(input, "retention");

		// "retention" matches only Data & Health; every other category hides.
		expect(container.querySelector("#settings-general")).toHaveClass("hidden");
		expect(container.querySelector("#settings-intelligence")).toHaveClass(
			"hidden",
		);
		expect(container.querySelector("#settings-sources")).toHaveClass("hidden");
		expect(container.querySelector("#settings-data")).not.toHaveClass("hidden");

		// The rail dims the categories with no matching sections.
		const dimmed = screen
			.getAllByRole("button", { name: "General" })
			.map((b) => b.className)
			.join(" ");
		expect(dimmed).toContain("opacity-40");
		const matched = screen
			.getAllByRole("button", { name: "Data & Health" })
			.map((b) => b.className)
			.join(" ");
		expect(matched).not.toContain("opacity-40");
	});

	it("shows the no-results line when nothing matches the query", async () => {
		const user = userEvent.setup();
		renderSettingsPage();
		const input = screen.getByRole("searchbox", { name: "Search settings…" });
		await user.type(input, "zzzz-no-such-setting");
		expect(screen.getByText("No matches")).toBeInTheDocument();
	});

	it("clearing the search box restores every category", async () => {
		const user = userEvent.setup();
		const { container } = renderSettingsPage();
		const input = screen.getByRole("searchbox", { name: "Search settings…" });
		await user.type(input, "retention");
		expect(container.querySelector("#settings-general")).toHaveClass("hidden");
		await user.clear(input);
		expect(container.querySelector("#settings-general")).not.toHaveClass(
			"hidden",
		);
	});
});

describe("SettingsPage — LLM provider form (v1.8.1)", () => {
	it("Ollama cloud shows the API key + ollama.com default and saves both", async () => {
		const user = userEvent.setup();
		renderSettingsPage();

		await user.click(screen.getByRole("button", { name: "Add Provider" }));
		await user.click(screen.getByRole("button", { name: "Ollama" }));

		// Local is the default mode — no API key field yet.
		expect(screen.queryByPlaceholderText("paste key…")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Cloud" }));

		// Cloud reveals the key field + defaults the base URL to ollama.com.
		const keyInput = screen.getByPlaceholderText("paste key…");
		await user.type(keyInput, "sk-ollama-cloud");
		expect(
			screen.getByPlaceholderText("https://ollama.com"),
		).toBeInTheDocument();

		// v1.9.0 — the model name is required; type it before saving. Its
		// placeholder is an example ("e.g. llama3.2"), never a preselected value.
		await user.type(screen.getByPlaceholderText(/llama3.2/), "llama3.3");
		await user.click(screen.getByRole("button", { name: "Save Provider" }));
		expect(mocks.saveProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "ollama",
				apiKey: "sk-ollama-cloud",
				baseUrl: "https://ollama.com",
				defaultModel: "llama3.3",
				enabled: true,
			}),
		);
	});

	it("Ollama local keeps the localhost default and stores no key", async () => {
		const user = userEvent.setup();
		renderSettingsPage();

		await user.click(screen.getByRole("button", { name: "Add Provider" }));
		await user.click(screen.getByRole("button", { name: "Ollama" }));
		// v1.9.0 — the model name is required; type it before saving.
		await user.type(screen.getByPlaceholderText(/llama3.2/), "llama3.3");
		await user.click(screen.getByRole("button", { name: "Save Provider" }));

		expect(mocks.saveProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "ollama",
				apiKey: undefined,
				baseUrl: "http://localhost:11434",
				defaultModel: "llama3.3",
			}),
		);
	});

	it("OpenAI shows the base URL field with the official-API hint", async () => {
		const user = userEvent.setup();
		renderSettingsPage();

		await user.click(screen.getByRole("button", { name: "Add Provider" }));
		await user.click(screen.getByRole("button", { name: "OpenAI" }));

		expect(
			screen.getByPlaceholderText("https://api.openai.com/v1"),
		).toBeInTheDocument();
		expect(screen.getByText(/official OpenAI API/i)).toBeInTheDocument();

		await user.type(screen.getByPlaceholderText("paste key…"), "sk-openai");
		// v1.9.0 — the model name is required; type it before saving.
		await user.type(screen.getByPlaceholderText(/gpt-4o-mini/), "gpt-4o-mini");
		await user.click(screen.getByRole("button", { name: "Save Provider" }));
		expect(mocks.saveProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "openai",
				apiKey: "sk-openai",
				baseUrl: undefined,
				defaultModel: "gpt-4o-mini",
			}),
		);
	});

	it("blocks saving a provider with an empty model name (v1.9.0)", async () => {
		const user = userEvent.setup();
		renderSettingsPage();

		await user.click(screen.getByRole("button", { name: "Add Provider" }));
		await user.click(screen.getByRole("button", { name: "Gemini" }));
		await user.click(screen.getByRole("button", { name: "Save Provider" }));

		// The inline error shows and nothing is persisted.
		expect(screen.getByText("Enter the model name.")).toBeInTheDocument();
		expect(mocks.saveProvider).not.toHaveBeenCalled();

		// Typing a model clears the error; the next Save goes through.
		await user.type(
			screen.getByPlaceholderText(/gemini-2.0-flash/),
			"gemini-2.0-flash",
		);
		expect(screen.queryByText("Enter the model name.")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Save Provider" }));
		expect(mocks.saveProvider).toHaveBeenCalledTimes(1);
	});

	it("advanced on reveals the Developer section with the backend URL", async () => {
		mocks.fetchSettings.mockResolvedValue({
			"ui.showAdvancedFeatures": true,
			"network.accessMode": "local",
			"network.allowedIps": "",
		});
		renderSettingsPage();

		expect(await screen.findByText("Developer")).toBeInTheDocument();
		expect(screen.getByText("Backend URL")).toBeInTheDocument();
		// v1.8.1 — the engine serves the app too, so the frontend URL is the
		// SAME http://ip:port address as the backend (not tauri://…).
		expect(screen.getAllByText("http://127.0.0.1:34117")).toHaveLength(2);
		expect(screen.getByText("Frontend URL")).toBeInTheDocument();
	});
});
