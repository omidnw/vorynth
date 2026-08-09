import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
	it("renders every landing-page section", () => {
		render(<App />);

		// "Signal over noise." appears twice (Why heading + the app preview's
		// brief) — scope with getAllByRole.
		expect(
			screen.getAllByRole("heading", { name: /signal over noise/i }).length,
		).toBeGreaterThanOrEqual(1);
		expect(
			screen.getByRole("heading", {
				name: /built for people who need to stay informed/i,
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /from firehose to brief/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /designed for different minds/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /not another ai chat window/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /let it come to you/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /run it your way/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /platform support/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /start reading less today/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /frequently asked questions/i }),
		).toBeInTheDocument();

		// The mockup shell is present.
		expect(screen.getByText("Today's Intelligence Brief")).toBeInTheDocument();
	});

	it("keeps every FAQ item closed until clicked", () => {
		render(<App />);

		const first = screen.getByRole("button", { name: /what is vorynth/i });
		// All items start closed — nothing opens until a visitor clicks.
		expect(first).toHaveAttribute("aria-expanded", "false");

		fireEvent.click(first);
		expect(first).toHaveAttribute("aria-expanded", "true");

		fireEvent.click(first);
		expect(first).toHaveAttribute("aria-expanded", "false");

		// Reopen the first, then open a different item — the first must close.
		const other = screen.getByRole("button", { name: /open source/i });
		fireEvent.click(first);
		fireEvent.click(other);
		expect(first).toHaveAttribute("aria-expanded", "false");
		expect(other).toHaveAttribute("aria-expanded", "true");
	});

	it("opens a download dialog when a platform card is clicked", async () => {
		render(<App />);

		const mac = screen.getByRole("button", {
			name: /download vorynth for macos/i,
		});
		fireEvent.click(mac);

		const dialog = await screen.findByRole("dialog", {
			name: /download vorynth for macos/i,
		});
		expect(dialog).toBeInTheDocument();

		// The mock engine has no GitHub release data, so the modal degrades to
		// the bundled-version fallback link — but it must render a real link.
		expect(
			await screen.findByText(/macOS \(Apple Silicon\)/i),
		).toBeInTheDocument();

		// macOS always offers the Homebrew cask alongside the DMG. (Scoped to
		// the dialog — the CTA section shows the same command.)
		expect(
			within(dialog).getByText(/brew install --cask vorynth/i),
		).toBeInTheDocument();

		// Esc closes the dialog again.
		fireEvent.keyDown(dialog, { key: "Escape" });
		expect(
			screen.queryByRole("dialog", { name: /download vorynth for macos/i }),
		).not.toBeInTheDocument();
	});

	it("sends the CTA download button to the platform section and shows the tip", () => {
		render(<App />);

		// "Download the latest release" scrolls to the platform grid instead of
		// sending the visitor to GitHub.
		expect(
			screen.getByRole("link", { name: /download the latest release/i }),
		).toHaveAttribute("href", "#platforms");

		// The section advertises the click-to-download interaction.
		expect(screen.getByText(/click any platform box/i)).toBeInTheDocument();
	});

	it("copies the Homebrew command when the copy button is clicked", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(window.navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		render(<App />);
		fireEvent.click(
			screen.getByRole("button", { name: /download vorynth for macos/i }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: /download vorynth for macos/i,
		});

		fireEvent.click(
			within(dialog).getByRole("button", { name: /copy homebrew command/i }),
		);

		expect(writeText).toHaveBeenCalledWith(
			"brew tap omidnw/vorynth\nbrew install --cask vorynth",
		);
		// The "Copied" state lands in a microtask after the clipboard await.
		expect(
			await within(dialog).findByText("Copied"),
		).toBeInTheDocument();
	});

	it("toggles the mobile nav menu and closes it on a link click", () => {
		render(<App />);

		const toggle = screen.getByRole("button", {
			name: /toggle navigation menu/i,
		});
		expect(toggle).toHaveAttribute("aria-expanded", "false");

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");

		// Picking a destination closes the menu again.
		fireEvent.click(screen.getByRole("link", { name: /how it works/i }));
		expect(toggle).toHaveAttribute("aria-expanded", "false");
	});

	it("shows the Linux distro-family guide inside the Linux dialog", async () => {
		render(<App />);

		fireEvent.click(
			screen.getByRole("button", { name: /download vorynth for linux/i }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: /download vorynth for linux/i,
		});

		expect(
			within(dialog).getByText(/which package for your distro/i),
		).toBeInTheDocument();
		// The guide is a collapsed <details> — closed until the user asks for it.
		const summary = within(dialog).getByText(/which package for your distro/i);
		expect(summary.closest("details")).not.toHaveAttribute("open");
		fireEvent.click(summary);
		expect(summary.closest("details")).toHaveAttribute("open");
		// Scoped to the guide (the same family names also appear on the buttons).
		expect(
			within(dialog).getByText(/debian & ubuntu \(mint/i),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/fedora & rhel \(rocky/i),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/any glibc-based distro — no install/i),
		).toBeInTheDocument();
	});
});
