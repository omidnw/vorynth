import { Routes, Route, Navigate } from "react-router-dom";
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

/**
 * App routes — mapped 1:1 to the example screens.
 *
 *   /onboarding       3-step flow (welcome → optional provider → initialize)
 *   /brief            Today's Intelligence Brief (news-first)
 *   /insights/:id     Focused reading view for one AI insight
 *   /articles/:id     Native article reader (body + on-demand media)
 *   /analyzing        Workflow progress animation
 *   /search           Keyword + AI-assisted (RAG) search across articles
 *   /sources          Source management (list / add / toggle / fetch window)
 *   /media            Locally-kept media dashboard (storage + release)
 *   /profile          User identity, custom instruction, behavior summary
 *   /settings         Engine status, LLM provider, usage, theme, data
 *   /changelog        Release notes with brand-themed codenames
 *   /design-system    Reference showcase of all primitives
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
				<Route path="/search" element={<SearchPage />} />
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
