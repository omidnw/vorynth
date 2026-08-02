import { useNavigate } from "react-router-dom";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";

/**
 * DocsTipCard — the "Read docs" tip card linking a page to its in-app
 * Documentation section (R-D06 bidirectional link: page → `/docs#<id>`).
 *
 * Shared by every page so the pattern stays uniform; the section's `pageRoute`
 * provides the reverse link (docs → page).
 */
export function DocsTipCard({
	sectionId,
	title,
	subtitle,
	icon = "menu_book",
	label = "Read docs",
}: {
	/** The docs section id — the `#<id>` fragment on /docs. */
	sectionId: string;
	title: string;
	subtitle: string;
	/** Material Symbols icon shown next to the title. */
	icon?: string;
	/** Link label, e.g. "Read tutorial" for Sources. */
	label?: string;
}) {
	const navigate = useNavigate();
	return (
		<div className="mt-8">
			<GhostCard className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex min-w-0 flex-wrap items-center gap-3">
					<Icon
						name={icon}
						className="shrink-0 text-[24px] text-on-surface-variant"
					/>
					<div className="min-w-0">
						<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							{title}
						</h3>
						<p className="font-body text-body-sm text-on-tertiary-container">
							{subtitle}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => navigate(`/docs#${sectionId}`)}
					className="inline-flex cursor-pointer items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
				>
					<Icon name="open_in_new" className="text-[16px]" />
					{label}
				</button>
			</GhostCard>
		</div>
	);
}
