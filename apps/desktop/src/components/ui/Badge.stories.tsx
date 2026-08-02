import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportanceBadge, DomainTag } from "./Badge";

/**
 * Badge primitives — the low-ink importance/domain markers used across the
 * Brief, Archive, and detail pages.
 */
const meta: Meta<typeof ImportanceBadge> = {
	title: "UI/Badge",
	component: ImportanceBadge,
	args: { children: "Signal" },
};
export default meta;

type Story = StoryObj<typeof ImportanceBadge>;

export const Signal: Story = { args: { tier: "signal", children: "Signal" } };
export const Trend: Story = { args: { tier: "trend", children: "Trend" } };
export const LowNoise: Story = {
	args: { tier: "low-noise", children: "Low Noise" },
};

export const Domain: StoryObj<typeof DomainTag> = {
	render: () => <DomainTag>AI</DomainTag>,
};
