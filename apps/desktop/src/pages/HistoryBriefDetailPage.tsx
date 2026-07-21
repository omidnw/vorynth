import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BriefPeriod, PeriodSummary } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText, CitationList } from "@/components/ui/CitedText.js";
import { fetchBriefEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";

/**
 * Full-page view for a saved brief history entry (Today's Brief summary).
 *
 * Renders the cached PeriodSummary in a focused, beautiful layout with
 * headline, themes, takeaways, recommended actions, and citations.
 */
export function HistoryBriefDetailPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "brief", "single", id],
		queryFn: () => fetchBriefEntry(id),
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
						Briefing not found
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						This period summary may have been deleted or is no longer available.
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

	const summary = entry.result as PeriodSummary;

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			{/* Header */}
			<header className="mb-12">
				<Link
					to="/brief"
					onClick={() => closeDrawer()}
					className="mb-6 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					Back to Brief
				</Link>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<PeriodBadge period={entry.period} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt)}
					</span>
					<span className="h-1 w-1 rounded-full bg-outline-variant" />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{entry.storyCount} stor{entry.storyCount !== 1 ? "ies" : "y"}
					</span>
					{entry.archived ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								archived
							</span>
						</>
					) : null}
				</div>

				<h1 className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed">
					<CitedText text={summary.headline} citations={summary.citations} />
				</h1>

				<p className="mt-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{periodLabel(entry.period)} Brief — {summary.storyCount} stories
				</p>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* Themes */}
			{summary.themes.length > 0 ? (
				<div className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon name="category" className="mr-1.5 inline-block text-[16px]" />
						Themes
					</h3>
					<div className="flex flex-wrap gap-2">
						{summary.themes.map((th) => (
							<span
								key={th.name}
								title={th.rationale}
								className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container transition-colors hover:border-primary hover:text-primary"
							>
								{th.name}
								{typeof th.count === "number" ? (
									<span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-variant text-[10px] font-mono">
										{th.count}
									</span>
								) : null}
							</span>
						))}
					</div>
				</div>
			) : null}

			{/* Takeaways */}
			{summary.takeaways.length > 0 ? (
				<section className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon
							name="lightbulb"
							className="mr-1.5 inline-block text-[16px]"
						/>
						Takeaways
					</h3>
					<GhostCard className="space-y-4 border-l-2 border-l-primary">
						{summary.takeaways.map((tk, i) => (
							<div key={i} className="flex gap-3">
								<span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary-container font-mono text-[11px] font-semibold text-on-primary-container">
									{i + 1}
								</span>
								<p
									className="font-body text-body-lg leading-relaxed text-on-surface"
									dir="auto"
								>
									<CitedText text={tk} citations={summary.citations} />
								</p>
							</div>
						))}
					</GhostCard>
				</section>
			) : null}

			{/* Recommended Actions */}
			{summary.recommendedActions.length > 0 ? (
				<section className="mb-10">
					<h3 className="mb-4 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon
							name="bolt"
							className="mr-1.5 inline-block text-[16px]"
							fill
						/>
						Recommended Actions
					</h3>
					<div className="space-y-3">
						{summary.recommendedActions.map((a, i) => (
							<GhostCard
								key={i}
								className="border-l-2 border-l-primary bg-primary-container/10"
							>
								<p
									className="font-body text-body-lg italic leading-relaxed text-on-surface"
									dir="auto"
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
								className="mr-1 inline-block text-[14px]"
							/>
							{summary.storyCount} stori{summary.storyCount !== 1 ? "es" : "y"}
						</span>
						<span>
							<Icon
								name="auto_awesome"
								className="mr-1 inline-block text-[14px]"
							/>
							AI-generated
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
						Regenerate on Brief
					</Button>
				</div>
			</div>

			{/* Floating action footer */}
			<footer className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label="Regenerate"
					onClick={() => {
						closeDrawer();
						navigate("/brief");
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="content_copy"
					label="Copy headline"
					onClick={() => {
						void navigator.clipboard.writeText(summary.headline);
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="arrow_back"
					label="Back"
					onClick={() => {
						closeDrawer();
						navigate("/brief");
					}}
				/>
			</footer>
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function PeriodBadge({ period }: { period: BriefPeriod }) {
	const label =
		period === "today"
			? "Today"
			: period === "week"
				? "This Week"
				: period === "month"
					? "This Month"
					: "All Time";
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

function periodLabel(period: BriefPeriod): string {
	switch (period) {
		case "today":
			return "Today's";
		case "week":
			return "This Week's";
		case "month":
			return "This Month's";
		case "all":
			return "All-Time";
	}
}
