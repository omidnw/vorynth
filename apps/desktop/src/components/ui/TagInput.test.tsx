import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./TagInput.js";

const SUGGESTIONS = [
	"cloud",
	"ai",
	"security",
	"cloudflare",
	"cloud-computing",
	"react",
];

/** Controlled harness so chips render after commits. */
function Harness() {
	const [tags, setTags] = useState<string[]>([]);
	return (
		<TagInput
			value={tags}
			onChange={setTags}
			suggestions={SUGGESTIONS}
			aria-label="Tags"
			addButtonLabel="Add tag"
		/>
	);
}

function renderInput() {
	render(<Harness />);
	return screen.getByRole("textbox", { name: "Tags" });
}

describe("TagInput — chips + live suggestions (v1.9.0)", () => {
	it("adds a tag via the + button, normalized to a slug", async () => {
		const user = userEvent.setup();
		const input = renderInput();
		await user.type(input, "Cloud ");
		await user.click(screen.getByRole("button", { name: "Add tag" }));
		expect(screen.getByText("cloud")).toBeInTheDocument();
	});

	it("commits the token before a comma and keeps typing the next", async () => {
		const user = userEvent.setup();
		const input = renderInput();
		await user.type(input, "cloud,ai");
		// "cloud" committed as a chip; "ai" still in the draft.
		expect(screen.getByText("cloud")).toBeInTheDocument();
		expect(input).toHaveValue("ai");
		await user.keyboard("{Enter}");
		expect(screen.getByText("ai")).toBeInTheDocument();
	});

	it("adds a tag on Enter and removes it via ×", async () => {
		const user = userEvent.setup();
		const input = renderInput();
		await user.type(input, "security{Enter}");
		expect(screen.getByText("security")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Remove security" }));
		expect(screen.queryByText("security")).not.toBeInTheDocument();
	});

	it("shows live suggestions while typing and commits on click", async () => {
		const user = userEvent.setup();
		const input = renderInput();
		await user.type(input, "cl");
		const list = screen.getByRole("list");
		expect(within(list).getByText("cloud")).toBeInTheDocument();
		expect(within(list).getByText("cloudflare")).toBeInTheDocument();
		await user.click(within(list).getByText("cloudflare"));
		expect(screen.getByText("cloudflare")).toBeInTheDocument();
	});

	it("never suggests anything when the field is empty", () => {
		renderInput();
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
	});
});
