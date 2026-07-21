import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Sidebar navigation entry. Active state is a 2px primary bar on the left —
 * never a background fill (per the color docs).
 */
export interface SidebarNavItemProps {
	to: string;
	icon: string;
	label: string;
}

export function SidebarNavItem({ to, icon, label }: SidebarNavItemProps) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"flex items-center gap-4 border-l-2 pl-4 py-2 font-body text-body-md transition-colors duration-200",
					isActive
						? "border-primary text-primary dark:border-primary-fixed dark:text-primary-fixed"
						: "border-transparent text-on-surface-variant hover:bg-surface-variant dark:text-on-tertiary-container dark:hover:bg-tertiary-container",
				)
			}
		>
			<Icon name={icon} className="text-[20px]" />
			<span>{label}</span>
		</NavLink>
	);
}
