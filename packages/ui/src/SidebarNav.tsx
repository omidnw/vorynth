import type { ReactNode } from "react";
import { cn } from "./lib/cn";
import { Icon } from "./Icon";

/**
 * Sidebar navigation entry. Active state is a 2px primary bar on the left —
 * never a background fill (per the color docs).
 *
 * Pure-presentational: navigation + active-state are injected by the host. In
 * the desktop app, `SidebarNavItemLink` wraps this in a react-router `NavLink`
 * and derives `active` from the router; the landing page passes static props.
 */
export interface SidebarNavItemProps {
	icon: string;
	label: string;
	/** Active (current route) → primary left bar + primary text. */
	active?: boolean;
	/** Optional leading content (used by nav groups that wrap this item). */
	children?: ReactNode;
	/** Optional trailing content (e.g. the Docs expand chevron). */
	trailing?: ReactNode;
	className?: string;
	onClick?: () => void;
}

export function SidebarNavItem({
	icon,
	label,
	active = false,
	children,
	trailing,
	className,
	onClick,
}: SidebarNavItemProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-4 border-s-2 ps-4 py-2 font-body text-body-md transition-colors duration-200 cursor-pointer",
				active
					? "border-primary text-primary dark:border-primary-fixed dark:text-primary-fixed"
					: "border-transparent text-on-surface-variant hover:bg-surface-variant dark:text-on-tertiary-container dark:hover:bg-tertiary-container",
				className,
			)}
			onClick={onClick}
			role="link"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick?.();
				}
			}}
		>
			<Icon name={icon} className="text-[20px]" />
			<span>{children ?? label}</span>
			{trailing}
		</div>
	);
}
