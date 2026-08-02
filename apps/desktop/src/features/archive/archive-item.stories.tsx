import type { Meta, StoryObj } from "@storybook/react-vite";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import type { ArchiveItem } from "@vorynth/types";

/**
 * Archive item — mock-data render of the Archive card pattern (v1.6.0).
 *
 * This is the demo the in-app Documentation page reuses: a saved story with
 * tags, a note, and the Save / Note / Archive actions. Real data comes from
 * the engine; stories keep the visual contract stable.
 */
const mockItem: ArchiveItem = {
	contentItemId: "demo-item-1",
	contentType: "article",
	note: "Revisit — the retraction follow-up is important.",
	collectionId: null,
	archivedAt: null,
	bookmarked: true,
	tags: ["security", "llm"],
	createdAt: "2026-08-01T08:00:00.000Z",
	updatedAt: "2026-08-01T08:05:00.000Z",
	title: "Read This Before You Buy That TV Streaming Stick",
	url: "https://example.com/story",
	author: "BrianKrebs",
	publishedAt: "2026-07-30T16:49:00.000Z",
	origin: { id: "article-demo", sourceId: "src-krebs", title: "…" },
};

function ArchiveCard({ item }: { item: ArchiveItem }) {
	return (
		<GhostCard className="flex flex-col gap-2">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 shrink-0">
					<DomainTag>Story</DomainTag>
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-headline text-headline-sm text-on-surface">
						{item.title}
					</span>
					<span className="font-body text-body-sm text-on-surface-variant">
						by {item.author}
					</span>
				</span>
				<div className="flex shrink-0 gap-1">
					<Icon name="bookmark" fill className="text-primary" />
					<Icon name="note" className="text-on-surface-variant" />
				</div>
			</div>
			<p className="border-l-2 border-primary pl-3 font-body text-body-sm italic text-on-surface-variant">
				{item.note}
			</p>
			<div className="flex flex-wrap gap-2">
				{item.tags.map((t) => (
					<span
						key={t}
						className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-label-sm text-on-tertiary-container"
					>
						#{t}
					</span>
				))}
			</div>
		</GhostCard>
	);
}

const meta: Meta<typeof ArchiveCard> = {
	title: "Archive/ItemCard",
	component: ArchiveCard,
	args: { item: mockItem },
};
export default meta;

type Story = StoryObj<typeof ArchiveCard>;

export const SavedStory: Story = {};

export const WithoutNote: Story = {
	args: { item: { ...mockItem, note: null, bookmarked: false, tags: [] } },
};

export const SummaryItem: Story = {
	args: {
		item: {
			...mockItem,
			contentType: "summary",
			title: "This Week — AI governance heats up",
			author: null,
			url: null,
			note: null,
		},
	},
};
