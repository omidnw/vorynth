import { NavLink, useLocation } from "react-router-dom";
import {
	SidebarNavItem as SidebarNavItemBase,
	type SidebarNavItemProps,
} from "@vorynth/ui";

export type { SidebarNavItemProps };

/**
 * Desktop adapter for the shared `SidebarNavItem`. Restores the router
 * coupling: `to` becomes a NavLink, and `isActive` (optional route-family
 * matcher) wins over NavLink's own prefix match. The shared component owns the
 * 2px left-bar active style; this adapter only feeds it the `active` boolean
 * and the navigation handler.
 */
export function SidebarNavItem({
	to,
	isActive,
	...rest
}: SidebarNavItemProps & {
	to: string;
	isActive?: (pathname: string) => boolean;
}) {
	const location = useLocation();
	const overrideActive = isActive?.(location.pathname);
	return (
		<NavLink to={to} className="block">
			{({ isActive: navActive }) => (
				<SidebarNavItemBase {...rest} active={overrideActive ?? navActive} />
			)}
		</NavLink>
	);
}
