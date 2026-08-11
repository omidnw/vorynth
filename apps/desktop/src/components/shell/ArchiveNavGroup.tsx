import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { SidebarNavItem } from "./SidebarNav";
import { fetchSettings } from "@/features/history/history-api.js";

/**
 * Archive sidebar entry (v1.7.0 → v1.8.1).
 *
 * v1.8.1 — the Archive sub-pages (Items · Collections · Bookmarks · Search ·
 * Media · Trash) live under an expandable Archive submenu in the sidebar by
 * default. Users who prefer the old in-page tab row can switch back in
 * Settings → General → Navigation (`ui.archiveNavMode = "inpage"`), which
 * restores the single top-level item and the in-page ArchiveNavRow.
 */
export function ArchiveNavGroup() {
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const inpage = settings?.["ui.archiveNavMode"] === "inpage";
	const [expanded, setExpanded] = useState(false);

	const onArchive = (pathname: string) => {
		const p = pathname.replace(/\/+$/, "");
		// v1.8.1 — /media is part of the Archive family: the submenu stays open
		// and the item highlights when navigating from an archive page to Media.
		return (
			p === "/archive" ||
			p.startsWith("/archive/") ||
			p.startsWith("/bookmarks") ||
			p.startsWith("/media")
		);
	};

	// Auto-expand while inside the Archive family, collapse on leave.
	useEffect(() => {
		setExpanded(onArchive(location.pathname));
	}, [location.pathname]);

	// The pre-1.8.1 layout: a single top-level item + the in-page tab row.
	if (inpage) {
		return (
			<SidebarNavItem
				to="/archive"
				icon="inventory_2"
				label={t("nav.archive")}
				isActive={onArchive}
			/>
		);
	}

	const items = [
		{ to: "/archive", icon: "inventory_2", label: t("nav.items"), exact: true },
		{
			to: "/archive/collections",
			icon: "folder_special",
			label: t("nav.collections"),
			exact: false,
		},
		{
			to: "/bookmarks",
			icon: "bookmark",
			label: t("nav.bookmarks"),
			exact: false,
		},
		{
			to: "/archive/search",
			icon: "search",
			label: t("nav.search"),
			exact: false,
		},
		{
			to: "/media",
			icon: "photo_library",
			label: t("nav.media"),
			exact: false,
		},
		{
			to: "/archive/trash",
			icon: "delete",
			label: t("nav.trash"),
			exact: false,
		},
	];

	return (
		<div>
			<div className="relative">
				<SidebarNavItem
					to="/archive"
					icon="inventory_2"
					label={t("nav.archive")}
					isActive={onArchive}
				/>
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
					aria-label={
						expanded ? t("nav.archiveCollapse") : t("nav.archiveExpand")
					}
					className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
				>
					<Icon
						name="expand_more"
						className={cn(
							"text-[18px] transition-transform duration-200",
							expanded && "rotate-180",
						)}
					/>
				</button>
			</div>

			{expanded ? (
				<div className="ms-3 mt-1 space-y-1 border-s border-outline-variant ps-2 animate-fade-in">
					{items.map((it) => {
						const p = location.pathname.replace(/\/+$/, "");
						const active = it.exact ? p === it.to : p.startsWith(it.to);
						return (
							<button
								key={it.to}
								type="button"
								onClick={() => navigate(it.to)}
								aria-current={active ? "true" : undefined}
								className={cn(
									"flex w-full items-center gap-2 rounded px-2 py-1.5 text-start font-body text-body-sm transition-colors",
									active
										? "bg-primary-container text-on-primary-container"
										: "text-on-surface-variant hover:bg-surface-container-high",
								)}
							>
								<Icon name={it.icon} className="shrink-0 text-[15px]" />
								<span className="truncate">{it.label}</span>
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
