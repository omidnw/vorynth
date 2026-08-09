import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Category navigation primitives for the Settings / Profile pages.
 *
 * `CategoryRail` is the left sticky column navigation (shown on `lg+`); it
 * anchors to each category section. `CategoryChips` is the same item list
 * rendered as a horizontal scrollable row of pills for narrow screens.
 *
 * Items with no matching sections under the active search query are dimmed
 * (`opacity-40`) while the rest stay at full opacity.
 */
export interface CategoryItem {
	id: string;
	label: string;
	icon?: string;
}

export interface CategoryRailProps {
	items: CategoryItem[];
	activeId: string;
	onSelect: (id: string) => void;
	/** Category ids with zero visible sections under the current search query. */
	dimmedIds?: string[];
	/** Accessible name for the navigation region (defaults to the page's title). */
	ariaLabel?: string;
	/** Extra classes (e.g. responsive visibility `hidden lg:block`). */
	className?: string;
}

function itemClasses(active: boolean, dimmed: boolean): string {
	return cn(
		"inline-flex items-center gap-2 font-label text-label-md transition-colors",
		active
			? "bg-primary-container text-on-primary-container"
			: "text-on-surface-variant hover:bg-surface-container-high",
		dimmed && "opacity-40",
	);
}

export function CategoryRail({
	items,
	activeId,
	onSelect,
	dimmedIds = [],
	ariaLabel = "Settings categories",
	className,
}: CategoryRailProps) {
	return (
		<nav
			aria-label={ariaLabel}
			className={cn(
				"sticky top-16 self-start rounded border border-outline-variant bg-surface-container-low p-2",
				className,
			)}
		>
			<ul className="space-y-1">
				{items.map((item) => {
					const active = item.id === activeId;
					const dimmed = dimmedIds.includes(item.id);
					return (
						<li key={item.id}>
							<button
								type="button"
								onClick={() => onSelect(item.id)}
								aria-current={active ? "page" : undefined}
								className={cn(
									itemClasses(active, dimmed),
									"w-full rounded px-3 py-2 text-start",
								)}
							>
								{item.icon ? (
									<Icon name={item.icon} className="text-[18px]" />
								) : null}
								{item.label}
							</button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/** Narrow-screen variant — a horizontally scrollable row of pill buttons. */
export function CategoryChips({
	items,
	activeId,
	onSelect,
	dimmedIds = [],
	ariaLabel = "Settings categories",
	className,
}: CategoryRailProps) {
	return (
		<nav
			aria-label={ariaLabel}
			className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1", className)}
		>
			{items.map((item) => {
				const active = item.id === activeId;
				const dimmed = dimmedIds.includes(item.id);
				return (
					<button
						key={item.id}
						type="button"
						onClick={() => onSelect(item.id)}
						aria-current={active ? "page" : undefined}
						className={cn(
							itemClasses(active, dimmed),
							"shrink-0 rounded-full border px-3 py-1.5",
							active ? "border-primary" : "border-outline-variant",
						)}
					>
						{item.icon ? (
							<Icon name={item.icon} className="text-[16px]" />
						) : null}
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}
