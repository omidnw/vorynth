import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { Select } from "@/components/ui/Select";
import { CitedText } from "@/components/ui/CitedText.js";
import { cn } from "@/lib/cn";
import {
	advancedSearch,
	searchKeyword,
	type AskResult,
} from "@/features/search/search-api.js";
import { fetchSources } from "@/features/sources/sources-api.js";
import { fetchEngineStatus } from "@/features/brief/brief-api.js";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { fetchSearchHistory } from "@/features/history/history-api.js";
import { findSearchEntryId } from "@/features/history/use-history-id.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { useTextDirection } from "@/i18n";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import type {
	AdvancedSearchQuery,
	ImportanceTier,
	SearchResult,
	SearchMode,
	SourceCategory,
} from "@vorynth/types";

/** How many keyword hits to show inline before offering "View all". */
const KEYWORD_PREVIEW_HITS = 5;

/**
 * Whether an Ask-AI search has run in this app session. Module-level on
 * purpose: it survives SearchPage unmounts (navigate away + back), so a
 * finished job surfaces on return, while a brand-new session never
 * resurrects answers from a previous one.
 */
let askedInSession = false;

type Mode = SearchMode;

/**
 * Search page — modern, Google-like.
 *
 * Two modes the user can toggle between:
 *   - Keyword (default, no LLM): fast SQL LIKE over title + content.
 *   - Ask AI (RAG): runs as a BACKGROUND job — the user can navigate away and
 *     the answer appears when they come back. Rate-limited (5 req/min) so the
 *     API key stays safe.
 *
 * Both modes show an **inline preview** of the latest result plus a
 * "View full result" button that opens the dedicated history detail page
 * (`/history/search/:id`) with everything — full answer, all citations, or
 * every keyword hit. The history row is written server-side the moment the
 * search finishes; its id is resolved here by looking up the newest matching
 * entry.
 */
export function SearchPage() {
	const { t } = useTranslation();
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const [mode, setMode] = useState<Mode>("keyword");
	const [keywordResult, setKeywordResult] = useState<SearchResult | null>(null);
	const [aiResult, setAiResult] = useState<AskResult | null>(null);
	const [askError, setAskError] = useState<string | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [advancedResult, setAdvancedResult] = useState<SearchResult | null>(
		null,
	);

	const { data: status } = useQuery({
		queryKey: ["engine-status"],
		queryFn: fetchEngineStatus,
		refetchInterval: 30_000,
	});
	const intelligenceEnabled = status?.llm.configured ?? false;

	const { startAsk, jobs } = useJobsStore();
	const askActive = jobs.active.some((j) => j.label.startsWith("Asking AI"));

	// On mount: pick up `?q=` and `?mode=` so deep links (e.g. "re-search" from
	// the History drawer) pre-fill the box + mode and auto-submit. Mount-only.
	const initialUrlHandled = useRef(false);
	useEffect(() => {
		if (initialUrlHandled.current) return;
		initialUrlHandled.current = true;
		const urlQ = searchParams.get("q");
		const urlMode = searchParams.get("mode");
		if (urlMode === "ai" || urlMode === "keyword") setMode(urlMode);
		if (urlQ) {
			setQ(urlQ);
			setSearchParams({}, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	// Watch the newest "Asking AI" job and surface its result exactly once.
	// The store re-fetches jobs every few seconds (a new `jobs.recent` array per
	// poll), so a job-id guard stops a finished job from re-applying, and a
	// FAILED ask shows its error instead of silently resurrecting an older
	// answer. Results only surface after the user has asked something this
	// session — a fresh visit never shows a stale answer from a previous session.
	const surfacedAskJobIdRef = useRef<string | null>(null);
	useEffect(() => {
		const newest = jobs.recent.find((j) => j.label.startsWith("Asking AI"));
		if (!newest || newest.status === "queued" || newest.status === "running")
			return;
		if (!askedInSession) return;
		if (surfacedAskJobIdRef.current === newest.id) return;
		surfacedAskJobIdRef.current = newest.id;
		if (newest.status === "done") {
			const result = newest.result as AskResult | null;
			if (result && "answer" in result) {
				setAiResult(result);
				setAskError(null);
			}
		} else if (newest.status === "error") {
			setAiResult(null);
			setAskError(newest.error ?? t("llmError.error"));
		}
	}, [jobs.recent]);

	const keyword = useMutation({
		mutationFn: () => searchKeyword(q, { limit: 25 }),
		onSuccess: setKeywordResult,
	});

	const submit = () => {
		if (!q.trim()) return;
		if (mode === "keyword") {
			keyword.mutate();
		} else {
			askedInSession = true;
			// Drop the previous answer while the new ask runs — an answer for an
			// old query must never sit next to the current one.
			setAiResult(null);
			setAskError(null);
			void startAsk(q, { budget: 24_000 }).then((job) => {
				if (!job)
					setAskError(useJobsStore.getState().lastError ?? t("llmError.error"));
			});
		}
	};

	const hasResult = Boolean(
		(mode === "ai" && aiResult) || (mode === "keyword" && keywordResult),
	);

	// Resolve the history entry id so the "View full result" button can
	// deep-link. The row exists by the time the result is shown; we just need
	// to fetch the list to learn its id. In AI mode the lookup follows the
	// ANSWER's query, not the current input — they can differ (background ask).
	const lookupQuery = mode === "ai" ? (aiResult?.query ?? q) : q;
	const { data: searchHistory, isFetching: historyFetching } = useQuery({
		queryKey: ["history", "search", "lookup", mode, lookupQuery],
		queryFn: () => fetchSearchHistory(false),
		enabled: hasResult,
		staleTime: 5_000,
	});
	const entryId =
		hasResult && lookupQuery.trim()
			? findSearchEntryId(searchHistory?.items ?? [], lookupQuery, mode)
			: null;

	const openFull = () => {
		if (!entryId) return;
		useHistoryStore.getState().closeDrawer();
		navigate(`/history/search/${entryId}`);
	};
	// v1.8.1 — the search-page history button opens the drawer on the search tab.
	const openDrawer = useHistoryStore((s) => s.openDrawer);

	return (
		<ArchiveLayout
			title={t("search.title")}
			subtitle={t("search.subtitle")}
			docsSectionId="search"
		>
			{/* Hero search */}
			<SearchHero
				q={q}
				mode={mode}
				onQChange={setQ}
				onModeChange={setMode}
				onSubmit={submit}
				busy={keyword.isPending || askActive}
				intelligenceEnabled={intelligenceEnabled}
			/>

			{/* v1.8.1 — the search-history icon lives ON the search page, where
			    users instinctively look for it (it opens the drawer on the search
			    tab). */}
			<div className="mt-3 flex items-center justify-end">
				<Button
					variant="ghost"
					size="sm"
					icon="history"
					onClick={() => openDrawer("search")}
				>
					{t("history.titleSearch")}
				</Button>
			</div>

			{/* Advanced search toggle */}
			<div className="mt-4">
				<button
					type="button"
					onClick={() => {
						setShowAdvanced((v) => !v);
						setAdvancedResult(null);
					}}
					aria-expanded={showAdvanced}
					className="inline-flex items-center gap-1.5 font-label text-label-sm text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon
						name={showAdvanced ? "expand_less" : "tune"}
						className="text-[16px]"
					/>
					{showAdvanced ? t("search.hideAdvanced") : t("search.advanced")}
				</button>
			</div>

			{/* Advanced search panel */}
			{showAdvanced ? (
				<AdvancedSearchPanel
					onResult={(r) => {
						setAdvancedResult(r);
						setKeywordResult(null);
						setAiResult(null);
					}}
				/>
			) : null}

			{/* Ask-AI background notice */}
			{mode === "ai" && askActive ? (
				<GhostCard className="mt-6 border-s-2 border-s-secondary">
					<div className="flex items-center gap-3">
						<Icon
							name="hourglass_top"
							className="animate-pulse text-secondary"
						/>
						<span className="font-body text-body-md text-on-surface">
							{t("search.askingBackground")}
						</span>
					</div>
				</GhostCard>
			) : null}

			{/* v1.8.1 — a failed Ask-AI job is surfaced here, never silently
			    replaced with an older answer. */}
			{askError ? (
				<GhostCard className="mt-6 border-s-2 border-s-error">
					<p className="font-mono text-mono-technical text-error">{askError}</p>
				</GhostCard>
			) : null}

			{/* Results */}
			<div className="mt-8">
				{advancedResult ? (
					<KeywordResults
						result={advancedResult}
						entryId={null}
						historyFetching={false}
						onViewFull={() => {}}
					/>
				) : null}

				{mode === "ai" && aiResult ? (
					<AiAnswerCard
						result={aiResult}
						entryId={entryId}
						historyFetching={historyFetching}
						onViewFull={openFull}
					/>
				) : null}

				{mode === "keyword" && keyword.isPending ? (
					<SearchSkeleton />
				) : mode === "keyword" && keywordResult ? (
					<KeywordResults
						result={keywordResult}
						entryId={entryId}
						historyFetching={historyFetching}
						onViewFull={openFull}
					/>
				) : null}

				{!hasResult &&
				!keyword.isPending &&
				!askActive &&
				!askError &&
				!advancedResult ? (
					<SearchEmptyState
						mode={mode}
						intelligenceEnabled={intelligenceEnabled}
					/>
				) : null}
			</div>
		</ArchiveLayout>
	);
}

// ── Hero search ─────────────────────────────────────────────────────────────

function SearchHero({
	q,
	mode,
	onQChange,
	onModeChange,
	onSubmit,
	busy,
	intelligenceEnabled,
}: {
	q: string;
	mode: Mode;
	onQChange: (v: string) => void;
	onModeChange: (m: Mode) => void;
	onSubmit: () => void;
	busy: boolean;
	intelligenceEnabled: boolean;
}) {
	const { t } = useTranslation();
	return (
		<div className="space-y-4">
			{/* Big rounded search input + submit, Google-style */}
			<div className="flex gap-2">
				<div className="relative flex-1">
					<span className="material-symbols-outlined pointer-events-none absolute start-5 top-1/2 -translate-y-1/2 text-[24px] text-on-surface-variant">
						search
					</span>
					<input
						value={q}
						onChange={(e) => onQChange(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onSubmit()}
						placeholder={t("search.placeholder")}
						autoFocus
						className={cn(
							"h-14 w-full rounded-full border border-outline-variant bg-surface-container-low ps-14 pe-5",
							"font-body text-body-lg text-on-surface outline-none transition-all",
							"placeholder:text-on-tertiary-container",
							"focus:border-primary focus:bg-surface-container-lowest focus:shadow-[0_1px_6px_rgba(0,0,0,0.08)]",
						)}
					/>
				</div>
				<Button
					size="lg"
					icon="search"
					onClick={onSubmit}
					disabled={busy || !q.trim()}
					className="h-14 rounded-full px-6"
				>
					<span className="hidden sm:inline">
						{busy ? t("search.searching") : t("search.search")}
					</span>
				</Button>
			</div>

			{/* Mode toggle + status */}
			<div className="flex flex-wrap items-center gap-3">
				<ModeToggle mode={mode} onChange={onModeChange} />
				{mode === "ai" && !intelligenceEnabled ? (
					<span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
						<Icon name="info" className="text-[14px]" />
						{t("search.newsModeHint")}
					</span>
				) : null}
			</div>
		</div>
	);
}

function ModeToggle({
	mode,
	onChange,
}: {
	mode: Mode;
	onChange: (m: Mode) => void;
}) {
	const { t } = useTranslation();
	const options: { value: Mode; label: string; icon: string }[] = [
		{ value: "keyword", label: t("search.modeKeyword"), icon: "search" },
		{ value: "ai", label: t("search.modeAskAi"), icon: "auto_awesome" },
	];
	const activeIndex = mode === "keyword" ? 0 : 1;
	return (
		<div className="relative inline-flex rounded-full border border-outline-variant bg-surface-container-low">
			{/* Sliding indicator — rounded pill that transitions left */}
			<div
				className="absolute inset-0 w-1/2 rounded-full bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
				style={{ insetInlineStart: `${activeIndex * 50}%` }}
			/>
			{options.map((opt) => {
				const active = mode === opt.value;
				return (
					<button
						key={opt.value}
						type="button"
						onClick={() => onChange(opt.value)}
						className={cn(
							"relative z-10 flex w-28 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 font-label text-label-md uppercase tracking-wide transition-colors duration-200",
							active
								? "text-on-primary"
								: "text-on-surface-variant hover:text-primary",
						)}
					>
						<Icon name={opt.icon} className="text-[16px]" />
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}

// ── Ask AI answer ────────────────────────────────────────────────────────────

function AiAnswerCard({
	result,
	entryId,
	historyFetching,
	onViewFull,
}: {
	result: AskResult;
	entryId: string | null;
	historyFetching: boolean;
	onViewFull: () => void;
}) {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(false);
	const [showExport, setShowExport] = useState(false);
	const textDir = useTextDirection();
	const storyExports = usePluginStoryExports();
	return (
		<GhostCard className="border-s-2 border-s-primary">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
					<Icon name="auto_awesome" className="text-[18px]" />
					{t("search.answer")}
				</h3>
				<div className="flex flex-wrap items-center gap-2">
					<CountChip
						icon="format_quote"
						label={t("search.citedCount", { count: result.citations.length })}
					/>
					{result.tokensUsed > 0 ? (
						<CountChip
							icon="token"
							label={t("search.tokensUsed", {
								count: result.tokensUsed.toLocaleString(),
							})}
						/>
					) : null}
				</div>
			</div>

			<p
				className={cn(
					"whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface",
					!expanded && "line-clamp-6",
				)}
				dir={textDir(result.answer)}
			>
				<CitedText
					text={result.answer}
					citations={result.citations}
					titleFormatter={(title) => t("search.openCitation", { title })}
				/>
			</p>

			{/* Citation preview — first 3 inline */}
			{result.citations.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2">
					{result.citations.slice(0, 3).map((c) => (
						<a
							key={c.n}
							href={c.url}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label text-label-sm text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
							title={t("search.openCitation", { title: c.title })}
						>
							<span className="font-mono text-secondary">[{c.n}]</span>
							<span className="max-w-[16ch] truncate">{c.sourceName}</span>
							<Icon name="open_in_new" className="text-[12px]" />
						</a>
					))}
					{result.citations.length > 3 ? (
						<span className="inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 font-mono text-[11px] text-on-tertiary-container">
							{t("search.moreCitations", {
								count: result.citations.length - 3,
							})}
						</span>
					) : null}
				</div>
			) : null}

			{/* Footer actions */}
			<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon
							name={expanded ? "unfold_less" : "unfold_more"}
							className="text-[16px]"
						/>
						{expanded ? t("search.showLess") : t("search.expandInline")}
					</button>
					{storyExports.length > 0 ? (
						<button
							type="button"
							onClick={() => setShowExport(true)}
							className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:text-primary"
						>
							<Icon name="file_download" className="text-[16px]" />
							{t("search.export")}
						</button>
					) : null}
				</div>
				<Button
					variant="secondary"
					size="sm"
					iconRight="arrow_forward"
					disabled={!entryId}
					title={
						entryId
							? t("search.viewFullResult")
							: historyFetching
								? t("search.savingToHistory")
								: t("search.fullResultUnavailable")
					}
					onClick={onViewFull}
				>
					{entryId ? t("search.viewFullResult") : t("search.saving")}
				</Button>
			</div>

			{/* Export — the Ask-AI answer with its cited sources (v1.8.0). */}
			{showExport ? (
				<ExportDialog
					content={{
						kind: "other",
						title: result.query,
						body: [
							result.answer,
							result.citations.length > 0
								? `${t("search.exportSourcesHeader")}:\n${result.citations
										.map(
											(c) => `[${c.n}] ${c.title} — ${c.sourceName}\n${c.url}`,
										)
										.join("\n")}`
								: undefined,
						]
							.filter(Boolean)
							.join("\n\n"),
					}}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</GhostCard>
	);
}

// ── Keyword results ──────────────────────────────────────────────────────────

function KeywordResults({
	result,
	entryId,
	historyFetching,
	onViewFull,
}: {
	result: SearchResult;
	entryId: string | null;
	historyFetching: boolean;
	onViewFull: () => void;
}) {
	const { t } = useTranslation();
	const visible = result.hits.slice(0, KEYWORD_PREVIEW_HITS);
	const hiddenCount = result.hits.length - visible.length;
	return (
		<div>
			<div className="mb-5 flex items-baseline justify-between gap-3">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					<span className="font-headline text-headline-md text-primary normal-case tracking-normal">
						{result.totalMatches}
					</span>{" "}
					{t("search.matches", { count: result.totalMatches })}
				</p>
				<p className="font-mono text-[11px] text-on-tertiary-container">
					{t("search.showingOf", {
						shown: visible.length,
						total: result.hits.length,
					})}
				</p>
			</div>

			<div className="space-y-3">
				{visible.map((h) => (
					<KeywordHitCard key={h.article.id} hit={h} />
				))}
			</div>

			{hiddenCount > 0 || result.hits.length > KEYWORD_PREVIEW_HITS ? (
				<div className="mt-6 flex justify-center">
					<Button
						variant="secondary"
						size="sm"
						iconRight="arrow_forward"
						disabled={!entryId}
						title={
							entryId
								? t("search.viewFullResult")
								: historyFetching
									? t("search.savingToHistory")
									: t("search.fullResultUnavailable")
						}
						onClick={onViewFull}
					>
						{entryId
							? t("search.viewAllResults", { count: result.hits.length })
							: t("search.saving")}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function KeywordHitCard({ hit }: { hit: SearchResult["hits"][number] }) {
	const { t } = useTranslation();
	const textDir = useTextDirection();
	return (
		<GhostCard
			interactive
			className="group transition-colors hover:border-primary"
		>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-on-secondary-container">
					<Icon name="trending_up" className="text-[12px]" />
					{t("search.score", { value: hit.score.toFixed(1) })}
				</span>
				{hit.article.publishedAt ? (
					<span className="inline-flex items-center gap-1 font-mono text-[11px] text-on-tertiary-container">
						<Icon name="schedule" className="text-[12px]" />
						{new Date(hit.article.publishedAt).toLocaleDateString(undefined, {
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</span>
				) : null}
			</div>

			<h3
				className="mb-1.5 font-headline text-headline-md leading-snug text-primary transition-colors dark:text-primary-fixed group-hover:underline"
				dir={textDir(hit.article.title)}
			>
				<Link to={`/articles/${hit.article.id}`}>{hit.article.title}</Link>
			</h3>

			{/* A translated story keeps its source title searchable + visible
			    (v1.8.0) — the original sits muted under the translated title. */}
			{hit.article.originalTitle &&
			hit.article.originalTitle !== hit.article.title ? (
				<p
					className="-mt-0.5 mb-1.5 truncate font-body text-body-sm text-on-surface-variant"
					dir={textDir(hit.article.originalTitle)}
				>
					<span className="me-1 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container">
						{t("article.original")}
					</span>
					{hit.article.originalTitle}
				</p>
			) : null}

			{hit.highlight ? (
				<p
					className="mt-2 font-body text-body-md text-on-surface-variant line-clamp-3"
					dir={textDir(hit.highlight)}
				>
					{hit.highlight}
				</p>
			) : null}

			<div className="mt-3 flex items-center gap-4 border-t border-outline-variant pt-3">
				<Link
					to={`/articles/${hit.article.id}`}
					className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-primary hover:underline"
				>
					<Icon name="menu_book" className="text-[14px]" />
					{t("article.read")}
				</Link>
				<a
					href={hit.article.url}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-secondary hover:text-primary hover:underline"
				>
					<Icon name="open_in_new" className="text-[14px]" />
					{t("search.readSource")}
				</a>
			</div>
		</GhostCard>
	);
}

// ── Advanced search panel ────────────────────────────────────────────────────

const ADVANCED_DOMAINS: SourceCategory[] = [
	"ai",
	"security",
	"software-engineering",
	"cloud",
	"devops",
	"backend",
	"web-development",
	"programming-languages",
	"open-source",
	"other",
];
const ADVANCED_IMPORTANCE: ImportanceTier[] = ["signal", "trend", "low-noise"];

function AdvancedSearchPanel({
	onResult,
}: {
	onResult: (result: SearchResult) => void;
}) {
	const { t } = useTranslation();
	const [q, setQ] = useState("");
	const [domains, setDomains] = useState<SourceCategory[]>([]);
	const [importance, setImportance] = useState<ImportanceTier[]>([]);
	const [author, setAuthor] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [hasInsight, setHasInsight] = useState(false);

	const { data: sourcesData } = useQuery({
		queryKey: ["sources"],
		queryFn: fetchSources,
	});
	const sourceOptions = (sourcesData ?? []).map((s) => ({
		value: s.id,
		label: s.name,
		icon: "rss_feed",
	}));
	const [sourceId, setSourceId] = useState("");

	const mutation = useMutation({
		mutationFn: (query: AdvancedSearchQuery) => advancedSearch(query),
		onSuccess: onResult,
	});

	const toggle = <T,>(list: T[], setList: (v: T[]) => void, value: T) =>
		setList(
			list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
		);

	const runSearch = () => {
		mutation.mutate({
			q: q.trim() || undefined,
			domains: domains.length ? domains : undefined,
			importance: importance.length ? importance : undefined,
			authors: author.trim() ? [author.trim()] : undefined,
			sources: sourceId ? [sourceId] : undefined,
			from: from || undefined,
			to: to || undefined,
			hasInsight: hasInsight || undefined,
			limit: 25,
		});
	};

	return (
		<GhostCard className="mt-4">
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="tune" className="text-base" />
				{t("search.advanced")}
			</h3>
			<p className="mb-6 font-body text-body-sm text-on-tertiary-container">
				{t("search.advancedHint")}
			</p>

			{/* Row 1: keywords + author */}
			<div className="mb-4 grid gap-3 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("search.keywords")}
					</label>
					<div className="relative">
						<span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
							search
						</span>
						<input
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder={t("search.fullTextTermsPlaceholder")}
							className="w-full rounded border border-outline-variant bg-surface-container-low py-2 ps-9 pe-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("search.author")}
					</label>
					<div className="relative">
						<span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
							person
						</span>
						<input
							value={author}
							onChange={(e) => setAuthor(e.target.value)}
							placeholder={t("search.authorPlaceholder")}
							className="w-full rounded border border-outline-variant bg-surface-container-low py-2 ps-9 pe-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
						/>
					</div>
				</div>
			</div>

			{/* Row 2: source + date range */}
			<div className="mb-4 grid gap-3 sm:grid-cols-3">
				<div className="space-y-1.5">
					<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("search.source")}
					</label>
					<Select
						value={sourceId}
						onChange={setSourceId}
						aria-label={t("search.filterBySourceAria")}
						placeholder={t("search.allSources")}
						options={sourceOptions}
					/>
				</div>
				<div className="space-y-1.5">
					<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("search.collectedFrom")}
					</label>
					<input
						type="date"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
						className="w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
					/>
				</div>
				<div className="space-y-1.5">
					<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("search.to")}
					</label>
					<input
						type="date"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						className="w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
					/>
				</div>
			</div>

			{/* Row 3: domain chips */}
			<fieldset className="mb-4">
				<legend className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("search.domains")}
				</legend>
				<div className="flex flex-wrap gap-1.5">
					{ADVANCED_DOMAINS.map((d) => {
						const active = domains.includes(d);
						return (
							<button
								key={d}
								type="button"
								onClick={() => toggle(domains, setDomains, d)}
								aria-pressed={active}
								className={cn(
									"rounded-full px-3 py-1 font-label text-label-sm transition-colors",
									active
										? "bg-primary text-on-primary"
										: "border border-outline-variant text-on-surface-variant hover:border-primary",
								)}
							>
								{t(`categories.${d}`)}
							</button>
						);
					})}
				</div>
			</fieldset>

			{/* Row 4: importance + has insight */}
			<div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
				<fieldset>
					<legend className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("brief.importance")}
					</legend>
					<div className="flex flex-wrap gap-1.5">
						{ADVANCED_IMPORTANCE.map((i) => {
							const active = importance.includes(i);
							return (
								<button
									key={i}
									type="button"
									onClick={() => toggle(importance, setImportance, i)}
									aria-pressed={active}
									className={cn(
										"rounded-full px-3 py-1 font-label text-label-sm transition-colors",
										active
											? "bg-primary text-on-primary"
											: "border border-outline-variant text-on-surface-variant hover:border-primary",
									)}
								>
									{t(`tiers.${i}`)}
								</button>
							);
						})}
					</div>
				</fieldset>
				<label className="flex cursor-pointer items-center gap-2 font-body text-body-sm text-on-surface-variant">
					<input
						type="checkbox"
						checked={hasInsight}
						onChange={(e) => setHasInsight(e.target.checked)}
						className="h-4 w-4 accent-secondary"
					/>
					{t("search.hasAiAnalysis")}
				</label>
			</div>

			{/* Search button */}
			<div className="flex items-center gap-3">
				<Button icon="search" onClick={runSearch} disabled={mutation.isPending}>
					{mutation.isPending
						? t("search.searching")
						: t("search.searchWithFilters")}
				</Button>
				{domains.length > 0 ||
				importance.length > 0 ||
				author ||
				from ||
				to ||
				hasInsight ||
				sourceId ? (
					<button
						type="button"
						onClick={() => {
							setDomains([]);
							setImportance([]);
							setAuthor("");
							setFrom("");
							setTo("");
							setHasInsight(false);
							setSourceId("");
							setQ("");
						}}
						className="font-label text-label-sm text-on-surface-variant transition-colors hover:text-primary"
					>
						{t("search.clearFilters")}
					</button>
				) : null}
			</div>

			{mutation.isError ? (
				<p className="mt-3 font-mono text-mono-technical text-error">
					{(mutation.error as Error).message}
				</p>
			) : null}
		</GhostCard>
	);
}

// ── Empty / loading states ───────────────────────────────────────────────────

function SearchEmptyState({
	mode,
	intelligenceEnabled,
}: {
	mode: Mode;
	intelligenceEnabled: boolean;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<Icon
				name={mode === "ai" ? "auto_awesome" : "search"}
				className="text-[48px] text-on-tertiary-container"
			/>
			<h3 className="font-headline text-headline-md text-on-surface">
				{mode === "ai"
					? t("search.emptyTitleAi")
					: t("search.emptyTitleKeyword")}
			</h3>
			<p className="max-w-md font-body text-body-md text-on-surface-variant">
				{mode === "ai"
					? intelligenceEnabled
						? t("search.emptyAiEnabled")
						: t("search.emptyAiNeedsProvider")
					: t("search.emptyKeyword")}
			</p>
		</div>
	);
}

function SearchSkeleton() {
	return (
		<div className="space-y-3">
			{[0, 1, 2].map((i) => (
				<GhostCard key={i} className="animate-pulse">
					<div className="mb-2 flex gap-2">
						<div className="h-5 w-16 rounded-full bg-surface-container-high" />
						<div className="h-5 w-24 rounded-full bg-surface-container-high" />
					</div>
					<div className="mb-2 h-6 w-3/4 rounded bg-surface-container-high" />
					<div className="h-4 w-full rounded bg-surface-container-high" />
					<div className="mt-1 h-4 w-5/6 rounded bg-surface-container-high" />
				</GhostCard>
			))}
		</div>
	);
}

// ── Small shared bits ────────────────────────────────────────────────────────

function CountChip({ icon, label }: { icon: string; label: string }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
			<Icon name={icon} className="text-[12px]" />
			{label}
		</span>
	);
}
