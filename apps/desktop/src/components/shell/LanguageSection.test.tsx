import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n, { useLocaleStore } from "@/i18n"; // instance + store (English catalog)
import { LanguageSection } from "./LanguageSection.js";

// The store and the i18n instance are module singletons — a test that selects
// a non-English locale flips BOTH, so each test starts from a clean slate.
beforeEach(async () => {
	window.localStorage.clear();
	useLocaleStore.setState(useLocaleStore.getInitialState());
	await i18n.changeLanguage("en");
});

function renderSection(onChange = vi.fn()) {
	render(<LanguageSection onLocaleChange={onChange} />);
	return { onChange };
}

const BUNDLED_LABELS = [
	"English — English (en)",
	"فارسی — Persian (fa)",
	"العربية — Arabic (ar)",
	"한국어 — Korean (ko)",
	"日本語 — Japanese (ja)",
	"中文 — Chinese (zh)",
	"עברית — Hebrew (he)",
	"Español — Spanish (es)",
	"Deutsch — German (de)",
	"Русский — Russian (ru)",
];

describe("LanguageSection — bundled languages", () => {
	it("renders the picker with the 10 bundled languages", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(screen.getByRole("button", { name: "Language" }));
		for (const label of BUNDLED_LABELS) {
			expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
		}
	});

	it("selecting a language activates it and reports the change", async () => {
		const user = userEvent.setup();
		const { onChange } = renderSection();
		await user.click(screen.getByRole("button", { name: "Language" }));
		// Click the option's label (inside the option button) — clicking the
		// option row itself would target the <li>, bypassing the button.
		await user.click(screen.getByText("فارسی — Persian (fa)"));
		expect(useLocaleStore.getState().active).toBe("fa");
		expect(onChange).toHaveBeenCalledWith("fa");
	});

	it("is searchable — typing the native name filters the list", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(screen.getByPlaceholderText("Search languages…"), "日本語");
		expect(
			screen.getByRole("option", { name: "日本語 — Japanese (ja)" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "English — English (en)" }),
		).not.toBeInTheDocument();
	});
});

describe("LanguageSection — import/export flow", () => {
	it("shows the export and import buttons", () => {
		renderSection();
		expect(
			screen.getByRole("button", { name: "Export English" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Import Catalog" }),
		).toBeInTheDocument();
	});

	it("lists an imported custom catalog and removes it", async () => {
		const user = userEvent.setup();
		renderSection();
		const file = new File(
			[JSON.stringify({ app: { name: "Vorynth" } })],
			"fr.json",
			{ type: "application/json" },
		);
		const input = document.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		await user.upload(input, file);

		await waitFor(() => {
			expect(
				useLocaleStore.getState().customLocales.map((l) => l.code),
			).toContain("fr");
		});
		// The imported label shows in the management list (and the closed picker).
		expect(screen.getAllByText("FR (imported)").length).toBeGreaterThan(0);

		// Removing needs the confirmation dialog's confirm button.
		await user.click(screen.getByRole("button", { name: "Remove" }));
		const dialog = screen.getByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Remove" }));
		await waitFor(() => {
			expect(
				useLocaleStore.getState().customLocales.map((l) => l.code),
			).not.toContain("fr");
		});
		expect(screen.queryByText("FR (imported)")).not.toBeInTheDocument();
	});
});
