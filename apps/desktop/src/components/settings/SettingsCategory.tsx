import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * SettingsCategory — an anchor section wrapper for the Settings / Profile
 * category groups.
 *
 * Renders a `<section>` that the category rail can scroll to (via its `id`,
 * with `scroll-mt-24` so the sticky header doesn't cover the heading) plus a
 * group heading and a `space-y-8` container for the GhostCards inside.
 *
 * `search` is a lowercase keyword string describing the section's content
 * (section titles + key hint words); it is exposed as `data-search` on the
 * section so the page-level search can filter and dim categories.
 */
export interface SettingsCategoryProps {
	id: string;
	title: string;
	icon?: string;
	search?: string;
	className?: string;
	children: ReactNode;
	/**
	 * v1.8.0 — matched by the current search query: draw a ring around the
	 * section so the user sees exactly what matched (like the Docs page's
	 * active-section ring).
	 */
	highlighted?: boolean;
}

export function SettingsCategory({
	id,
	title,
	icon,
	search,
	className,
	children,
	highlighted = false,
}: SettingsCategoryProps) {
	return (
		<section
			id={id}
			className={cn(
				"scroll-mt-24",
				highlighted && "rounded-lg ring-2 ring-primary/40",
				className,
			)}
			data-search={search}
		>
			<h2 className="mb-6 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				{icon ? <Icon name={icon} className="text-[24px]" /> : null}
				{title}
			</h2>
			<div className="space-y-8">{children}</div>
		</section>
	);
}
