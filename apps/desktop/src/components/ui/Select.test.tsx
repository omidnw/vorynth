import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select, type SelectOption } from "./Select.js";

// The 10 bundled UI languages, labeled the way the app labels them:
// native name — English name (code).
const LANG_OPTIONS: SelectOption[] = [
	{ value: "en", label: "English — English (en)", icon: "translate" },
	{ value: "fa", label: "فارسی — Persian (fa)", icon: "translate" },
	{ value: "ar", label: "العربية — Arabic (ar)", icon: "translate" },
	{ value: "ko", label: "한국어 — Korean (ko)", icon: "translate" },
	{ value: "ja", label: "日本語 — Japanese (ja)", icon: "translate" },
	{ value: "zh", label: "中文 — Chinese (zh)", icon: "translate" },
	{ value: "he", label: "עברית — Hebrew (he)", icon: "translate" },
	{ value: "es", label: "Español — Spanish (es)", icon: "translate" },
	{ value: "de", label: "Deutsch — German (de)", icon: "translate" },
	{ value: "ru", label: "Русский — Russian (ru)", icon: "translate" },
];

function renderSelect(options: Partial<ComponentProps<typeof Select>> = {}) {
	const onChange = vi.fn();
	render(
		<Select
			value="en"
			onChange={onChange}
			options={LANG_OPTIONS}
			aria-label="Language"
			searchable
			searchPlaceholder="Search languages…"
			noResultsLabel="No matches"
			{...options}
		/>,
	);
	return { onChange };
}

describe("Select — non-searchable (existing behavior)", () => {
	it("opens on click and selects an option by click", async () => {
		const user = userEvent.setup();
		const { onChange } = renderSelect({ searchable: false });
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.click(screen.getByText("日本語 — Japanese (ja)"));
		expect(onChange).toHaveBeenCalledWith("ja");
	});

	it("marks the active option with a check", async () => {
		const user = userEvent.setup();
		renderSelect({ searchable: false });
		await user.click(screen.getByRole("button", { name: "Language" }));
		expect(
			screen.getByRole("option", { name: "English — English (en)" }),
		).toHaveAttribute("aria-selected", "true");
	});
});

describe("Select — searchable language picker", () => {
	it("filters by the English name", async () => {
		const user = userEvent.setup();
		renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(
			screen.getByPlaceholderText("Search languages…"),
			"Persian",
		);
		expect(screen.getByText("فارسی — Persian (fa)")).toBeInTheDocument();
		expect(
			screen.queryByText("日本語 — Japanese (ja)"),
		).not.toBeInTheDocument();
	});

	it("filters by the native name", async () => {
		const user = userEvent.setup();
		renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(screen.getByPlaceholderText("Search languages…"), "فارسی");
		expect(screen.getByText("فارسی — Persian (fa)")).toBeInTheDocument();
		expect(
			screen.queryByText("日本語 — Japanese (ja)"),
		).not.toBeInTheDocument();
	});

	it("filters by the code", async () => {
		const user = userEvent.setup();
		renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(screen.getByPlaceholderText("Search languages…"), "ja");
		expect(
			screen.getByRole("option", { name: "日本語 — Japanese (ja)" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "English — English (en)" }),
		).not.toBeInTheDocument();
	});

	it("shows the no-results row when nothing matches", async () => {
		const user = userEvent.setup();
		renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(screen.getByPlaceholderText("Search languages…"), "zzz");
		expect(screen.getByText("No matches")).toBeInTheDocument();
	});

	it("selects the single filtered match on Enter", async () => {
		const user = userEvent.setup();
		const { onChange } = renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		const search = screen.getByPlaceholderText("Search languages…");
		await user.type(search, "Japanese");
		await user.keyboard("{Enter}");
		expect(onChange).toHaveBeenCalledWith("ja");
	});

	it("closes on Escape and resets the query", async () => {
		const user = userEvent.setup();
		renderSelect();
		await user.click(screen.getByRole("button", { name: "Language" }));
		await user.type(
			screen.getByPlaceholderText("Search languages…"),
			"Persian",
		);
		await user.keyboard("{Escape}");
		expect(
			screen.queryByPlaceholderText("Search languages…"),
		).not.toBeInTheDocument();
		// Re-opening shows the full list again — the query was reset.
		await user.click(screen.getByRole("button", { name: "Language" }));
		expect(screen.getByText("日本語 — Japanese (ja)")).toBeInTheDocument();
	});
});
