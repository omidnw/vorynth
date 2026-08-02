import { SidebarNavItem } from "./SidebarNav";

/**
 * Archive sidebar entry (v1.7.0).
 *
 * A single top-level item — switching between the Archive family's sub-pages
 * (Items · Collections · Bookmarks · Search · Trash) is owned by the in-page
 * `ArchiveNavRow` shown on each of those pages. The sidebar keeps its global
 * role instead of duplicating the section tabs: a duplicate submenu would only
 * add cognitive load (Google MD3 — segmented tabs are the local source of
 * truth for switching views within a section).
 */
export function ArchiveNavGroup() {
	return (
		<SidebarNavItem
			to="/archive"
			icon="inventory_2"
			label="Archive"
			isActive={(pathname) =>
				pathname === "/archive" ||
				pathname.startsWith("/archive/") ||
				pathname.startsWith("/bookmarks")
			}
		/>
	);
}
