import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type * as ReactRouter from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { OnboardingPage } from "./OnboardingPage.js";

// useNavigate + the collect job are mocked; the onboarding state store is real
// (localStorage), so tests assert the actual persisted outcome.
const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	startCollect: vi.fn(),
	saveProvider: vi.fn(),
	patchSettings: vi.fn(),
	patchProfile: vi.fn(),
	fetchSettings: vi.fn(),
	fetchProfile: vi.fn(),
	disableSourceList: vi.fn(),
	fetchSourceListSources: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof ReactRouter>("react-router-dom");
	return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/features/jobs/jobs-store.js", () => ({
	useJobsStore: () => ({ startCollect: mocks.startCollect }),
}));
vi.mock("@/features/llm/llm-api.js", () => ({
	saveProvider: mocks.saveProvider,
}));
vi.mock("@/features/history/history-api.js", () => ({
	patchSettings: mocks.patchSettings,
	fetchSettings: mocks.fetchSettings,
}));
vi.mock("@/features/profile/profile-api.js", () => ({
	patchProfile: mocks.patchProfile,
	fetchProfile: mocks.fetchProfile,
}));
vi.mock("@/features/sources/sources-api.js", () => ({
	disableSourceList: mocks.disableSourceList,
	fetchSourceListSources: mocks.fetchSourceListSources,
}));

beforeEach(() => {
	// v1.8.1 — the flow drafts its step + choices to sessionStorage; clear it
	// so one test's place never leaks into the next render.
	localStorage.clear();
	sessionStorage.clear();
	mocks.navigate.mockClear();
	mocks.startCollect.mockReset();
	mocks.startCollect.mockResolvedValue(undefined);
	mocks.saveProvider.mockReset();
	mocks.saveProvider.mockResolvedValue({ id: "prov-1" });
	mocks.patchSettings.mockReset();
	mocks.patchSettings.mockResolvedValue({});
	mocks.patchProfile.mockReset();
	mocks.patchProfile.mockResolvedValue({});
	mocks.fetchSettings.mockResolvedValue({});
	mocks.fetchProfile.mockResolvedValue({
		topics: [],
		preferredUiLanguage: "en",
		preferredIntelligenceLanguage: "en",
	});
	mocks.disableSourceList.mockReset();
	mocks.disableSourceList.mockResolvedValue({ id: "developer" });
	mocks.fetchSourceListSources.mockReset();
	mocks.fetchSourceListSources.mockResolvedValue([
		{
			id: "src-openai",
			name: "OpenAI Blog",
			url: "https://openai.com/blog",
			category: "ai",
			adapter: "rss",
			enabled: true,
		},
	]);
});

function renderPage() {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<OnboardingPage />
		</QueryClientProvider>,
	);
}

// Helper: walk from the welcome step to the topics step.
async function toTopics(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Get Started" }));
}

// Helper: pick a topic on the topics step and continue to the provider step.
async function toProvider(user: ReturnType<typeof userEvent.setup>) {
	await toTopics(user);
	await user.click(screen.getByRole("button", { name: /^ai$/i }));
	await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("OnboardingPage", () => {
	it("shows the skip button from the first step", () => {
		renderPage();
		expect(
			screen.getByRole("button", { name: "Skip setup" }),
		).toBeInTheDocument();
	});

	it("skip applies defaults, marks the flow skipped, and enters the app", async () => {
		const user = userEvent.setup();
		renderPage();
		await user.click(screen.getByRole("button", { name: "Skip setup" }));
		expect(localStorage.getItem("vorynth.onboarding")).toBe("skipped");
		expect(mocks.navigate).toHaveBeenCalledWith("/brief");
		// Skipping never kicks off a collection.
		expect(mocks.startCollect).not.toHaveBeenCalled();
	});

	it("walks through the topics step and saves category tastes", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);

		// Topics step comes SECOND now — pick two chips and continue.
		await user.click(screen.getByRole("button", { name: /^ai$/i }));
		await user.click(screen.getByRole("button", { name: /^security$/i }));
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(mocks.patchProfile).toHaveBeenCalledWith({
			topics: ["ai", "security"],
		});
		// Continue lands on the (third) provider step — its grid is visible.
		expect(
			screen.getByRole("button", { name: /anthropic/i }),
		).toBeInTheDocument();
	});

	it("saves the chosen provider + key on Continue and switches to Intelligence mode", async () => {
		const user = userEvent.setup();
		renderPage();
		await toProvider(user);

		// Provider grid includes anthropic alongside the others.
		expect(
			screen.getByRole("button", { name: /anthropic/i }),
		).toBeInTheDocument();
		// The explanation comes BEFORE the ask — the modes title is visible.
		expect(
			screen.getByText("News mode vs. Intelligence mode"),
		).toBeInTheDocument();

		// OpenAI is selected by default — type a key and model, then continue.
		await user.type(screen.getByPlaceholderText("sk-..."), "sk-test-123");
		// v1.9.0 — the model name is required for a real provider. Its
		// placeholder is an example ("e.g. gpt-4o-mini"), never a preselected value.
		await user.type(screen.getByPlaceholderText(/gpt-4o-mini/), "gpt-4o-mini");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(mocks.saveProvider).toHaveBeenCalledTimes(1);
		expect(mocks.saveProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "openai",
				apiKey: "sk-test-123",
				defaultModel: "gpt-4o-mini",
				enabled: true,
			}),
		);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"engine.mode": "intelligence",
		});
	});

	it("blocks Continue when a real provider has no model name (v1.9.0)", async () => {
		const user = userEvent.setup();
		renderPage();
		await toProvider(user);

		// OpenAI is selected by default — Continue with NO model is blocked.
		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(
			screen.getByText("Enter the model name to continue."),
		).toBeInTheDocument();
		expect(mocks.saveProvider).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();

		// The provider step stays put; typing a model unblocks it.
		await user.type(screen.getByPlaceholderText(/gpt-4o-mini/), "gpt-4o-mini");
		expect(
			screen.queryByText("Enter the model name to continue."),
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(mocks.saveProvider).toHaveBeenCalledTimes(1);
	});

	it("skip stays model-free and never saves a provider", async () => {
		const user = userEvent.setup();
		renderPage();
		await toProvider(user);

		await user.click(screen.getByRole("button", { name: /skip for now/i }));
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(mocks.saveProvider).not.toHaveBeenCalled();
		expect(mocks.patchSettings).not.toHaveBeenCalled();
	});

	it("turning off official sources on the topics step disables the developer list", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);

		const toggle = screen.getByRole("switch", {
			name: "Keep official sources enabled",
		});
		expect(toggle).toHaveAttribute("aria-checked", "true");
		await user.click(toggle);
		await user.click(screen.getByRole("button", { name: /^ai$/i }));
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(mocks.disableSourceList).toHaveBeenCalledWith("developer");
	});

	it("turning off official sources with NO topics proceeds without asking (v1.8.1)", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);

		await user.click(
			screen.getByRole("switch", { name: "Keep official sources enabled" }),
		);
		await user.click(screen.getByRole("button", { name: "Continue" }));

		// The user already chose — no "are you sure" tip, never re-asked.
		expect(screen.queryByText(/No topics selected/)).not.toBeInTheDocument();
		expect(mocks.disableSourceList).toHaveBeenCalledWith("developer");
		expect(mocks.patchProfile).toHaveBeenCalledWith({ topics: [] });
		// Advances straight to the provider step.
		expect(
			screen.getByRole("button", { name: /skip for now/i }),
		).toBeInTheDocument();
	});

	it("a second Continue past the empty-topics tip keeps official sources (v1.8.1)", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);

		// First Continue with nothing selected: the tip appears (once).
		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText(/No topics selected/)).toBeInTheDocument();

		// Second Continue: the default stands — keep official sources, proceed.
		// (This used to do nothing, leaving the user stuck on the step.)
		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(mocks.disableSourceList).not.toHaveBeenCalled();
		expect(mocks.patchProfile).toHaveBeenCalledWith({ topics: [] });
		expect(
			screen.getByRole("button", { name: /skip for now/i }),
		).toBeInTheDocument();
	});

	it("view official sources opens the sources preview modal (v1.8.1)", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);

		await user.click(
			screen.getByRole("button", { name: "View official sources" }),
		);
		expect(mocks.fetchSourceListSources).toHaveBeenCalledWith("developer");
		expect(await screen.findByText("OpenAI Blog")).toBeInTheDocument();
	});

	it("completing the flow marks it done and enters the app", async () => {
		const user = userEvent.setup();
		renderPage();
		await toTopics(user);
		await user.click(screen.getByRole("button", { name: "Continue" }));
		// No topics picked → the official-sources tip appears; keep them.
		await user.click(
			screen.getByRole("button", { name: "Keep official sources" }),
		);
		// Provider step: skip AI.
		await user.click(screen.getByRole("button", { name: /skip for now/i }));
		await user.click(screen.getByRole("button", { name: "Continue" }));
		await user.click(
			screen.getByRole("button", { name: "Start my first brief" }),
		);
		expect(mocks.startCollect).toHaveBeenCalled();
		expect(localStorage.getItem("vorynth.onboarding")).toBe("done");
		expect(mocks.navigate).toHaveBeenCalledWith("/brief");
	});

	it("reflects and persists the chosen AI output language on the welcome step", async () => {
		const user = userEvent.setup();
		renderPage();
		const aiSelect = screen.getByRole("button", {
			name: "AI output language",
		});
		// Defaults to English (the "en" option label).
		expect(aiSelect).toHaveTextContent(/English/);

		// Picking Persian must update the select's own display — it used to
		// snap back to English (v1.8.0: value was hardcoded). Click the
		// option's label (inside the option button) — clicking the <li> row
		// itself would bypass the button (same pattern as LanguageSection).
		await user.click(aiSelect);
		await user.click(screen.getByText("فارسی — Persian"));
		expect(aiSelect).toHaveTextContent(/Persian/);
		expect(mocks.patchProfile).toHaveBeenCalledWith({
			preferredIntelligenceLanguage: "fa",
		});
	});
});
