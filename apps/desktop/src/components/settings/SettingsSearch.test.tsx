import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { SettingsSearch } from "./SettingsSearch.js";

function renderSearch(onSearch = vi.fn()) {
	const onChange = vi.fn();
	render(<SettingsSearch value="" onChange={onChange} onSearch={onSearch} />);
	return { onChange, onSearch };
}

describe("SettingsSearch — commit on Enter / button (v1.8.0)", () => {
	it("does NOT jump while typing — onChange fires, onSearch does not", async () => {
		const { onChange, onSearch } = renderSearch();
		const input = screen.getByRole("searchbox");
		await userEvent.type(input, "theme");
		expect(onChange).toHaveBeenCalled();
		expect(onSearch).not.toHaveBeenCalled();
	});

	it("commits the search on Enter", async () => {
		const { onSearch } = renderSearch();
		const input = screen.getByRole("searchbox");
		await userEvent.type(input, "theme{Enter}");
		expect(onSearch).toHaveBeenCalledTimes(1);
	});

	it("commits the search via the trailing search button", async () => {
		const { onSearch } = renderSearch();
		await userEvent.click(screen.getByRole("button", { name: "Search" }));
		expect(onSearch).toHaveBeenCalledTimes(1);
	});
});
