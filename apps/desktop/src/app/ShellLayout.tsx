import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { SidebarNavItem } from "@/components/shell/SidebarNav";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { JobsTray } from "@/features/jobs/JobsTray.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { HistoryDrawer } from "@/features/history/HistoryDrawer.js";
import {
	useHistoryStore,
	type HistoryScope,
} from "@/features/history/history-store.js";
import { fetchProfile } from "@/features/profile/profile-api.js";

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
	const navigate = useNavigate();
	const location = useLocation();
	const activeCount = useJobsStore((s) => s.jobs.active.length);
	const openDrawer = useHistoryStore((s) => s.openDrawer);
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
		staleTime: 60_000,
	});

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
		"Local User";
	return (
		<div className="min-h-screen bg-background text-on-surface">
			{/* Sidebar — 260px, persistent. The `rtl-flip-*` classes mirror the
			    fixed shell when an RTL locale is active (see globals.css). */}
			<aside className="rtl-flip-sidebar fixed left-0 top-0 z-50 flex h-screen w-sidebar-width flex-col border-r border-outline-variant bg-surface-container py-8 dark:bg-surface-container-high">
				<div className="mb-10 px-6">
					<h1 className="mb-1 font-headline text-headline-md font-medium text-primary dark:text-primary-fixed">
						Vorynth
					</h1>
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						Local Engine Active
					</p>
				</div>

				<nav className="flex-1 space-y-2 px-2">
					<SidebarNavItem to="/brief" icon="today" label="Today's Brief" />
					<SidebarNavItem to="/search" icon="search" label="Search" />
					<SidebarNavItem to="/sources" icon="database" label="Sources" />
					<SidebarNavItem to="/media" icon="photo_library" label="Media" />
					<SidebarNavItem to="/settings" icon="settings" label="Settings" />
					<SidebarNavItem
						to="/changelog"
						icon="change_history"
						label="Changelog"
					/>
				</nav>

				<div className="mt-auto px-6">
					<button
						type="button"
						onClick={() => navigate("/profile")}
						className="mt-8 flex w-full items-center gap-3 rounded text-left transition-colors hover:bg-surface-container-high"
						title="Open profile"
					>
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-label-md text-on-primary-container">
							{initials(displayName)}
						</span>
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-label text-label-md text-on-surface">
								{displayName}
							</span>
							<span className="font-label text-label-sm text-on-surface-variant">
								Local Engine
							</span>
						</span>
					</button>
				</div>
			</aside>

			{/* Top bar — search lives in the sidebar now, so we only keep
			    utility actions here (theme toggle, etc.). */}
			<header className="rtl-flip-topbar fixed left-sidebar-width right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-margin-desktop">
				<span className="font-label text-label-sm text-on-surface-variant">
					{new Date().toLocaleDateString("en-US", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</span>
				<div className="flex items-center gap-4">
					{activeCount > 0 ? (
						<span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-secondary">
							<Icon name="sync" className="animate-spin text-[14px]" />
							{activeCount} job{activeCount > 1 ? "s" : ""}
						</span>
					) : null}
					<button
						type="button"
						onClick={openHistory}
						aria-label="Open history"
						title="History"
						className="text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon name="history" />
					</button>
					<div className="border-l border-outline-variant pl-4">
						<ThemeToggle />
					</div>
				</div>
			</header>

			{/* Main canvas */}
			<main className="rtl-flip-main ml-sidebar-width min-h-screen pt-16">
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
