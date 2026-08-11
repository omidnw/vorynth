import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import type { TFunction } from "i18next";
import type { BriefEntry, BriefPeriod } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { DismissibleTip } from "@/components/ui/DismissibleTip";
import { BriefItemView } from "@/features/brief/BriefItemView.js";
import { PeriodSummaryPanel } from "@/features/brief/PeriodSummaryPanel.js";
import { fetchRange } from "@/features/brief/brief-api.js";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";

// ── Persisted state (survives navigation, clears on explicit reset) ─────────

const BRIEF_PREFIX = "brief:";

function usePersistedState<T>(key: string, fallback: T) {
	const [value, setValue] = useState<T>(() => {
		try {
			const raw = localStorage.getItem(BRIEF_PREFIX + key);
			return raw !== null ? (JSON.parse(raw) as T) : fallback;
		} catch {
			return fallback;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(BRIEF_PREFIX + key, JSON.stringify(value));
		} catch {
			/* storage full or blocked — silently degrade */
		}
	}, [key, value]);

	return [value, setValue] as const;
}

/** Built-in defaults used by the Clear button. */
const DEFAULTS = {
	period: "today" as BriefPeriod,
	sort: "newest" as SortMode,
	domain: null as string | null,
};

/** Period filter chips — labels come from the `period.*` namespace. */
function periods(t: TFunction): { value: BriefPeriod; label: string }[] {
	return [
		{ value: "today", label: t("period.today") },
		{ value: "week", label: t("period.thisWeek") },
		{ value: "month", label: t("period.thisMonth") },
		{ value: "all", label: t("period.allTime") },
	];
}

type SortMode = "newest" | "most-relevant" | "most-important";

/** Sort-mode chips — labels come from the `sort.*` namespace. */
function sortModes(
	t: TFunction,
): { value: SortMode; label: string; icon: string }[] {
	return [
		{ value: "newest", label: t("sort.newest"), icon: "schedule" },
		{
			value: "most-relevant",
			label: t("sort.mostRelevant"),
			icon: "trending_up",
		},
		{
			value: "most-important",
			label: t("sort.mostImportant"),
			icon: "priority_high",
		},
	];
}

/** Domain-filter chips — category slugs, displayed via `categories.*`. */
const DOMAIN_CATEGORIES: BriefEntry["category"][] = [
	"ai",
	"software-engineering",
	"security",
	"cloud",
	"backend",
	"devops",
];

/**
 * Today's Intelligence Brief page.
 *
 * News-first. The range selector (Today / Week / Month / All) re-queries the
 * feed; the "Summarize this period" panel (visible only when an LLM is
 * configured) writes one cohesive briefing over the period's stories.
 *
 * Collect + Generate run as BACKGROUND jobs (see jobs-store). The user can
 * navigate away and the work continues on the engine; the floating JobsTray
 * shows live progress and this page re-fetches while a job is active.
 */
export function BriefPage() {
	const [period, setPeriod] = usePersistedState<BriefPeriod>("period", "today");
	const [domainFilter, setDomainFilter] = usePersistedState<string | null>(
		"domain",
		null,
	);
	const [limit, setLimit] = useState(30);
	const [sort, setSort] = usePersistedState<SortMode>("sort", "newest");
	const clearPersisted = useCallback(() => {
		setPeriod(DEFAULTS.period);
		setSort(DEFAULTS.sort);
		setDomainFilter(DEFAULTS.domain);
		// Remove stored keys so stale values don't linger.
		for (const k of ["period", "sort", "domain"]) {
			try {
				localStorage.removeItem(BRIEF_PREFIX + k);
			} catch {
				/* ignore */
			}
		}
	}, [setPeriod, setSort, setDomainFilter]);

	const { t } = useTranslation();
	const navigate = useNavigate();
	const { startCollect, startGenerate, isActive, lastError } = useJobsStore();
	const collectActive = isActive("collect");
	const generateActive = isActive("generate");
	const busy = collectActive || generateActive;

	// v1.9.0 — "Update my brief": collect new stories then regenerate the AI
	// analysis in one tap (runs sequentially; the page stays disabled while busy).
	const runUpdate = async () => {
		await startCollect();
		await startGenerate({ cap: 10, period });
	};

	const { data, isLoading } = useQuery({
		queryKey: ["reports", "range", period],
		queryFn: () => fetchRange(period),
		// Re-fetch quickly while a job is running so new stories appear live.
		refetchInterval: busy ? 2_000 : 60_000,
	});

	// Profile → "drag selects text" (v1.8.0): when on (default) dragging over a
	// card selects text instead of opening it; off = any press-release opens.
	const { data: appSettings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		staleTime: 60_000,
	});
	const dragSelectsText = appSettings?.["ui.dragSelectsText"] ?? true;
	// v1.8.1 — brief-wide default view (Auto / Article / Insights), shared with
	// the story cards below.
	const queryClient = useQueryClient();
	const defaultView =
		(appSettings?.["brief.defaultView"] as
			"auto" | "article" | "insights" | undefined) ?? "auto";
	const setDefaultView = (view: "auto" | "article" | "insights") => {
		void patchSettings({ "brief.defaultView": view });
		queryClient.invalidateQueries({ queryKey: ["app-settings"] });
	};
	// v1.9.0 — in-brief search (title + body, case-insensitive). Filtering is
	// applied FIRST, then the existing sort mode + page size.
	const [briefQ, setBriefQ] = useState("");
	const searching = briefQ.trim() !== "";

	const intelligenceEnabled = data?.intelligenceEnabled ?? false;
	const allEntries = data?.entries ?? [];

	// v1.9.0 — apply the domain filter + the in-brief search FIRST, then sort.
	const visible = useMemo(() => {
		const q = briefQ.trim().toLowerCase();
		const filtered = allEntries.filter((e) => {
			if (
				domainFilter !== null &&
				categoryLabel(t, e.category) !== domainFilter
			)
				return false;
			if (q) {
				const title = (e.article.title ?? "").toLowerCase();
				const content = (e.article.content ?? "").toLowerCase();
				if (!title.includes(q) && !content.includes(q)) return false;
			}
			return true;
		});
		const sorted = [...filtered];
		if (sort === "newest") {
			sorted.sort(
				(a, b) => toMs(b.article.publishedAt) - toMs(a.article.publishedAt),
			);
		} else if (sort === "most-important") {
			sorted.sort((a, b) => b.score - a.score);
		} else {
			// most-relevant: the engine's default ordering is already relevance;
			// keep it. (No re-sort needed.)
		}
		// Re-rank after sort so the visible rank numbers are 1..N.
		return sorted.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
	}, [allEntries, domainFilter, sort, limit, briefQ, t]);

	/**
	 * Total entries after the domain filter + in-brief search (independent of
	 * the page size) — feeds both the "N of M" count and the Load-more button.
	 */
	const filteredCount = useMemo(() => {
		const q = briefQ.trim().toLowerCase();
		return allEntries.filter((e) => {
			if (
				domainFilter !== null &&
				categoryLabel(t, e.category) !== domainFilter
			)
				return false;
			if (q) {
				const title = (e.article.title ?? "").toLowerCase();
				const content = (e.article.content ?? "").toLowerCase();
				if (!title.includes(q) && !content.includes(q)) return false;
			}
			return true;
		}).length;
	}, [allEntries, domainFilter, briefQ, t]);

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-8">
				{/* Title row — the help button sits directly opposite the title,
				    not next to the mode/stats line below. */}
				<div className="flex flex-wrap items-start justify-between gap-4">
					<h2 className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
						{t("brief.title")}
					</h2>
					<DocsHelpButton sectionId="brief" />
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-4 font-label text-label-md text-on-tertiary-container">
					<span className="flex items-center gap-1">
						<Icon name="timer" className="text-[18px]" />
						{data ? t("brief.stories", { count: data.totalStories }) : "—"}
					</span>
					<span className="h-1 w-1 rounded-full bg-outline-variant" />
					<span>
						{data ? t("brief.sources", { count: data.totalSources }) : "—"}
					</span>
					<span className="h-1 w-1 rounded-full bg-outline-variant" />
					<span
						className={
							intelligenceEnabled
								? "text-secondary"
								: "text-on-tertiary-container"
						}
					>
						{intelligenceEnabled
							? t("brief.intelligenceOn")
							: t("brief.newsMode")}
					</span>
				</div>
			</header>

			{/* Action row — the one-tap Update leads; Collect / Generate Brief
			    stay for granular control; Search Page points at the archive. */}
			<div className="mt-6 flex flex-wrap items-center gap-2">
				<Button
					icon="bolt"
					iconFill
					onClick={() => void runUpdate()}
					disabled={busy}
					title={t("brief.updateBriefHint")}
				>
					{t("brief.updateBrief")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					icon="bookmark"
					onClick={() => navigate("/bookmarks")}
					title={t("brief.savedStories")}
				>
					Bookmarks
				</Button>
				{/* v1.9.0 — search is its own page; this button says so. */}
				<Button
					variant="ghost"
					size="sm"
					icon="search"
					onClick={() => navigate("/archive/search")}
				>
					{t("brief.searchPage")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					icon="sync"
					onClick={() => void startCollect()}
					disabled={busy}
				>
					{collectActive ? t("common.collecting") : t("common.collect")}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					icon="bolt"
					iconFill={intelligenceEnabled}
					onClick={() => void startGenerate({ cap: 10, period })}
					disabled={busy}
					title={t("brief.generateHint")}
				>
					{/* v1.8.1 — clearer than "Generate Brief": this button only
					    regenerates the AI analysis, it doesn't collect. */}
					{generateActive
						? t("brief.generatingAnalysis")
						: t("brief.generateAnalysis")}
				</Button>
			</div>
			{/* v1.8.1 — default view for the story cards (Auto / Article /
			    Insights) on its OWN row, separate from the action buttons.
			    Insight default + a configured provider auto-generates missing
			    insights after a collect. w-fit keeps the box the size of its
			    content — it never stretches across the page. */}
			<div
				className="mt-4 flex w-fit items-center gap-1 rounded border border-outline-variant p-0.5"
				role="group"
				aria-label={t("brief.viewSelectorAria")}
			>
				{(
					[
						{ value: "auto", label: t("brief.viewAuto") },
						{ value: "article", label: t("brief.viewArticle") },
						{ value: "insights", label: t("brief.viewInsights") },
					] as const
				).map((v) => (
					<button
						key={v.value}
						type="button"
						aria-pressed={defaultView === v.value}
						onClick={() => setDefaultView(v.value)}
						title={v.label}
						className={`rounded px-2 py-1 font-label text-label-sm transition-colors ${
							defaultView === v.value
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:bg-surface-variant"
						}`}
					>
						{v.label}
					</button>
				))}
			</div>
			{/* v1.8.1 — one-time explanation of the selector above; "Don't show
			    this again" persists in ui.tipsDismissed. */}
			<DismissibleTip id="brief-view-selector" className="mt-3">
				{t("brief.viewSelectorHint")}
			</DismissibleTip>

			{/* Filters — period + sort (v1.9.0: labelled, bordered section). */}
			<div className="mt-8 border-t border-outline-variant pt-4">
				<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
					{t("brief.sectionFilters")}
				</span>
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<span className="me-2 font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
							Range
						</span>
						{periods(t).map((p) => (
							<button
								key={p.value}
								onClick={() => setPeriod(p.value)}
								className={`rounded px-3 py-1 font-label text-label-md transition-colors ${
									period === p.value
										? "bg-primary text-on-primary"
										: "text-on-surface-variant hover:bg-surface-variant"
								}`}
							>
								{p.label}
							</button>
						))}
					</div>
					<div className="flex items-center gap-2">
						<span className="me-1 font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
							Sort
						</span>
						{sortModes(t).map((m) => (
							<button
								key={m.value}
								onClick={() => setSort(m.value)}
								title={m.label}
								className={`flex items-center gap-1 rounded px-2 py-1 font-label text-label-sm transition-colors ${
									sort === m.value
										? "bg-secondary-container text-on-secondary-container"
										: "text-on-surface-variant hover:bg-surface-variant"
								}`}
							>
								<Icon name={m.icon} className="text-[16px]" />
								<span className="hidden sm:inline">{m.label}</span>
							</button>
						))}
						<div className="ms-1 h-5 w-px bg-outline-variant" />
						<button
							type="button"
							onClick={clearPersisted}
							title={t("brief.resetFilters")}
							className="flex items-center gap-1 rounded px-2 py-1 font-label text-label-sm text-on-surface-variant transition-colors hover:text-error"
						>
							<Icon name="clear" className="text-[16px]" />
							<span className="hidden sm:inline">{t("brief.clear")}</span>
						</button>
					</div>
				</div>
			</div>

			{/* Live-collect indicator */}
			{collectActive ? (
				<div className="mt-6 flex items-center gap-3 border-s-2 border-s-secondary bg-surface-container-low px-4 py-3 rounded">
					<Icon name="sync" className="animate-spin-reverse text-secondary" />
					<span className="font-body text-body-md text-on-surface">
						Collecting from sources in the background — you can navigate away;
						the list updates live as stories arrive.
					</span>
				</div>
			) : null}

			{/* Period summary panel (LLM-only). v1.8.1 — breathing room from the
			    sort row above (the box used to sit flush against the chips). */}
			<div className="mt-5">
				<PeriodSummaryPanel
					period={period}
					intelligenceEnabled={intelligenceEnabled}
				/>
			</div>

			{/* Search + domains — the in-brief search lives below the domain chips. */}
			<div className="mt-8 border-t border-outline-variant pt-4">
				<div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
					<div className="flex items-center gap-3">
						<span className="font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
							{t("brief.domains")}
						</span>
						<button
							onClick={() => setDomainFilter(null)}
							className={`rounded px-3 py-1 font-label text-label-md transition-colors ${
								domainFilter === null
									? "bg-secondary-container text-on-secondary-container"
									: "text-on-surface-variant hover:text-primary"
							}`}
						>
							{t("brief.all")}
						</button>
						{DOMAIN_CATEGORIES.map((d) => {
							const label = t(`categories.${d}`);
							return (
								<button
									key={d}
									onClick={() => setDomainFilter(label)}
									className={`px-3 py-1 font-label text-label-md transition-colors hover:text-primary ${
										domainFilter === label
											? "text-primary underline underline-offset-4"
											: "text-on-surface-variant"
									}`}
								>
									{label}
								</button>
							);
						})}
					</div>
				</div>

				{/* v1.9.0 — in-brief search: title OR body, case-insensitive. */}
				<div className="mt-4 max-w-md">
					<Input
						value={briefQ}
						onChange={(e) => setBriefQ(e.target.value)}
						placeholder={t("brief.searchStories")}
						icon="search"
						aria-label={t("brief.searchStories")}
					/>
					{searching ? (
						<p className="mt-2 flex items-center gap-1.5 font-body text-body-sm text-on-surface-variant">
							{filteredCount === 0 ? (
								<>
									<Icon name="search_off" className="text-[16px]" />
									<span>{t("brief.searchNoResults")}</span>
								</>
							) : (
								t("brief.searchCount", {
									shown: visible.length,
									total: filteredCount,
								})
							)}
						</p>
					) : null}
				</div>
			</div>

			{/* Stories */}
			<div className="mt-8 border-t border-outline-variant pt-4">
				<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
					{t("brief.sectionStories")}
				</span>
				<div className="mt-6">
					{isLoading ? (
						<LoadingState />
					) : visible.length > 0 ? (
						<div className="space-y-20">
							{visible.map((entry: BriefEntry) => (
								<BriefItemView
									key={entry.article.id}
									entry={entry}
									intelligenceEnabled={intelligenceEnabled}
									dragSelectsText={dragSelectsText}
								/>
							))}
						</div>
					) : searching ? (
						<p className="flex items-center gap-1.5 font-body text-body-md text-on-surface-variant">
							<Icon name="search_off" className="text-[18px]" />
							{t("brief.searchNoResults")}
						</p>
					) : (
						<EmptyState
							onCollect={() => void startCollect()}
							busy={busy}
							error={lastError}
						/>
					)}
				</div>

				{filteredCount > visible.length ? (
					<div className="mt-12 border-t border-outline-variant pt-8 text-center">
						<Button
							variant="secondary"
							iconRight="expand_more"
							onClick={() => setLimit((l) => l + 30)}
						>
							Load {Math.min(30, filteredCount - visible.length)} more stories
						</Button>
					</div>
				) : null}

				{!intelligenceEnabled && allEntries.length > 0 ? (
					<div
						className="mt-8 flex cursor-pointer items-center gap-3 border-s-2 border-s-secondary bg-surface-container-low px-5 py-3 rounded transition-colors hover:bg-surface-container-high"
						onClick={() => navigate("/settings")}
						role="button"
						tabIndex={0}
					>
						<Icon name="tips_and_updates" className="text-secondary" />
						<p className="font-body text-body-md text-on-surface-variant">
							<Trans t={t} i18nKey="brief.newsHint">
								<span className="underline">{t("nav.settings")}</span>
							</Trans>
						</p>
					</div>
				) : null}

				{intelligenceEnabled ? (
					<div className="mt-4">
						<DomainTag>{t("brief.intelligenceActive")}</DomainTag>
					</div>
				) : null}
			</div>
		</section>
	);
}

function LoadingState() {
	return (
		<div className="space-y-6">
			{[0, 1, 2].map((i) => (
				<GhostCard key={i} className="animate-pulse">
					<div className="mb-4 flex gap-3">
						<div className="h-6 w-20 rounded bg-surface-container-high" />
						<div className="h-6 w-32 rounded bg-surface-container-high" />
					</div>
					<div className="mb-3 h-8 w-3/4 rounded bg-surface-container-high" />
					<div className="h-4 w-full rounded bg-surface-container-high" />
				</GhostCard>
			))}
		</div>
	);
}

function EmptyState({
	onCollect,
	busy,
	error,
}: {
	onCollect: () => void;
	busy: boolean;
	error: string | null;
}) {
	const { t } = useTranslation();
	return (
		<GhostCard className="flex flex-col items-center gap-4 py-16 text-center">
			<Icon
				name="insights"
				className="text-[48px] text-on-tertiary-container"
			/>
			<h3 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
				{t("brief.emptyRangeTitle")}
			</h3>
			<p className="max-w-md font-body text-body-md text-on-surface-variant">
				<Trans t={t} i18nKey="brief.emptyRangeBody">
					Either no articles have been collected yet, or none fall in the
					selected period. Hit <em>Collect</em> to pull fresh stories — no API
					key required.
				</Trans>
			</p>
			{error ? (
				<p className="max-w-md font-mono text-mono-technical text-error">
					{error}
				</p>
			) : null}
			<div className="flex gap-3 pt-2">
				<Button icon="sync" onClick={onCollect} disabled={busy}>
					{busy ? t("brief.empty.working") : t("brief.empty.collect")}
				</Button>
			</div>
			<DomainTag className="mt-4">{t("app.localEngine")}</DomainTag>
		</GhostCard>
	);
}

/**
 * Coerce a publishedAt value (Date or ISO string, as JSON-deserialized by the
 * engine) to a millisecond timestamp. Returns 0 when missing/invalid so the
 * sort comparator never throws.
 */
function toMs(d: Date | string | null | undefined): number {
	if (!d) return 0;
	if (d instanceof Date) return d.getTime();
	const ms = Date.parse(d);
	return Number.isFinite(ms) ? ms : 0;
}

/** Map a SourceCategory to the short label shown in the filter chips. */
function categoryLabel(t: TFunction, category: BriefEntry["category"]): string {
	return t(`categories.${category}`);
}
