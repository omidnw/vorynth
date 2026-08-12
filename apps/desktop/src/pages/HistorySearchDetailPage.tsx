import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { locationHasHistory } from "@/lib/router/has-history.js";
import type { TFunction } from "i18next";
import type { AskResult, SearchResult } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText, CitationList } from "@/components/ui/CitedText.js";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { fetchSearchEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { useTextDirection, useTranslation } from "@/i18n";
import { cn } from "@/lib/cn";
import type { SearchMode } from "@vorynth/types";

/**
 * Full-page view for a saved search history entry.
 *
 * Renders the cached result (Ask-AI answer or keyword hits) in a focused,
 * beautiful layout. A floating action bar offers re-search and share.
 */
export function HistorySearchDetailPage() {
	const { id = "" } = useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const textDir = useTextDirection();
	const [showExport, setShowExport] = useState(false);
	const storyExports = usePluginStoryExports();

	// Smart back: return to whatever opened this page (Archive, Search, the
	// drawer…) when there's history to go back to; otherwise fall back to the
	// search page. `locationHasHistory` means react-router has a prior entry in
	// its history stack (same idiom as ArticleDetailPage, reliable across
	// trailing-slash deep links on reload).
	const goBack = () => {
		closeDrawer();
		if (locationHasHistory(location.key)) navigate(-1);
		else navigate("/search");
	};

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "search", "single", id],
		queryFn: () => fetchSearchEntry(id),
		enabled: Boolean(id),
	});

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<div className="flex items-center justify-center gap-2 text-on-surface-variant">
					<Icon name="sync" className="animate-spin-reverse text-[18px]" />
					<span className="font-mono text-[11px] uppercase tracking-widest">
						{t("article.loading")}
					</span>
				</div>
			</section>
		);
	}

	if (!entry) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						{t("historySearch.notFound")}
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("historySearch.notFoundBody")}
					</p>
					<Button
						variant="secondary"
						icon="arrow_back"
						onClick={() => navigate("/search")}
					>
						{t("historySearch.backToSearch")}
					</Button>
				</GhostCard>
			</section>
		);
	}

	const result = entry.result;
	const isAi = entry.mode === "ai";
	const ai = isAi ? (result as AskResult) : null;
	const keyword = !isAi ? (result as SearchResult) : null;

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			{/* Header */}
			<header className="mb-12">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<button
						type="button"
						onClick={goBack}
						className="inline-flex cursor-pointer items-center gap-2 font-label text-label-md uppercase text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon name="arrow_back" className="text-[18px]" />
						{t("historySearch.backToSearch")}
					</button>
					<DocsHelpButton sectionId="history" />
				</div>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<ModeBadge mode={entry.mode} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt, t)}
					</span>
					<span className="hidden h-1 w-1 rounded-full bg-outline-variant sm:inline-block" />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{t("historySearch.hitCount", { count: entry.hitCount })}
					</span>
					{entry.tokensUsed > 0 ? (
						<>
							<span className="hidden h-1 w-1 rounded-full bg-outline-variant sm:inline-block" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{t("historySearch.tokens", {
									count: entry.tokensUsed.toLocaleString(),
								})}
							</span>
						</>
					) : null}
				</div>

				<h1
					className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir={textDir(entry.title)}
				>
					{entry.title}
				</h1>

				<div className="mt-6 flex gap-2">
					<Button
						variant="secondary"
						size="sm"
						icon="refresh"
						onClick={() => {
							closeDrawer();
							navigate(
								`/search?q=${encodeURIComponent(entry.query)}&mode=${entry.mode}`,
							);
						}}
					>
						{isAi
							? t("historySearch.reaskQuery")
							: t("historySearch.researchQuery")}
					</Button>
				</div>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* AI Answer */}
			{ai ? (
				<GhostCard className="border-s-2 border-s-primary">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-primary">
						<Icon
							name="auto_awesome"
							className="me-1.5 inline-block text-[16px]"
						/>
						{t("historySearch.answer")}
					</h3>
					<p
						className="whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface"
						dir={textDir(ai.answer)}
					>
						<CitedText text={ai.answer} citations={ai.citations} />
					</p>
					<div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[12px] text-on-tertiary-container">
						<span>
							{t("historySearch.citedSources", {
								count: ai.citations.length,
							})}
						</span>
						{ai.tokensUsed > 0 ? (
							<span>
								·{" "}
								{t("historySearch.tokens", {
									count: ai.tokensUsed.toLocaleString(),
								})}
							</span>
						) : null}
					</div>
					<CitationList citations={ai.citations} />
				</GhostCard>
			) : null}

			{/* Keyword hits */}
			{keyword ? (
				<section>
					<h3 className="mb-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("historySearch.hitCount", { count: keyword.hits.length })}
					</h3>
					<div className="space-y-4">
						{keyword.hits.map((h) => (
							<GhostCard
								key={h.article.id}
								interactive
								className="group transition-colors hover:border-primary"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="mb-2 flex items-center gap-2">
											<span className="font-mono text-[11px] text-secondary">
												{t("historySearch.score", {
													value: h.score.toFixed(1),
												})}
											</span>
											{h.article.publishedAt ? (
												<span className="font-mono text-[11px] text-on-tertiary-container">
													·{" "}
													{new Date(h.article.publishedAt).toLocaleDateString()}
												</span>
											) : null}
										</div>
										<h4
											className="font-headline text-headline-md text-primary dark:text-primary-fixed group-hover:underline"
											dir={textDir(h.article.title)}
										>
											<Link
												to={`/articles/${h.article.id}`}
												onClick={() => closeDrawer()}
											>
												{h.article.title}
											</Link>
										</h4>
										{h.highlight ? (
											<p
												className="mt-2 font-body text-body-md text-on-surface-variant line-clamp-3"
												dir={textDir(h.highlight)}
											>
												{h.highlight}
											</p>
										) : null}
									</div>
									<a
										href={h.article.url}
										target="_blank"
										rel="noreferrer"
										className="mt-1 flex flex-none items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-secondary hover:text-primary"
									>
										<Icon name="open_in_new" className="text-[14px]" />
										{t("historySearch.source")}
									</a>
								</div>
							</GhostCard>
						))}
					</div>
				</section>
			) : null}

			{/* Floating action footer */}
			<footer className="fixed bottom-12 start-1/2 z-50 flex -translate-x-1/2 rtl:translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label={isAi ? t("historySearch.reask") : t("historySearch.research")}
					onClick={() => {
						closeDrawer();
						navigate(
							`/search?q=${encodeURIComponent(entry.query)}&mode=${entry.mode}`,
						);
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="content_copy"
					label={t("historySearch.copyQuery")}
					onClick={() => {
						void navigator.clipboard
							.writeText(entry.query)
							.catch(() => undefined);
					}}
				/>
				{storyExports.length > 0 ? (
					<>
						<div className="mx-2 h-6 w-px bg-outline-variant" />
						<ActionBtn
							icon="file_download"
							label={t("article.export")}
							onClick={() => setShowExport(true)}
						/>
					</>
				) : null}
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="arrow_back"
					label={t("common.back")}
					onClick={goBack}
				/>
			</footer>

			{/* Export — the answer (with its cited sources) or the hit list as a
			    self-contained document (v1.8.0). */}
			{showExport ? (
				<ExportDialog
					content={{
						kind: "other",
						title: entry.title,
						body: ai
							? [
									ai.answer,
									ai.citations.length > 0
										? `${t("historySearch.exportSourcesHeader")}:\n${ai.citations
												.map(
													(c) =>
														`[${c.n}] ${c.title} — ${c.sourceName}\n${c.url}`,
												)
												.join("\n")}`
										: undefined,
								]
									.filter(Boolean)
									.join("\n\n")
							: keyword
								? keyword.hits
										.map(
											(h, i) =>
												`${i + 1}. ${h.article.title}\n   ${
													h.article.url
												}${h.highlight ? `\n   ${h.highlight}` : ""}`,
										)
										.join("\n\n")
								: "",
					}}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: SearchMode }) {
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				"inline-flex flex-none items-center rounded px-2 py-0.5 font-label text-[11px] uppercase tracking-widest",
				mode === "ai"
					? "bg-primary-container text-on-primary-container"
					: "bg-surface-variant text-on-surface-variant",
			)}
		>
			<Icon
				name={mode === "ai" ? "auto_awesome" : "search"}
				className="me-1 text-[13px]"
			/>
			{mode === "ai" ? t("types.ai-ask") : t("historySearch.keyword")}
		</span>
	);
}

function ActionBtn({
	icon,
	label,
	onClick,
}: {
	icon: string;
	label: string;
	onClick?: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-surface-container-high"
		>
			<Icon name={icon} className="text-[20px]" />
			<span className="font-label text-label-md uppercase tracking-wide">
				{label}
			</span>
		</button>
	);
}

function timeAgo(iso: string, t: TFunction): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return t("historySearch.justNow");
	const min = Math.round(sec / 60);
	if (min < 60) return t("historySearch.minAgo", { count: min });
	const hr = Math.round(min / 60);
	if (hr < 24) return t("historySearch.hoursAgo", { count: hr });
	const day = Math.round(hr / 24);
	if (day < 30) return t("historySearch.daysAgo", { count: day });
	const mo = Math.round(day / 30);
	if (mo < 12) return t("historySearch.monthsAgo", { count: mo });
	return t("historySearch.yearsAgo", { count: Math.round(mo / 12) });
}
