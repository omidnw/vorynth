import { useTranslation } from "react-i18next";
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
export function ArchiveNavRow({ className }: { className?: string }) {
	const { t } = useTranslation();
	const items: Array<{
		to: string;
		label: string;
		icon: string;
		/** Exact match — don't highlight "Items" while inside /archive/search… */
		end?: boolean;
	}> = [
		{ to: "/archive", label: t("nav.items"), icon: "inventory_2", end: true },
		{
			to: "/archive/collections",
			label: t("nav.collections"),
			icon: "folder_special",
		},
		{ to: "/bookmarks", label: t("nav.bookmarks"), icon: "bookmark" },
		{ to: "/archive/search", label: t("nav.search"), icon: "search" },
		{ to: "/media", label: t("nav.media"), icon: "photo_library" },
		{ to: "/archive/trash", label: t("nav.trash"), icon: "delete" },
	];
	return (
		<nav
			aria-label={t("nav.archiveSections")}
			className={cn("flex flex-wrap gap-1", className)}
		>
			{items.map((item) => (
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
