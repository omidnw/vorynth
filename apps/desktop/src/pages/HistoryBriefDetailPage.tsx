import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { locationHasHistory } from "@/lib/router/has-history.js";
import type { TFunction } from "i18next";
import type { BriefPeriod, PeriodSummary } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { cn } from "@/lib/cn";
import { CitedText, CitationList } from "@/components/ui/CitedText.js";
import { Tooltip } from "@/components/ui/Tooltip";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { periodSummaryExportContent } from "@/features/brief/period-summary-export.js";
import { fetchBriefEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { useTextDirection, useTranslation } from "@/i18n";

/**
 * Full-page view for a saved brief history entry (Today's Brief summary).
 *
 * Renders the cached PeriodSummary in a focused, beautiful layout with
 * headline, themes, takeaways, recommended actions, and citations.
 */
export function HistoryBriefDetailPage() {
	const { id = "" } = useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const textDir = useTextDirection();
	const [showExport, setShowExport] = useState(false);
	// v1.8.0 — a bilingual summary carries its original-language version; this
	// toggles between the user's language and the majority-story language.
	const [showOriginal, setShowOriginal] = useState(false);
	const storyExports = usePluginStoryExports();

	// Smart back: return to whatever opened this page (Archive, the drawer…)
	// when there's history; otherwise fall back to the Brief.
	const goBack = () => {
		closeDrawer();
		if (locationHasHistory(location.key)) navigate(-1);
		else navigate("/brief");
	};

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "brief", "single", id],
		queryFn: () => fetchBriefEntry(id),
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
						{t("historyBrief.notFound")}
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("historyBrief.notFoundBody")}
					</p>
					<Button
						variant="secondary"
						icon="arrow_back"
						onClick={() => navigate("/brief")}
					>
						{t("article.backToBrief")}
					</Button>
				</GhostCard>
			</section>
		);
	}

	const summary = entry.result as PeriodSummary;

	// v1.8.0 — the bilingual summary: the translated version is the user's AI
	// output language; the ORIGINAL is the majority-story language.
	const hasOriginal = Boolean(
		summary.originalHeadline && summary.originalHeadline !== summary.headline,
	);
	const displayHeadline =
		showOriginal && hasOriginal
			? (summary.originalHeadline ?? summary.headline)
			: summary.headline;
	const displayThemes =
		showOriginal && hasOriginal
			? (summary.originalThemes ?? summary.themes)
			: summary.themes;
	const displayTakeaways =
		showOriginal && hasOriginal
			? (summary.originalTakeaways ?? summary.takeaways)
			: summary.takeaways;
	const displayActions =
		showOriginal && hasOriginal
			? (summary.originalRecommendedActions ?? summary.recommendedActions)
			: summary.recommendedActions;

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
						{t("article.backToBrief")}
					</button>
					<DocsHelpButton sectionId="history" />
				</div>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<PeriodBadge period={entry.period} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt, t)}
					</span>
					<span className="h-1 w-1 rounded-full bg-outline-variant" />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{t("historyBrief.storyCount", { count: entry.storyCount })}
					</span>
					{entry.archived ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{t("historyBrief.archived")}
							</span>
						</>
					) : null}
					{/* Bilingual summary (v1.8.0): flip between the translated
						    version and the majority-story (original) version. */}
					{hasOriginal ? (
						<button
							type="button"
							onClick={() => setShowOriginal((v) => !v)}
							className="ms-auto shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
							title={t("historyBrief.showOriginalTitle")}
						>
							{showOriginal ? t("article.translated") : t("article.original")}
						</button>
					) : null}
				</div>

				<h1
					className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir={textDir(displayHeadline)}
				>
					<CitedText text={displayHeadline} citations={summary.citations} />
				</h1>

				<p className="mt-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t(periodTitleKey(entry.period), {
						count: summary.storyCount,
					})}
				</p>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* Themes */}
			{displayThemes.length > 0 ? (
				<div className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon name="category" className="me-1.5 inline-block text-[16px]" />
						{t("historyBrief.themes")}
					</h3>
					{/* The chips follow the displayed summary language: in the
						    translated (RTL) state the whole row must flow right-to-left. */}
					<div
						className="flex flex-wrap gap-2"
						dir={textDir(displayThemes[0]?.name ?? "")}
					>
						{displayThemes.map((th) => {
							// RTL theme names (translated Persian/Arabic) keep their
							// natural script — no letter-spacing, proper dir.
							const rtl = textDir(th.name) === "rtl";
							const chip = (
								<span
									dir={textDir(th.name)}
									className={cn(
										"inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-label text-label-sm uppercase text-on-tertiary-container transition-colors hover:border-primary hover:text-primary",
										rtl ? "tracking-normal" : "tracking-widest",
										th.rationale ? "cursor-help" : undefined,
									)}
								>
									{th.name}
									{typeof th.count === "number" ? (
										<span
											className={cn(
												"inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-variant text-[10px] font-mono",
												rtl ? "mr-1.5" : "ml-1.5",
											)}
										>
											{th.count}
										</span>
									) : null}
								</span>
							);
							// Rationale tooltips are content in the theme's language —
							// native `title` can't be directed, so use the themed
							// Tooltip with the label's script direction.
							return th.rationale ? (
								<Tooltip
									key={th.name}
									label={th.rationale}
									dir={textDir(th.rationale)}
									wrap
								>
									{chip}
								</Tooltip>
							) : (
								<Fragment key={th.name}>{chip}</Fragment>
							);
						})}
					</div>
				</div>
			) : null}

			{/* Takeaways */}
			{displayTakeaways.length > 0 ? (
				<section className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon
							name="lightbulb"
							className="me-1.5 inline-block text-[16px]"
						/>
						{t("historyBrief.takeaways")}
					</h3>
					<GhostCard className="space-y-4 border-s-2 border-s-primary">
						{displayTakeaways.map((tk, i) => (
							<div key={i} className="flex gap-3">
								<span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary-container font-mono text-[11px] font-semibold text-on-primary-container">
									{i + 1}
								</span>
								<p
									className="font-body text-body-lg leading-relaxed text-on-surface"
									dir={textDir(tk)}
								>
									<CitedText text={tk} citations={summary.citations} />
								</p>
							</div>
						))}
					</GhostCard>
				</section>
			) : null}

			{/* Recommended Actions */}
			{displayActions.length > 0 ? (
				<section className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon
							name="bolt"
							className="me-1.5 inline-block text-[16px]"
							fill
						/>
						{t("historyBrief.recommendedActions")}
					</h3>
					<div className="space-y-3">
						{displayActions.map((a, i) => (
							<GhostCard
								key={i}
								className="border-s-2 border-s-primary bg-primary-container/10"
							>
								<p
									className="font-body text-body-lg italic leading-relaxed text-on-surface"
									dir={textDir(a)}
								>
									<CitedText text={a} citations={summary.citations} />
								</p>
							</GhostCard>
						))}
					</div>
				</section>
			) : null}

			{/* Citations */}
			<CitationList citations={summary.citations} />

			{/* Metadata footer */}
			<div className="mt-8 rounded-lg bg-surface-container-low px-6 py-4">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex flex-wrap items-center gap-4 font-mono text-[12px] text-on-tertiary-container">
						<span>
							<Icon
								name="menu_book"
								className="me-1 inline-block text-[14px]"
							/>
							{t("historyBrief.storyCount", {
								count: summary.storyCount,
							})}
						</span>
						<span>
							<Icon
								name="auto_awesome"
								className="me-1 inline-block text-[14px]"
							/>
							{t("historyBrief.aiGenerated")}
						</span>
					</div>
					<Button
						variant="secondary"
						size="sm"
						icon="refresh"
						onClick={() => {
							closeDrawer();
							navigate(`/brief`);
						}}
					>
						{t("historyBrief.regenerateOnBrief")}
					</Button>
				</div>
			</div>

			{/* Floating action footer */}
			<footer className="fixed bottom-12 start-1/2 z-50 flex -translate-x-1/2 rtl:translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label={t("historyBrief.regenerate")}
					onClick={() => {
						closeDrawer();
						navigate("/brief");
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="content_copy"
					label={t("historyBrief.copyHeadline")}
					onClick={() => {
						void navigator.clipboard
							.writeText(summary.headline)
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

			{/* Export — the full period briefing as a self-contained document
			    (headline + themes + takeaways + actions + sources, v1.8.0). */}
			{showExport ? (
				<ExportDialog
					content={periodSummaryExportContent(summary)}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function PeriodBadge({ period }: { period: BriefPeriod }) {
	const { t } = useTranslation();
	const label =
		period === "today"
			? t("period.today")
			: period === "week"
				? t("period.thisWeek")
				: period === "month"
					? t("period.thisMonth")
					: t("period.allTime");
	const icon =
		period === "today"
			? "today"
			: period === "week"
				? "date_range"
				: period === "month"
					? "calendar_month"
					: "all_inclusive";
	return (
		<span className="inline-flex items-center gap-1.5 rounded bg-secondary-container px-2.5 py-1 font-label text-[11px] uppercase tracking-widest text-on-secondary-container">
			<Icon name={icon} className="text-[14px]" />
			{label}
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
	if (sec < 60) return t("historyBrief.justNow");
	const min = Math.round(sec / 60);
	if (min < 60) return t("historyBrief.minAgo", { count: min });
	const hr = Math.round(min / 60);
	if (hr < 24) return t("historyBrief.hoursAgo", { count: hr });
	const day = Math.round(hr / 24);
	if (day < 30) return t("historyBrief.daysAgo", { count: day });
	const mo = Math.round(day / 30);
	if (mo < 12) return t("historyBrief.monthsAgo", { count: mo });
	return t("historyBrief.yearsAgo", { count: Math.round(mo / 12) });
}

function periodTitleKey(period: BriefPeriod): string {
	switch (period) {
		case "today":
			return "historyBrief.titleToday";
		case "week":
			return "historyBrief.titleWeek";
		case "month":
			return "historyBrief.titleMonth";
		case "all":
			return "historyBrief.titleAll";
	}
}
