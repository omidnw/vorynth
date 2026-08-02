import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DomainTag, ImportanceBadge } from "@/components/ui/Badge";

/**
 * Smoke test for the badge primitives — proves the Vitest + jsdom +
 * testing-library pipeline works, and anchors the a11y contract: text content
 * is the accessible name (no data-test-id anywhere in this app).
 */
describe("ImportanceBadge", () => {
	it("renders its label as text content", () => {
		render(<ImportanceBadge tier="signal">Signal</ImportanceBadge>);
		expect(screen.getByText("Signal")).toBeInTheDocument();
	});
});

describe("DomainTag", () => {
	it("renders children and forwards standard HTML attributes", () => {
		render(
			<DomainTag aria-label="Domain: AI" title="AI">
				AI
			</DomainTag>,
		);
		const tag = screen.getByLabelText("Domain: AI");
		expect(tag).toBeInTheDocument();
		expect(tag).toHaveAttribute("title", "AI");
		expect(tag).toHaveTextContent("AI");
	});
});
