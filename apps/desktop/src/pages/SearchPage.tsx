import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText } from "@/components/ui/CitedText.js";
import { cn } from "@/lib/cn";
import { searchKeyword, type AskResult } from "@/features/search/search-api.js";
import { fetchEngineStatus } from "@/features/brief/brief-api.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { fetchSearchHistory } from "@/features/history/history-api.js";
import { findSearchEntryId } from "@/features/history/use-history-id.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import type { SearchResult, SearchMode } from "@vorynth/types";

/** How many keyword hits to show inline before offering "View all". */
const KEYWORD_PREVIEW_HITS = 5;

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
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const [mode, setMode] = useState<Mode>("keyword");
	const [keywordResult, setKeywordResult] = useState<SearchResult | null>(null);
	const [aiResult, setAiResult] = useState<AskResult | null>(null);

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

	// Watch for completed ask jobs and surface their result.
	useEffect(() => {
		const done = jobs.recent.find(
			(j) => j.label.startsWith("Asking AI") && j.status === "done",
		);
		if (!done) return;
		const result = done.result as AskResult | null;
		if (result && "answer" in result) {
			setAiResult(result);
		}
	}, [jobs.recent]);

	const keyword = useMutation({
		mutationFn: () => searchKeyword(q, { limit: 25 }),
		onSuccess: setKeywordResult,
	});

	const submit = () => {
		if (!q.trim()) return;
		if (mode === "keyword") keyword.mutate();
		else void startAsk(q, { budget: 24_000 });
	};

	const hasResult = Boolean(
		(mode === "ai" && aiResult) || (mode === "keyword" && keywordResult),
	);

	// Resolve the history entry id so the "View full result" button can
	// deep-link. The row exists by the time the result is shown; we just need
	// to fetch the list to learn its id.
	const { data: searchHistory, isFetching: historyFetching } = useQuery({
		queryKey: ["history", "search", "lookup", mode, q],
		queryFn: () => fetchSearchHistory(false),
		enabled: hasResult,
		staleTime: 5_000,
	});
	const entryId =
		hasResult && q.trim()
			? findSearchEntryId(searchHistory?.items ?? [], q, mode)
			: null;

	const openFull = () => {
		if (!entryId) return;
		useHistoryStore.getState().closeDrawer();
		navigate(`/history/search/${entryId}`);
	};

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			{/* Header */}
			<header className="mb-8">
				<h1 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
					Search
				</h1>
				<p className="font-body text-body-md text-on-surface-variant">
					Search across everything Vorynth has collected. Keyword is always
					available; Ask AI uses RAG over your stories.
				</p>
			</header>

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

			{/* Ask-AI background notice */}
			{mode === "ai" && askActive ? (
				<GhostCard className="mt-6 border-l-2 border-l-secondary">
					<div className="flex items-center gap-3">
						<Icon
							name="hourglass_top"
							className="animate-pulse text-secondary"
						/>
						<span className="font-body text-body-md text-on-surface">
							Asking AI in the background — you can navigate away; the answer
							appears here when it's ready (rate-limited at 5 req/min).
						</span>
					</div>
				</GhostCard>
			) : null}

			{/* Results */}
			<div className="mt-8">
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

				{!hasResult && !keyword.isPending && !askActive ? (
					<SearchEmptyState
						mode={mode}
						intelligenceEnabled={intelligenceEnabled}
					/>
				) : null}
			</div>
		</section>
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
	return (
		<div className="space-y-4">
			{/* Big rounded search input + submit, Google-style */}
			<div className="flex gap-2">
				<div className="relative flex-1">
					<span className="material-symbols-outlined pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[24px] text-on-surface-variant">
						search
					</span>
					<input
						value={q}
						onChange={(e) => onQChange(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onSubmit()}
						placeholder="Search stories…"
						autoFocus
						className={cn(
							"h-14 w-full rounded-full border border-outline-variant bg-surface-container-low pl-14 pr-5",
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
						{busy ? "Searching…" : "Search"}
					</span>
				</Button>
			</div>

			{/* Mode toggle + status */}
			<div className="flex flex-wrap items-center gap-3">
				<ModeToggle mode={mode} onChange={onModeChange} />
				{mode === "ai" && !intelligenceEnabled ? (
					<span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
						<Icon name="info" className="text-[14px]" />
						News mode — add an LLM provider to use Ask AI
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
	const options: { value: Mode; label: string; icon: string }[] = [
		{ value: "keyword", label: "Keyword", icon: "search" },
		{ value: "ai", label: "Ask AI", icon: "auto_awesome" },
	];
	const activeIndex = mode === "keyword" ? 0 : 1;
	return (
		<div className="relative inline-flex rounded-full border border-outline-variant bg-surface-container-low">
			{/* Sliding indicator — rounded pill that transitions left */}
			<div
				className="absolute inset-0 w-1/2 rounded-full bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
				style={{ left: `${activeIndex * 50}%` }}
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
	const [expanded, setExpanded] = useState(false);
	return (
		<GhostCard className="border-l-2 border-l-primary">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
					<Icon name="auto_awesome" className="text-[18px]" />
					Answer
				</h3>
				<div className="flex flex-wrap items-center gap-2">
					<CountChip
						icon="format_quote"
						label={`${result.citations.length} cited`}
					/>
					{result.tokensUsed > 0 ? (
						<CountChip
							icon="token"
							label={`${result.tokensUsed.toLocaleString()} tokens`}
						/>
					) : null}
				</div>
			</div>

			<p
				className={cn(
					"whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface",
					!expanded && "line-clamp-6",
				)}
				dir="auto"
			>
				<CitedText text={result.answer} citations={result.citations} />
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
							title={`Open: ${c.title}`}
						>
							<span className="font-mono text-secondary">[{c.n}]</span>
							<span className="max-w-[16ch] truncate">{c.sourceName}</span>
							<Icon name="open_in_new" className="text-[12px]" />
						</a>
					))}
					{result.citations.length > 3 ? (
						<span className="inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 font-mono text-[11px] text-on-tertiary-container">
							+{result.citations.length - 3} more
						</span>
					) : null}
				</div>
			) : null}

			{/* Footer actions */}
			<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon
						name={expanded ? "unfold_less" : "unfold_more"}
						className="text-[16px]"
					/>
					{expanded ? "Show less" : "Expand inline"}
				</button>
				<Button
					variant="secondary"
					size="sm"
					iconRight="arrow_forward"
					disabled={!entryId}
					title={
						entryId
							? "Open the full result"
							: historyFetching
								? "Saving to history…"
								: "Full result unavailable"
					}
					onClick={onViewFull}
				>
					{entryId ? "View full result" : "Saving…"}
				</Button>
			</div>
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
	const visible = result.hits.slice(0, KEYWORD_PREVIEW_HITS);
	const hiddenCount = result.hits.length - visible.length;
	return (
		<div>
			<div className="mb-5 flex items-baseline justify-between gap-3">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					<span className="font-headline text-headline-md text-primary normal-case tracking-normal">
						{result.totalMatches}
					</span>{" "}
					match{result.totalMatches !== 1 ? "es" : ""}
				</p>
				<p className="font-mono text-[11px] text-on-tertiary-container">
					showing {visible.length} of {result.hits.length}
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
								? "Open the full result list"
								: historyFetching
									? "Saving to history…"
									: "Full result unavailable"
						}
						onClick={onViewFull}
					>
						{entryId ? `View all ${result.hits.length} results` : "Saving…"}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function KeywordHitCard({ hit }: { hit: SearchResult["hits"][number] }) {
	return (
		<GhostCard
			interactive
			className="group transition-colors hover:border-primary"
		>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-on-secondary-container">
					<Icon name="trending_up" className="text-[12px]" />
					score {hit.score.toFixed(1)}
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
				dir="auto"
			>
				<Link to={`/articles/${hit.article.id}`}>{hit.article.title}</Link>
			</h3>

			{hit.highlight ? (
				<p
					className="mt-2 font-body text-body-md text-on-surface-variant line-clamp-3"
					dir="auto"
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
					Read
				</Link>
				<a
					href={hit.article.url}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-secondary hover:text-primary hover:underline"
				>
					<Icon name="open_in_new" className="text-[14px]" />
					Read source
				</a>
			</div>
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
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<Icon
				name={mode === "ai" ? "auto_awesome" : "search"}
				className="text-[48px] text-on-tertiary-container"
			/>
			<h3 className="font-headline text-headline-md text-on-surface">
				{mode === "ai" ? "Ask anything" : "Find stories"}
			</h3>
			<p className="max-w-md font-body text-body-md text-on-surface-variant">
				{mode === "ai"
					? intelligenceEnabled
						? "Ask a question in natural language — Vorynth answers from your collected stories, with citations."
						: "Ask AI needs an LLM provider. Add one in Settings, or switch to Keyword for instant results."
					: "Keyword search runs instantly over every title and body Vorynth has collected. Press Enter or hit Search."}
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
