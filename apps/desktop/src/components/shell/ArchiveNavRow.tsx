import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Archive section navigation — one segmented pill row shown on every page of
 * the Archive family (Items · Collections · Bookmarks · Search · Trash).
 *
 * The active pill carries the you-are-here signal (`bg-primary`, matching the
 * type-filter pill idiom), and NavLink sets `aria-current="page"` on it. This
 * row owns switching between the family's sub-pages; the sidebar owns global
 * navigation, so the two don't duplicate each other.
 */
const ARCHIVE_NAV_ITEMS: Array<{
	to: string;
	label: string;
	icon: string;
	/** Exact match — don't highlight "Items" while inside /archive/search… */
	end?: boolean;
}> = [
	{ to: "/archive", label: "Items", icon: "inventory_2", end: true },
	{ to: "/archive/collections", label: "Collections", icon: "folder_special" },
	{ to: "/bookmarks", label: "Bookmarks", icon: "bookmark" },
	{ to: "/archive/search", label: "Search", icon: "search" },
	{ to: "/archive/trash", label: "Trash", icon: "delete" },
];

export function ArchiveNavRow({ className }: { className?: string }) {
	return (
		<nav
			aria-label="Archive sections"
			className={cn("flex flex-wrap gap-1", className)}
		>
			{ARCHIVE_NAV_ITEMS.map((item) => (
				<NavLink
					key={item.to}
					to={item.to}
					end={item.end}
					className={({ isActive }) =>
						cn(
							"inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 font-label text-label-sm transition-colors",
							isActive
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:bg-surface-container-high",
						)
					}
				>
					<Icon name={item.icon} className="text-[16px]" />
					{item.label}
				</NavLink>
			))}
		</nav>
	);
}
