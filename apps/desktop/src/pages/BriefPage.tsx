import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BriefEntry, BriefPeriod } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { BriefItemView } from "@/features/brief/BriefItemView.js";
import { PeriodSummaryPanel } from "@/features/brief/PeriodSummaryPanel.js";
import { fetchRange } from "@/features/brief/brief-api.js";
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

const PERIODS: { value: BriefPeriod; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This Week" },
	{ value: "month", label: "This Month" },
	{ value: "all", label: "All Time" },
];

type SortMode = "newest" | "most-relevant" | "most-important";

const SORT_MODES: { value: SortMode; label: string; icon: string }[] = [
	{ value: "newest", label: "Newest", icon: "schedule" },
	{ value: "most-relevant", label: "Most relevant", icon: "trending_up" },
	{ value: "most-important", label: "Most important", icon: "priority_high" },
];

const DOMAINS = [
	"AI",
	"Software Engineering",
	"Security",
	"Cloud",
	"Backend",
	"DevOps",
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

	const { startCollect, startGenerate, isActive, lastError } = useJobsStore();
	const collectActive = isActive("collect");
	const generateActive = isActive("generate");
	const busy = collectActive || generateActive;

	const { data, isLoading } = useQuery({
		queryKey: ["reports", "range", period],
		queryFn: () => fetchRange(period),
		// Re-fetch quickly while a job is running so new stories appear live.
		refetchInterval: busy ? 2_000 : 60_000,
	});

	const intelligenceEnabled = data?.intelligenceEnabled ?? false;
	const allEntries = data?.entries ?? [];

	// Apply the chosen sort mode + domain filter client-side.
	const visible = useMemo(() => {
		const filtered =
			domainFilter !== null
				? allEntries.filter((e) => categoryLabel(e.category) === domainFilter)
				: allEntries;
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
	}, [allEntries, domainFilter, sort, limit]);

	/** Total entries after the domain filter (independent of the page size). */
	const filteredCount = () =>
		domainFilter !== null
			? allEntries.filter((e) => categoryLabel(e.category) === domainFilter)
					.length
			: allEntries.length;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						Today's Intelligence Brief
					</h2>
					<div className="flex flex-wrap items-center gap-4 font-label text-label-md text-on-tertiary-container">
						<span className="flex items-center gap-1">
							<Icon name="timer" className="text-[18px]" />
							{data ? `${data.totalStories} stories` : "—"}
						</span>
						<span className="h-1 w-1 rounded-full bg-outline-variant" />
						<span>{data ? `${data.totalSources} sources` : "—"}</span>
						<span className="h-1 w-1 rounded-full bg-outline-variant" />
						<span
							className={
								intelligenceEnabled
									? "text-secondary"
									: "text-on-tertiary-container"
							}
						>
							{intelligenceEnabled ? "LLM intelligence on" : "News mode"}
						</span>
					</div>
				</div>
				<div className="flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						icon="sync"
						onClick={() => void startCollect()}
						disabled={busy}
					>
						{collectActive ? "Collecting…" : "Collect"}
					</Button>
					<Button
						variant="secondary"
						size="sm"
						icon="bolt"
						iconFill={intelligenceEnabled}
						onClick={() => void startGenerate({ cap: 10, period })}
						disabled={busy}
					>
						{generateActive ? "Generating…" : "Generate Brief"}
					</Button>
				</div>
			</header>

			{/* Period + sort selectors */}
			<div className="mb-8 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="mr-2 font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
						Range
					</span>
					{PERIODS.map((p) => (
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
					<span className="mr-1 font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
						Sort
					</span>
					{SORT_MODES.map((m) => (
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
					<div className="ml-1 h-5 w-px bg-outline-variant" />
					<button
						type="button"
						onClick={clearPersisted}
						title="Reset filters to defaults"
						className="flex items-center gap-1 rounded px-2 py-1 font-label text-label-sm text-on-surface-variant transition-colors hover:text-error"
					>
						<Icon name="clear" className="text-[16px]" />
						<span className="hidden sm:inline">Clear</span>
					</button>
				</div>
			</div>

			{/* Live-collect indicator */}
			{collectActive ? (
				<div className="mb-6 flex items-center gap-3 border-l-2 border-secondary bg-surface-container-low px-4 py-3 rounded">
					<Icon name="sync" className="animate-spin text-secondary" />
					<span className="font-body text-body-md text-on-surface">
						Collecting from sources in the background — you can navigate away;
						the list updates live as stories arrive.
					</span>
				</div>
			) : null}

			{/* Period summary panel (LLM-only) */}
			<PeriodSummaryPanel
				period={period}
				intelligenceEnabled={intelligenceEnabled}
			/>

			{/* Filters bar */}
			<div className="mb-12 flex items-center gap-8 overflow-x-auto border-b border-outline-variant pb-6 no-scrollbar">
				<div className="flex items-center gap-3">
					<span className="font-label text-label-sm uppercase tracking-wider text-on-surface-variant">
						Domains
					</span>
					<button
						onClick={() => setDomainFilter(null)}
						className={`rounded px-3 py-1 font-label text-label-md transition-colors ${
							domainFilter === null
								? "bg-secondary-container text-on-secondary-container"
								: "text-on-surface-variant hover:text-primary"
						}`}
					>
						All
					</button>
					{DOMAINS.map((d) => (
						<button
							key={d}
							onClick={() => setDomainFilter(d)}
							className={`px-3 py-1 font-label text-label-md transition-colors hover:text-primary ${
								domainFilter === d
									? "text-primary underline underline-offset-4"
									: "text-on-surface-variant"
							}`}
						>
							{d}
						</button>
					))}
				</div>
			</div>

			{isLoading ? (
				<LoadingState />
			) : visible.length > 0 ? (
				<div className="space-y-20">
					{visible.map((entry: BriefEntry) => (
						<BriefItemView key={entry.article.id} entry={entry} />
					))}
				</div>
			) : (
				<EmptyState
					onCollect={() => void startCollect()}
					busy={busy}
					error={lastError}
				/>
			)}

			{filteredCount() > visible.length ? (
				<div className="mt-20 border-t border-outline-variant pt-12 text-center">
					<Button
						variant="secondary"
						iconRight="expand_more"
						onClick={() => setLimit((l) => l + 30)}
					>
						Load {Math.min(30, filteredCount() - visible.length)} more stories
					</Button>
				</div>
			) : null}

			{!intelligenceEnabled && allEntries.length > 0 ? (
				<div className="mt-8 flex items-center gap-3 border-l-2 border-secondary bg-surface-container-low px-5 py-3 rounded">
					<Icon name="tips_and_updates" className="text-secondary" />
					<p className="font-body text-body-md text-on-surface-variant">
						<strong className="text-on-surface">News mode.</strong> Add an LLM
						provider in Settings to generate the Why-it-matters / Impact /
						Recommended-Action triad and the Period Briefing.
					</p>
				</div>
			) : null}

			{intelligenceEnabled ? (
				<div className="mt-4">
					<DomainTag>LLM Intelligence Active</DomainTag>
				</div>
			) : null}
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
	return (
		<GhostCard className="flex flex-col items-center gap-4 py-16 text-center">
			<Icon
				name="search_insights"
				className="text-[48px] text-on-tertiary-container"
			/>
			<h3 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
				No stories in this range
			</h3>
			<p className="max-w-md font-body text-body-md text-on-surface-variant">
				Either no articles have been collected yet, or none fall in the selected
				period. Hit <em>Collect</em> to pull fresh stories — no API key
				required.
			</p>
			{error ? (
				<p className="max-w-md font-mono text-mono-technical text-error">
					{error}
				</p>
			) : null}
			<div className="flex gap-3 pt-2">
				<Button icon="sync" onClick={onCollect} disabled={busy}>
					{busy ? "Working…" : "Collect Now"}
				</Button>
			</div>
			<DomainTag className="mt-4">Local Engine Active</DomainTag>
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
function categoryLabel(category: BriefEntry["category"]): string {
	const map: Record<BriefEntry["category"], string> = {
		ai: "AI",
		"software-engineering": "Software Engineering",
		"programming-languages": "Programming Languages",
		"web-development": "Web Development",
		backend: "Backend",
		devops: "DevOps",
		cloud: "Cloud",
		security: "Security",
		"open-source": "Open Source",
		other: "Other",
	};
	return map[category] ?? "Other";
}
