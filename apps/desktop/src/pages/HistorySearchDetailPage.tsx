import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AskResult, SearchResult } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText, CitationList } from "@/components/ui/CitedText.js";
import { fetchSearchEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";
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
	const navigate = useNavigate();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "search", "single", id],
		queryFn: () => fetchSearchEntry(id),
		enabled: Boolean(id),
	});

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<div className="flex items-center justify-center gap-2 text-on-surface-variant">
					<Icon name="sync" className="animate-spin text-[18px]" />
					<span className="font-mono text-[11px] uppercase tracking-widest">
						Loading…
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
						Search entry not found
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						This search result may have been deleted or is no longer available.
					</p>
					<Button
						variant="secondary"
						icon="arrow_back"
						onClick={() => navigate("/brief")}
					>
						Back to Brief
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
				<Link
					to="/search"
					onClick={() => closeDrawer()}
					className="mb-6 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					Back to Search
				</Link>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<ModeBadge mode={entry.mode} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt)}
					</span>
					<span className="hidden h-1 w-1 rounded-full bg-outline-variant sm:inline-block" />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{entry.hitCount} hit{entry.hitCount !== 1 ? "s" : ""}
					</span>
					{entry.tokensUsed > 0 ? (
						<>
							<span className="hidden h-1 w-1 rounded-full bg-outline-variant sm:inline-block" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{entry.tokensUsed.toLocaleString()} tokens
							</span>
						</>
					) : null}
				</div>

				<h1 className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed">
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
						{isAi ? "Re-ask AI" : "Re-search"} this query
					</Button>
				</div>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* AI Answer */}
			{ai ? (
				<GhostCard className="border-l-2 border-l-primary">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-primary">
						<Icon
							name="auto_awesome"
							className="mr-1.5 inline-block text-[16px]"
						/>
						Answer
					</h3>
					<p
						className="whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface"
						dir="auto"
					>
						<CitedText text={ai.answer} citations={ai.citations} />
					</p>
					<div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[12px] text-on-tertiary-container">
						<span>
							{ai.citations.length} cited source
							{ai.citations.length !== 1 ? "s" : ""}
						</span>
						{ai.tokensUsed > 0 ? (
							<span>· {ai.tokensUsed.toLocaleString()} tokens</span>
						) : null}
					</div>
					<CitationList citations={ai.citations} />
				</GhostCard>
			) : null}

			{/* Keyword hits */}
			{keyword ? (
				<section>
					<h3 className="mb-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{keyword.hits.length} hit{keyword.hits.length !== 1 ? "s" : ""}
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
												score {h.score.toFixed(1)}
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
											dir="auto"
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
												dir="auto"
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
										Source
									</a>
								</div>
							</GhostCard>
						))}
					</div>
				</section>
			) : null}

			{/* Floating action footer */}
			<footer className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label={isAi ? "Re-ask AI" : "Re-search"}
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
					label="Copy query"
					onClick={() => {
						void navigator.clipboard.writeText(entry.query);
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="arrow_back"
					label="Back"
					onClick={() => {
						closeDrawer();
						navigate("/search");
					}}
				/>
			</footer>
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: SearchMode }) {
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
				className="mr-1 text-[13px]"
			/>
			{mode === "ai" ? "Ask AI" : "Keyword"}
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

function timeAgo(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return "just now";
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 30) return `${day}d ago`;
	const mo = Math.round(day / 30);
	if (mo < 12) return `${mo}mo ago`;
	return `${Math.round(mo / 12)}y ago`;
}
