import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { ThemeManager } from "./ThemeManager.js";
import {
	unregisterUserTheme,
	useThemeStore,
	userThemes,
} from "@/lib/theme/theme-store.js";

const THEME_JSON = JSON.stringify({
	id: "aurora",
	name: "Aurora",
	light: { "--color-primary": "120 200 255" },
	dark: { "--color-primary": "30 90 150" },
});

describe("ThemeManager (v1.8.0)", () => {
	beforeEach(() => {
		useThemeStore.setState({ theme: "light", registryVersion: 0 });
		// Clean any user themes persisted by earlier tests.
		for (const t of userThemes()) {
			unregisterUserTheme(t.id);
		}
	});

	it("shows the import / AI / export actions", () => {
		render(<ThemeManager />);
		expect(screen.getByRole("button", { name: "Import theme" })).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Customize with AI" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Export current theme" }),
		).toBeTruthy();
	});

	it("imports a pasted theme and makes it selectable + listed", async () => {
		const user = userEvent.setup();
		render(<ThemeManager />);

		await user.click(screen.getByRole("button", { name: "Import theme" }));
		fireEvent.change(screen.getByPlaceholderText(/aurora/), {
			target: { value: THEME_JSON },
		});
		await user.click(screen.getByRole("button", { name: "Import" }));

		await waitFor(() => {
			expect(useThemeStore.getState().theme).toBe("aurora");
		});
		expect(screen.getByText("Aurora")).toBeTruthy();
		// The custom theme row gets edit/export/delete actions.
		expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
	});

	it("reports a validation error for a bad theme", async () => {
		const user = userEvent.setup();
		render(<ThemeManager />);

		await user.click(screen.getByRole("button", { name: "Import theme" }));
		fireEvent.change(screen.getByPlaceholderText(/aurora/), {
			target: { value: "{not json" },
		});
		await user.click(screen.getByRole("button", { name: "Import" }));

		expect(await screen.findByText("The file isn't valid JSON.")).toBeTruthy();
		expect(useThemeStore.getState().theme).toBe("light");
	});
});
