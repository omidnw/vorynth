import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArchiveNavRow } from "./ArchiveNavRow.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { fetchSettings } from "@/features/history/history-api.js";

/**
 * Archive family page skeleton — one consistent structure for all five pages
 * (Items · Collections · Bookmarks · Search · Trash) so switching between them
 * never shifts the user's eye: same section width/padding, same header rhythm
 * (h2 title + subtitle + optional right-aligned actions), and the section pill
 * row pinned at the same spot under the header on every page.
 *
 * v1.8.1 — the in-page pill row is only shown in "inpage" navigation mode
 * (Settings → General → Navigation). The default "sidebar" mode moves the
 * Archive sub-pages into the sidebar submenu, so the row is hidden here.
 *
 * Every page also carries the same icon-only "How it works" help button (top
 * right) that deep-links to its in-app documentation section — one predictable
 * docs entry point instead of scattered hints (Google MD3: rich guidance
 * belongs in docs; inline text only for micro-copy). h2 is the page-title
 * level app-wide — ShellLayout owns the single h1.
 */
export function ArchiveLayout({
	title,
	subtitle,
	actions,
	hint,
	docsSectionId,
	children,
}: {
	title: string;
	subtitle?: ReactNode;
	/** Right-aligned header actions (e.g. "Empty trash"). */
	actions?: ReactNode;
	/** Extra note under the title block (e.g. the Trash retention hint). */
	hint?: ReactNode;
	/** In-app docs section id — the "How it works" button links to /docs#<id>. */
	docsSectionId: string;
	children: ReactNode;
}) {
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const sidebarNav = settings?.["ui.archiveNavMode"] !== "inpage";

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-8">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">
						<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
							{title}
						</h2>
						{subtitle ? (
							<p className="max-w-prose font-body text-body-md text-on-surface-variant">
								{subtitle}
							</p>
						) : null}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{actions}
						<DocsHelpButton sectionId={docsSectionId} />
					</div>
				</div>
				{hint ? <div className="mt-3">{hint}</div> : null}
				{/* Section navigation — pinned at the same spot on every page, only
				    in "inpage" mode (the sidebar submenu is the default nav). */}
				{!sidebarNav ? <ArchiveNavRow className="mt-5" /> : null}
			</header>
			{children}
		</section>
	);
}
