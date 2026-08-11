import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { locationHasHistory } from "@/lib/router/has-history.js";
import type { Insight } from "@vorynth/types";
import { apiFetch } from "@/lib/api/config";
import {
	recordStoryView,
	setStoryViewRead,
} from "@/features/story-views/story-views-api.js";
import {
	fetchArticleDetail,
	translateArticle,
} from "@/features/reader/reader-api";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ImportanceBadge, DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { useBookmarkToggle } from "@/features/archive/use-bookmark.js";
import { ReaderActionBar } from "@/features/reader/ReaderActionBar";
import { readerActionLayout } from "@/features/reader/reader-actions.js";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { fetchSettings } from "@/features/history/history-api.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { useTranslation, useTextDirection } from "@/i18n";
import { aiErrorMessage } from "@/features/llm/ai-error.js";

/**
 * Intelligence detail view (examples/intelligence-detail.html).
 *
 * Focused reading mode for a single AI-generated insight. Note: insights only
 * exist when an LLM provider has analyzed an article — this route is only
 * reachable from a Brief entry that carries `insight`.
 *
 * The insight DTO carries `articleId` (not the URL), so when one is present we
 * also fetch the underlying article to surface a "Read original article" link
 * to the source site. Cluster-level insights (`articleId === null`) have no
 * single source and hide the link.
 */
export function InsightDetailPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	// v1.8.1 — opening the insight counts as READING; the view id returned by
	// the record call lets the "Mark read" button toggle the persisted flag.
	const [viewId, setViewId] = useState<number | null>(null);
	const [read, setRead] = useState(false);
	const [showExport, setShowExport] = useState(false);
	/** v1.8.0 — show the insight as first written instead of the translation. */
	const [showOriginal, setShowOriginal] = useState(false);
	const textDir = useTextDirection();
	const { t } = useTranslation();

	// Smart back: return to the page that opened this insight (Brief, Archive,
	// Bookmarks) when there's history to go back to; otherwise fall back to the
	// Brief. `locationHasHistory` means react-router has a prior entry (reliable
	// across trailing-slash deep links on reload).
	const goBack = () => {
		if (locationHasHistory(location.key)) navigate(-1);
		else navigate("/brief");
	};
	const { data: insight, isLoading } = useQuery({
		queryKey: ["insight", id],
		queryFn: () => apiFetch<Insight | null>(`/insights/${id}`),
		enabled: Boolean(id),
	});

	// v1.8.0 — story-view history: opening the insight records scope='insight'
	// so the Brief History tab can show which story was read, when, and on
	// which surface. Best-effort; a failed record never breaks the read.
	// v1.8.1 — opening counts as READING (read=true), and the returned view id
	// lets the "Mark read" button toggle the persisted flag.
	useEffect(() => {
		if (!insight?.articleId) return;
		void recordStoryView({
			articleId: insight.articleId,
			scope: "insight",
		})
			.then((res) => {
				setViewId(res.id);
				setRead(true);
			})
			.catch(() => undefined);
	}, [insight?.articleId]);

	// Resolve the underlying article so we can link out to the original source.
	// Only insights tied to a single article have an articleId; cluster-level
	// insights are null and skip this fetch.
	const { data: articleDetail } = useQuery({
		queryKey: ["article", insight?.articleId],
		queryFn: () => fetchArticleDetail(insight!.articleId!),
		enabled: Boolean(insight?.articleId),
	});
	const articleUrl = articleDetail?.article.url ?? null;

	// Re-translate (v1.8.0) — from the insight's More menu, forces a fresh
	// translation of the underlying story's title + body (no re-fetch). Only
	// for article-linked insights whose story was translated at least once.
	const queryClient = useQueryClient();
	const retranslateMutation = useMutation({
		mutationFn: () => translateArticle(insight!.articleId!, { force: true }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["article", insight?.articleId],
			});
			queryClient.invalidateQueries({ queryKey: ["insight", id] });
		},
	});

	// Which reader-footer actions stay pinned in the bar (Profile preference).
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const readerLayout = readerActionLayout(settings);
	// Real save — bookmark flag on the article's content item (v1.6.0).
	const bookmark = useBookmarkToggle(articleDetail?.article.contentItemId);
	// Exporter plugin panels (Story Renderer: Markdown / HTML / screenshot).
	const storyExports = usePluginStoryExports();

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<p className="font-body text-body-md text-on-surface-variant">
					Loading…
				</p>
			</section>
		);
	}

	if (!insight) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						Insight not found
					</h2>
					<Button variant="secondary" icon="arrow_back" onClick={goBack}>
						Back to Brief
					</Button>
				</GhostCard>
			</section>
		);
	}

	// v1.8.0 — an insight whose text was re-translated keeps its ORIGINAL text
	// (as first written) so the reader can show both, mirroring the article's
	// Original toggle. The toggle appears only when an original actually exists
	// and differs from the current text.
	const hasOriginalInsight = Boolean(
		insight.originalSummary && insight.originalSummary !== insight.summary,
	);
	const displayInsight =
		showOriginal && hasOriginalInsight
			? {
					summary: insight.originalSummary ?? insight.summary,
					significance: insight.originalSignificance ?? insight.significance,
					impact: insight.originalImpact ?? insight.impact,
					recommendedAction:
						insight.originalRecommendedAction ?? insight.recommendedAction,
				}
			: insight;

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			<header className="mb-12">
				{/* v1.8.1 — the top-left back button is gone: the floating action
				    bar below carries Back, so a duplicate here was redundant. */}
				<div className="mb-6 flex flex-wrap items-center justify-end gap-4">
					<DocsHelpButton sectionId="brief" />
				</div>
				<div className="mb-6 flex flex-wrap items-center gap-3">
					{/* v1.8.1 — always know which view you're in. */}
					<span className="inline-flex items-center gap-1 rounded bg-primary-container px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-on-primary-container">
						<Icon name="auto_awesome" className="text-[12px]" />
						{t("insight.viewInsight")}
					</span>
					<ImportanceBadge tier={insight.importanceTier}>
						{tierLabel(insight.importanceTier)}
					</ImportanceBadge>
					<DomainTag>{insight.category}</DomainTag>
					<span
						className="ms-auto font-mono text-mono-technical text-on-tertiary-container"
						dir={textDir(insight.generatedLanguage)}
					>
						Score {insight.importanceScore.toFixed(1)} ·{" "}
						{insight.generatedLanguage.toUpperCase()}
					</span>
					{/* The insight was re-translated into the intelligence language —
					    this pill reveals the text as first written (v1.8.0). The same
					    FILLED state chip as the brief card (v1.8.1). */}
					{hasOriginalInsight ? (
						<button
							type="button"
							onClick={() => setShowOriginal((v) => !v)}
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors hover:brightness-110 ${
								showOriginal
									? "bg-tertiary-container text-on-tertiary-container"
									: "bg-secondary-container text-on-secondary-container"
							}`}
						>
							<Icon name="compare" className="text-[12px]" />
							{showOriginal ? t("article.translated") : t("article.original")}
						</button>
					) : null}
				</div>
				<h1
					className="mb-6 font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir={textDir(displayInsight.summary)}
				>
					{displayInsight.summary}
				</h1>
				<p
					className="border-s-2 border-s-primary-fixed ps-6 font-body text-body-lg italic leading-relaxed text-on-surface-variant"
					dir={textDir(displayInsight.significance)}
				>
					{displayInsight.significance}
				</p>
			</header>

			<div className="grid grid-cols-1 gap-12">
				{/* v1.8.1 — the "Read the full article" bridge LEADS the insight
				    (right under the significance), so the user knows the full text
				    is one click away before reading the analysis. */}
				{insight.articleId ? (
					<GhostCard accentLeft>
						<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
							<div className="flex items-start gap-4">
								<Icon name="menu_book" className="text-[32px] text-secondary" />
								<div>
									<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
										{t("article.readFullArticle")}
									</h2>
									<p className="mt-1 font-body text-body-md text-on-surface-variant">
										{t("article.insightExplainer")}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-3">
								<Button
									variant="primary"
									size="md"
									icon="menu_book"
									iconRight="arrow_forward"
									onClick={() => navigate(`/articles/${insight.articleId}`)}
								>
									{t("article.openArticleReader")}
								</Button>
								{articleUrl ? (
									<a
										href={articleUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-2 font-label text-label-md text-secondary transition-colors hover:text-primary hover:underline"
									>
										<Icon name="open_in_new" className="text-[16px]" />
										{t("article.readOriginal")}
									</a>
								) : null}
							</div>
						</div>
					</GhostCard>
				) : null}

				{/* v1.8.1 — the Takeaway leads the analysis (what to do), then the
				    Technical Context fills in the why. */}
				<section className="rounded-lg bg-primary-container p-10 text-on-primary dark:bg-primary-fixed dark:text-on-primary-fixed">
					<h2 className="mb-8 flex items-center gap-3 font-headline text-headline-md">
						<Icon
							name="bolt"
							className="text-primary-fixed dark:text-on-primary-fixed"
							fill
						/>
						Takeaway
					</h2>
					<p
						className="font-body text-body-lg italic leading-relaxed"
						dir={textDir(displayInsight.recommendedAction)}
					>
						{displayInsight.recommendedAction}
					</p>
				</section>

				<GhostCard>
					<h2 className="mb-4 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						Technical Context
					</h2>
					<p
						className="font-body text-body-lg leading-relaxed text-on-surface"
						dir={textDir(displayInsight.impact)}
					>
						{displayInsight.impact}
					</p>
				</GhostCard>

				<section className="grid grid-cols-1 gap-6 md:grid-cols-3">
					<GhostCard className="flex flex-col items-center justify-center text-center">
						<span className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
							Importance Score
						</span>
						<div className="font-headline text-display-lg leading-none text-primary dark:text-primary-fixed">
							{insight.importanceScore.toFixed(1)}
						</div>
						<span className="mt-2 font-mono text-mono-technical text-on-tertiary-container">
							{insight.importanceTier.toUpperCase().replace("-", "_")}
						</span>
					</GhostCard>
					<GhostCard className="md:col-span-2">
						<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
							<Icon name="verified" className="text-base" />
							Provenance
						</h3>
						<div className="space-y-3">
							<Row label={t("insight.sourceLanguage")}>
								{t("insight.mixed")}
							</Row>
							<Row label={t("insight.outputLanguage")}>
								{insight.generatedLanguage}
							</Row>
							<Row label={t("insight.generated")}>
								{new Date(insight.createdAt).toLocaleString()}
							</Row>
						</div>
					</GhostCard>
				</section>
			</div>

			{/* Re-translate failure (v1.9.0): explain why the action couldn't run —
			    localized from the engine's structured LLM error code. Sits above the
			    floating action bar that hosts the Re-translate action. */}
			{retranslateMutation.isError ? (
				<p className="mb-4 font-body text-body-sm text-error">
					{aiErrorMessage(
						t,
						retranslateMutation.error,
						"article.retranslateFailed",
					)}
				</p>
			) : null}

			{/* Floating action bar — pinned actions up front, the rest behind the
			    More ⋮ menu (Profile → Reader actions chooses which are pinned). */}
			<ReaderActionBar
				layout={readerLayout}
				moreLabel={t("article.more")}
				moreAriaLabel={t("article.moreAria")}
				actions={[
					{
						id: "markRead",
						icon: read ? "check" : "check_circle",
						label: read ? t("article.read") : t("article.markRead"),
						// v1.8.1 — persisted to the story view row (the flag the
						// Viewed-stories history shows); best-effort when the view id
						// hasn't landed yet.
						onClick: () => {
							const next = !read;
							setRead(next);
							if (viewId != null) {
								void setStoryViewRead(viewId, next)
									.then(() =>
										queryClient.invalidateQueries({
											queryKey: ["story-views"],
										}),
									)
									.catch(() => undefined);
							}
						},
					},
					{
						id: "save",
						icon: bookmark.saved ? "bookmark_added" : "bookmark",
						label: bookmark.saved ? t("article.saved") : t("article.save"),
						onClick: bookmark.toggle,
					},
					{
						id: "share",
						icon: "ios_share",
						label: t("article.share"),
						onClick: () => {
							const shareText = articleUrl
								? `${insight.summary}\n\n${insight.significance}\n\n${articleUrl}`
								: `${insight.summary}\n\n${insight.significance}`;
							if (navigator.share) {
								void navigator.share({
									title: insight.summary,
									text: shareText,
									url: articleUrl ?? undefined,
								});
							} else {
								void navigator.clipboard.writeText(shareText);
							}
						},
					},
					...(articleUrl
						? [
								{
									id: "openOriginal" as const,
									icon: "open_in_new",
									label: t("article.original"),
									onClick: () =>
										window.open(articleUrl, "_blank", "noopener,noreferrer"),
								},
							]
						: []),
					...(storyExports.length > 0
						? [
								{
									id: "export" as const,
									icon: "file_download",
									label: t("article.export"),
									onClick: () => setShowExport(true),
								},
							]
						: []),
					// Re-translate (v1.8.0) — redoes the story's translation from
					// the More menu when it was translated at least once.
					...(insight.articleId &&
					Boolean(
						articleDetail?.article.originalTitle ||
						articleDetail?.article.translatedContent,
					)
						? [
								{
									id: "retranslate" as const,
									icon: "translate",
									label: retranslateMutation.isPending
										? t("article.retranslating")
										: t("article.retranslate"),
									busy: retranslateMutation.isPending,
									onClick: () => {
										if (!retranslateMutation.isPending)
											retranslateMutation.mutate();
									},
								},
							]
						: []),
					{
						id: "back",
						icon: "arrow_back",
						label: t("article.back"),
						onClick: goBack,
					},
				]}
			/>

			{/* Export dialog — the insight itself as exportable content: the
			    labeled triad rides along (v1.8.0) so the export renders the
			    sections the reader shows, distinct from an article export. When
			    the insight was generated bilingually (or translated), the
			    source-language version travels as `insightOriginal` too. */}
			{showExport ? (
				<ExportDialog
					content={{
						kind: "insight",
						title: insight.summary,
						body: insight.summary,
						insight: {
							significance: insight.significance,
							impact: insight.impact,
							recommendedAction: insight.recommendedAction,
						},
						insightOriginal:
							insight.originalSummary &&
							insight.originalSummary !== insight.summary
								? {
										significance:
											insight.originalSignificance ?? insight.significance,
										impact: insight.originalImpact ?? insight.impact,
										recommendedAction:
											insight.originalRecommendedAction ??
											insight.recommendedAction,
									}
								: undefined,
						url: articleUrl ?? undefined,
						source: articleDetail?.sourceName ?? undefined,
						publishedAt: articleDetail?.article.publishedAt,
					}}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</article>
	);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between border-b border-outline-variant pb-2">
			<span className="font-body text-body-md text-on-surface-variant">
				{label}
			</span>
			<span className="font-mono text-mono-technical text-primary">
				{children}
			</span>
		</div>
	);
}

function tierLabel(tier: Insight["importanceTier"]): string {
	return tier === "signal"
		? "Signal High"
		: tier === "trend"
			? "Trend"
			: "Low Noise";
}
