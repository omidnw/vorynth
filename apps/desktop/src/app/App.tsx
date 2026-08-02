import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ShellLayout } from "./ShellLayout.js";
import { BriefPage } from "@/pages/BriefPage.js";
import { SourcesPage } from "@/pages/SourcesPage.js";
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
	return (
		<Routes>
			<Route path="/onboarding" element={<OnboardingPage />} />
			<Route path="/analyzing" element={<AnalyzingPage />} />
			<Route element={<ShellLayout />}>
				<Route path="/" element={<Navigate to="/brief" replace />} />
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
				<Route path="/media" element={<MediaPage />} />
				<Route path="/profile" element={<ProfilePage />} />
				<Route path="/settings" element={<SettingsPage />} />
				<Route path="/changelog" element={<ChangelogPage />} />
				<Route path="/design-system" element={<DesignSystemPage />} />
				<Route
					path="/history/search/:id"
					element={<HistorySearchDetailPage />}
				/>
				<Route path="/history/brief/:id" element={<HistoryBriefDetailPage />} />
				<Route
					path="/history/generated/:id"
					element={<HistoryGeneratedDetailPage />}
				/>
			</Route>
		</Routes>
	);
}

/** Preserve `?q=` / `?mode=` when redirecting the old /search route. */
function SearchRedirect() {
	const location = useLocation();
	return <Navigate to={`/archive/search${location.search}`} replace />;
}
