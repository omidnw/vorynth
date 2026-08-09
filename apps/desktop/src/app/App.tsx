import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { captureInitialLocationKey } from "@/lib/router/has-history.js";
import { ShellLayout } from "./ShellLayout.js";
import { BriefPage } from "@/pages/BriefPage.js";
import { SourcesPage } from "@/pages/SourcesPage.js";
import { PluginsPage } from "@/pages/PluginsPage.js";
import { PluginPage } from "@/pages/PluginPage.js";
import { RequireAdvanced } from "@/components/shell/RequireAdvanced.js";
import { SettingsPage } from "@/pages/SettingsPage.js";
import { InsightDetailPage } from "@/pages/InsightDetailPage.js";
import { ArticleDetailPage } from "@/pages/ArticleDetailPage.js";
import { MediaPage } from "@/pages/MediaPage.js";
import { ProfilePage } from "@/pages/ProfilePage.js";
import { OnboardingPage } from "@/pages/OnboardingPage.js";
import { AnalyzingPage } from "@/pages/AnalyzingPage.js";
import { SearchPage } from "@/pages/SearchPage.js";
import { ChangelogPage } from "@/pages/ChangelogPage.js";
import { DesignSystemPage } from "@/pages/DesignSystemPage.js";
import { HistorySearchDetailPage } from "@/pages/HistorySearchDetailPage.js";
import { HistoryBriefDetailPage } from "@/pages/HistoryBriefDetailPage.js";
import { HistoryGeneratedDetailPage } from "@/pages/HistoryGeneratedDetailPage.js";
import { ArchivePage } from "@/pages/ArchivePage.js";
import { CollectionsPage } from "@/pages/CollectionsPage.js";
import { BookmarksPage } from "@/pages/BookmarksPage.js";
import { TrashPage } from "@/pages/TrashPage.js";
import { DocsPage } from "@/pages/DocsPage.js";
import {
	getOnboardingStatus,
	resolveHomePath,
} from "@/features/onboarding/onboarding-store.js";
import { LaunchBehaviorBridge } from "@/features/settings/launch-behavior-bridge.js";
import { UpdateBanner } from "@/features/updater/UpdateBanner.js";
import { startNotificationWatchers } from "@/features/notifications/notification-watchers.js";

/**
 * App routes — mapped 1:1 to the example screens.
 *
 *   /onboarding       3-step flow (welcome → optional provider → initialize)
 *   /brief            Today's Intelligence Brief (news-first)
 *   /insights/:id     Focused reading view for one AI insight
 *   /articles/:id     Native article reader (body + on-demand media)
 *   /analyzing        Workflow progress animation
 *   /archive          Unified user-owned space (items, bookmarks)
 *   /archive/search   Keyword + Ask-AI search (lives under the Archive)
 *   /archive/collections  File-explorer page for organizing items into folders
 *   /bookmarks        Saved items
 *   /docs             In-app documentation & tutorial
 *   /sources          Source management (list / add / toggle / range windows)
 *   /plugins          Adapter plugin registry (enable/disable adapters)
 *   /plugin/:id       A runtime UI plugin's own page (v1.9.0)
 *   /media            Locally-kept media dashboard (storage + release)
 *   /profile          User identity, custom instruction, behavior summary
 *   /settings         Engine status, LLM provider, usage, theme, data
 *   /changelog        Release notes with brand-themed codenames
 *   /design-system    Reference showcase of all primitives
 *
 * `/search` redirects to `/archive/search`, preserving `?q=` / `?mode=` so old
 * deep links (e.g. history "Re-search this query") keep working.
 */
export function App() {
	// Record the app's first location key so pages can tell an in-app
	// navigation from a direct deep link / restored session — independent of
	// trailing-slash spelling (see `lib/router/has-history.ts`).
	const location = useLocation();
	captureInitialLocationKey(location.key);
	// v1.8.0 — notification sources (job results, new-version pings). Started
	// once at the app root so events reach the center regardless of route.
	useEffect(() => {
		startNotificationWatchers();
	}, []);
	return (
		<>
			{/* Root-level Tauri shell bridge — pushes the persisted launch
					behavior (background mode + launch at login) on boot so both
					work even if the user never opens Settings (v1.8.0). */}
			<LaunchBehaviorBridge />
			{/* v1.8.0 — global auto-update banner (checks GitHub releases on boot
					and every 6h in the packaged app; renders only when an update
					exists or a download is in progress). */}
			<UpdateBanner />
			<Routes>
				<Route path="/onboarding" element={<OnboardingPage />} />
				<Route path="/analyzing" element={<AnalyzingPage />} />
				<Route element={<ShellLayout />}>
					<Route path="/" element={<HomeRedirect />} />
					<Route path="/brief" element={<BriefPage />} />
					<Route path="/insights/:id" element={<InsightDetailPage />} />
					<Route path="/articles/:id" element={<ArticleDetailPage />} />
					<Route path="/search" element={<SearchRedirect />} />
					<Route path="/archive" element={<ArchivePage />} />
					<Route path="/archive/search" element={<SearchPage />} />
					<Route path="/archive/collections" element={<CollectionsPage />} />
					<Route path="/archive/trash" element={<TrashPage />} />
					<Route path="/bookmarks" element={<BookmarksPage />} />
					<Route path="/docs" element={<DocsPage />} />
					<Route path="/sources" element={<SourcesPage />} />
					{/* v1.8.0 — plugins are behind the advanced-features gate: hidden
					    from the sidebar by default and redirecting when visited
					    directly while the setting is off. */}
					<Route
						path="/plugins"
						element={
							<RequireAdvanced>
								<PluginsPage />
							</RequireAdvanced>
						}
					/>
					<Route path="/plugin/:id" element={<PluginPage />} />
					<Route path="/media" element={<MediaPage />} />
					<Route path="/profile" element={<ProfilePage />} />
					<Route path="/settings" element={<SettingsPage />} />
					<Route path="/changelog" element={<ChangelogPage />} />
					<Route path="/design-system" element={<DesignSystemPage />} />
					<Route
						path="/history/search/:id"
						element={<HistorySearchDetailPage />}
					/>
					<Route
						path="/history/brief/:id"
						element={<HistoryBriefDetailPage />}
					/>
					<Route
						path="/history/generated/:id"
						element={<HistoryGeneratedDetailPage />}
					/>
				</Route>
			</Routes>
		</>
	);
}

/** Preserve `?q=` / `?mode=` when redirecting the old /search route. */
function SearchRedirect() {
	const location = useLocation();
	return <Navigate to={`/archive/search${location.search}`} replace />;
}

/**
 * Landing redirect — the welcome flow owns first launch. Once it's completed
 * or skipped (see onboarding-store), the app goes straight to the Brief.
 */
function HomeRedirect() {
	return <Navigate to={resolveHomePath(getOnboardingStatus())} replace />;
}
