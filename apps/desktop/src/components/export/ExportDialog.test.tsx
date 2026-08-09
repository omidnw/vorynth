import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ExportableContent } from "@vorynth/types";
import "@/i18n"; // initializes i18next so t() resolves the bundled catalog
import { ExportDialog } from "./ExportDialog.js";
import { usePluginContributions } from "@/plugins/plugin-contributions.js";

/**
 * ExportDialog (v1.8.0) — the shared dialog any page opens to export its
 * content. It renders the exporter plugins' panels for a generic
 * `ExportableContent` payload (article, insight, answer, history entry, or
 * period brief) — not just articles.
 */

/** A fake panel proving the dialog feeds the generic payload through. */
function FakeExporter({
	content,
	onClose,
}: {
	content: ExportableContent;
	onClose: () => void;
}) {
	return (
		<div>
			<p>Exporter got: {content.title}</p>
			<button type="button">Download Markdown</button>
			<button type="button" onClick={onClose}>
				Close
			</button>
		</div>
	);
}

describe("ExportDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usePluginContributions.getState().clear();
		usePluginContributions.getState().register({
			id: "story-renderer",
			name: "Story Renderer",
			version: "1.8.0",
			exports: { StoryExports: FakeExporter },
		});
	});

	it("renders exporter panels for a non-article payload (an Ask-AI answer)", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(
			<ExportDialog
				content={{
					kind: "other",
					title: "Why does OpenAI rate-limit?",
					body: "Because requests are expensive.\n\nSources:\n[1] Example — blog.example\nhttps://blog.example/p",
				}}
				onClose={onClose}
			/>,
		);

		// The generic payload (no url/source/article) reaches the plugin panel.
		expect(
			screen.getByText("Exporter got: Why does OpenAI rate-limit?"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Download Markdown" }),
		).toBeInTheDocument();

		// The panel's own Close calls onClose → the host unmounts the dialog.
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes when the dimmed backdrop is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const { container } = render(
			<ExportDialog
				content={{ kind: "other", title: "A period brief", body: "Headline…" }}
				onClose={onClose}
			/>,
		);
		const overlay = container.firstElementChild as HTMLElement;
		await user.click(overlay);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes via the top-right ✕ button", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(
			<ExportDialog
				content={{ kind: "other", title: "A period brief", body: "Headline…" }}
				onClose={onClose}
			/>,
		);
		await user.click(
			screen.getByRole("button", { name: "Close export dialog" }),
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes on Escape", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(
			<ExportDialog
				content={{ kind: "other", title: "A period brief", body: "Headline…" }}
				onClose={onClose}
			/>,
		);
		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
