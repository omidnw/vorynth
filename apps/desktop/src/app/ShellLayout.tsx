import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { SidebarNavItem } from "@/components/shell/SidebarNav";
import { ArchiveNavGroup } from "@/components/shell/ArchiveNavGroup";
import { DocsNavGroup } from "@/components/shell/DocsNavGroup";
import { PluginNavGroup } from "@/components/shell/PluginNavGroup";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { NotificationCenter } from "@/features/notifications/NotificationCenter.js";
import { JobsTray } from "@/features/jobs/JobsTray.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { HistoryDrawer } from "@/features/history/HistoryDrawer.js";
import {
	useHistoryStore,
	type HistoryScope,
} from "@/features/history/history-store.js";
import { fetchProfile } from "@/features/profile/profile-api.js";
import { fetchSettings } from "@/features/history/history-api.js";

/**
 * Fixed-column insight layout (examples/colors: "Fixed-Column Insight" model).
 *
 *   ┌────────────┬─────────────────────────────────┐
 *   │ 260px      │ 64px top bar                    │
 *   │ sidebar    ├─────────────────────────────────┤
 *   │            │ 800px-max centered content      │
 *   │            │  (right contextual col on XL)   │
 *   └────────────┴─────────────────────────────────┘
 */
export function ShellLayout() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const activeCount = useJobsStore((s) => s.jobs.active.length);
	const openDrawer = useHistoryStore((s) => s.openDrawer);
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
		staleTime: 60_000,
	});
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		staleTime: 60_000,
	});
	// v1.8.0 — the Plugins page is power-user territory; hidden until the
	// "Show advanced features" setting in Settings → Advanced is on.
	// v1.8.1 — a separate "Show the Plugins page" toggle lets a user keep
	// advanced/developer mode WITHOUT the plugin surface.
	const showPlugins =
		settings?.["ui.showAdvancedFeatures"] === true &&
		settings?.["ui.showPlugins"] !== false;

	// v1.8.1 — text labels next to the top-bar icons (Settings → Appearance).
	const showHeaderLabels = settings?.["ui.showHeaderLabels"] !== false;

	// v1.8.1 — every navigation starts at the top of the new page (the old
	// scroll position used to carry over, so a deep-scrolled Brief left the
	// next page scrolled down too).
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [location.pathname]);

	const openHistory = () => {
		// Context-aware default: briefings on /brief, generated on /profile,
		// searches everywhere else.
		const path = location.pathname;
		const scope: HistoryScope = path.startsWith("/brief")
			? "brief"
			: path.startsWith("/profile")
				? "generated"
				: "search";
		openDrawer(scope);
	};

	const displayName =
		profile?.alias?.trim() ||
		[profile?.firstName?.trim(), profile?.lastName?.trim()]
			.filter(Boolean)
			.join(" ") ||
		t("nav.user");

	return (
		<div className="min-h-screen bg-background text-on-surface">
			{/* Sidebar — 260px, persistent. Written with logical utilities
			    (start-/border-s) so `[dir="rtl"]` mirrors the shell natively. */}
			<aside className="fixed start-0 top-0 z-50 flex h-screen w-sidebar-width flex-col border-e border-outline-variant bg-surface-container py-8 dark:bg-surface-container-high">
				<div className="mb-10 px-6">
					<h1 className="mb-1 font-headline text-headline-md font-medium text-primary dark:text-primary-fixed">
						Vorynth
					</h1>
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("app.localEngine")}
					</p>
				</div>

				{/* scrollbar-gutter:stable keeps the content width constant when the
					    Docs/Archive submenus make the nav overflow — otherwise the
					    scrollbar appearing shrinks every item and shifts right-anchored
					    icons. */}
				<nav className="flex-1 space-y-2 overflow-y-auto px-2 [scrollbar-gutter:stable]">
					<SidebarNavItem to="/brief" icon="today" label={t("nav.brief")} />
					<ArchiveNavGroup />
					<SidebarNavItem
						to="/sources"
						icon="storage"
						label={t("nav.sources")}
					/>
					{showPlugins ? (
						<SidebarNavItem
							to="/plugins"
							icon="extension"
							label={t("plugins.title")}
						/>
					) : null}
					<PluginNavGroup />
					<DocsNavGroup />
					<SidebarNavItem
						to="/changelog"
						icon="change_history"
						label={t("nav.changelog")}
					/>
				</nav>

				<div className="mt-auto px-6">
					{/* v1.8.1 — a divider separates the profile from the settings
					    icon so the two controls don't read as one block. */}
					<div className="mt-8 border-t border-outline-variant pt-4">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => navigate("/profile")}
								className="flex flex-1 items-center gap-3 rounded text-start transition-colors hover:bg-surface-container-high"
								title={t("nav.openProfile")}
							>
								<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-label-md text-on-primary-container">
									{initials(displayName)}
								</span>
								<span className="flex min-w-0 flex-col">
									<span className="truncate font-label text-label-md text-on-surface">
										{displayName}
									</span>
									<span className="font-label text-label-sm text-on-surface-variant">
										{t("app.localEngine")}
									</span>
								</span>
							</button>
							{/* v1.8.1 — explicit divider between the profile text and
							    the settings icon (border-s), plus a bigger icon. */}
							<button
								type="button"
								onClick={() => navigate("/settings")}
								className="ms-1 flex h-9 w-9 shrink-0 items-center justify-center rounded border-s border-outline-variant ps-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
								title={t("nav.openSettings")}
							>
								<Icon name="settings" className="text-[24px]" />
							</button>
						</div>
					</div>
				</div>
			</aside>

			{/* Top bar — search lives in the sidebar now, so we only keep
			    utility actions here (theme toggle, etc.). */}
			<header className="fixed start-sidebar-width end-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-margin-desktop">
				<span className="font-label text-label-sm text-on-surface-variant">
					{new Date().toLocaleDateString(i18n.language, {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</span>
				<div className="flex items-center gap-4">
					{activeCount > 0 ? (
						<span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-secondary">
							<Icon name="sync" className="animate-spin-reverse text-[14px]" />
							{t("nav.jobsActive", { count: activeCount })}
						</span>
					) : null}
					{/* v1.8.1 — bigger header icons with optional text labels
					    (Settings → Appearance → "Show icon labels in the header"). */}
					<button
						type="button"
						onClick={openHistory}
						aria-label={t("nav.openHistory")}
						title={t("nav.history")}
						className="flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon name="history" className="text-[24px]" />
						{showHeaderLabels ? (
							<span className="hidden font-label text-label-sm md:inline">
								{t("nav.history")}
							</span>
						) : null}
					</button>
					<div className="border-s border-outline-variant ps-4">
						<ThemeToggle showLabel={showHeaderLabels} />
					</div>
					{/* v1.8.0 — notification center: to the right of the theme changer */}
					<NotificationCenter showLabel={showHeaderLabels} />
				</div>
			</header>

			{/* Main canvas — `vorynth-canvas` is the theme background target */}
			<main className="vorynth-canvas ms-sidebar-width min-h-screen pt-16">
				<Outlet />
			</main>

			{/* Floating jobs tray — survives route changes; polls the engine */}
			<JobsTray />

			{/* Right-side history drawer — survives route changes */}
			<HistoryDrawer />
		</div>
	);
}

/** Derive 1-2 initials from a display name for the avatar bubble. */
function initials(name: string): string {
	const parts = name.trim().split(/\s+/).slice(0, 2);
	if (parts.length === 0 || !parts[0]) return "?";
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
