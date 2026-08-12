import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenshotsPage } from "./ScreenshotsPage";

describe("ScreenshotsPage", () => {
	it("renders the gallery heading and every screenshot with alt text", () => {
		render(<ScreenshotsPage />);

		expect(
			screen.getByRole("heading", { name: /^vorynth screenshots$/i }),
		).toBeInTheDocument();

		// All 13 screenshots + the header logo render as images.
		const imgs = screen.getAllByRole("img");
		expect(imgs.length).toBeGreaterThanOrEqual(13);
		for (const img of imgs) {
			expect(img.getAttribute("alt")).toBeTruthy();
		}

		// The brief screenshot links to the right asset, with a real caption.
		expect(screen.getByAltText(/Today's Intelligence Brief/i)).toHaveAttribute(
			"src",
			"/screenshots/todays-brief.png",
		);
		expect(
			screen.getByText(/Today's Brief — the ranked feed, with AI context/i),
		).toBeInTheDocument();

		expect(
			screen.getByRole("link", { name: /back to the home page/i }),
		).toHaveAttribute("href", "/");
	});

	it("opens a full-size preview on click and closes with Escape", async () => {
		render(<ScreenshotsPage />);

		// Clicking a screenshot opens the lightbox dialog.
		fireEvent.click(
			screen.getByRole("button", { name: /preview: today's brief/i }),
		);
		const dialog = screen.getByRole("dialog", {
			name: /preview: today's brief/i,
		});
		expect(dialog).toBeInTheDocument();
		// The enlarged image lives inside the dialog (the grid copy is a sibling).
		expect(
			within(dialog).getByAltText(/Today's Intelligence Brief/i),
		).toBeInTheDocument();

		// Escape dismisses it (the exit animation delays unmount briefly).
		fireEvent.keyDown(window, { key: "Escape" });
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("closes the preview via the close button", async () => {
		render(<ScreenshotsPage />);

		fireEvent.click(
			screen.getByRole("button", { name: /preview: archive — collections/i }),
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /^close preview$/i }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});
});
