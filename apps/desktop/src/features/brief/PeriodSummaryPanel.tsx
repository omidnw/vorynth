import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { BriefPeriod, PeriodSummary } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText } from "@/components/ui/CitedText.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { fetchBriefHistory } from "@/features/history/history-api.js";
import { findBriefEntryId } from "@/features/history/use-history-id.js";

/** How many takeaways to surface in the inline preview. */
const PREVIEW_TAKEAWAYS = 3;

/**
 * Panel that surfaces the LLM-generated "what happened this period" briefing.
 *
 * Summarize runs as a BACKGROUND job (see jobs-store). The user can navigate
 * away; when the job finishes the result is captured here on next visit.
 * Hidden in news mode (no LLM).
 *
 * The panel renders a **preview** (headline + theme chips + the first couple of
 * takeaways). A "View full brief" button opens the dedicated full-page view at
 * `/history/brief/:id`, which carries every takeaway, the recommended actions,
 * and the full citation list. The history row is written server-side the
 * moment the summarize job finishes; its id is resolved here by looking up the
 * newest matching entry.
 */
export function PeriodSummaryPanel({
	period,
	intelligenceEnabled,
}: {
	period: BriefPeriod;
	intelligenceEnabled: boolean;
}) {
	const navigate = useNavigate();
	const { startSummarize, isActive, jobs } = useJobsStore();
	const summarizeActive = isActive("summarize");
	const [summary, setSummary] = useState<PeriodSummary | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Watch the most recent summarize job and surface its result.
	useEffect(() => {
		const list = jobs.recent.find((j) => j.kind === "summarize");
		if (!list || list.status !== "done") return;
		const result = list.result as
			PeriodSummary | { ok: false; reason: string } | null;
		if (!result) return;
		if ("ok" in result && result.ok === false) {
			setSummary(null);
			setError(result.reason);
		} else if ("period" in result) {
			setSummary(result);
			setError(null);
		}
	}, [jobs.recent]);

	// Resolve the history entry id for the current summary so the "View full
	// brief" button can deep-link. The row exists by the time the job is done;
	// we just need to fetch the list to learn its id.
	const { data: briefHistory, isFetching: historyFetching } = useQuery({
		queryKey: ["history", "brief", "lookup", period],
		queryFn: () => fetchBriefHistory(false),
		enabled: intelligenceEnabled && Boolean(summary),
		staleTime: 5_000,
	});
	const entryId = summary
		? findBriefEntryId(briefHistory?.items ?? [], summary.period)
		: null;

	if (!intelligenceEnabled) return null;

	const periodLabel =
		period === "today"
			? "today"
			: period === "week"
				? "this week"
				: period === "month"
					? "this month"
					: "recently";

	return (
		<GhostCard className="mb-10 border-l-2 border-l-primary">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="font-label text-label-md uppercase tracking-widest text-primary">
						Period Briefing
					</h3>
					<p className="font-body text-body-md text-on-surface-variant">
						One cohesive intelligence summary over {periodLabel}'s stories.
					</p>
				</div>
				<Button
					variant="secondary"
					size="sm"
					icon="auto_awesome"
					onClick={() => void startSummarize({ period })}
					disabled={summarizeActive}
				>
					{summarizeActive ? "Summarizing…" : `Summarize ${periodLabel}`}
				</Button>
			</div>

			{summarizeActive ? (
				<div className="mt-4 flex items-center gap-2 border-l-2 border-secondary bg-surface-container-low px-3 py-2 rounded">
					<Icon name="sync" className="animate-spin text-secondary" />
					<span className="font-body text-body-md text-on-surface-variant">
						Running in the background — you can navigate away; the result
						appears here.
					</span>
				</div>
			) : null}

			{error ? (
				<p className="mt-4 font-mono text-mono-technical text-error">{error}</p>
			) : null}

			{summary ? (
				<div className="mt-6 space-y-5">
					<h4 className="font-headline text-headline-md leading-snug text-primary dark:text-primary-fixed">
						<CitedText text={summary.headline} citations={summary.citations} />
					</h4>

					{summary.themes.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{summary.themes.map((th) => (
								<DomainTag
									key={th.name}
									title={th.rationale}
									className={th.rationale ? "cursor-help" : undefined}
								>
									{th.name}
									{typeof th.count === "number" ? ` · ${th.count}` : ""}
								</DomainTag>
							))}
						</div>
					) : null}

					{summary.takeaways.length > 0 ? (
						<div className="space-y-2">
							<h5 className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
								Takeaways
							</h5>
							{summary.takeaways.slice(0, PREVIEW_TAKEAWAYS).map((tk, i) => (
								<p
									key={i}
									className="flex gap-2 font-body text-body-md text-on-surface"
								>
									<span className="font-mono text-secondary">→</span>
									<CitedText text={tk} citations={summary.citations} />
								</p>
							))}
							{summary.takeaways.length > PREVIEW_TAKEAWAYS ? (
								<p className="pl-5 font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
									+{summary.takeaways.length - PREVIEW_TAKEAWAYS} more in the
									full brief
								</p>
							) : null}
						</div>
					) : null}

					<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
						<p className="font-mono text-[11px] text-on-tertiary-container">
							Based on {summary.storyCount} stories from {periodLabel}.
						</p>
						<Button
							variant="secondary"
							size="sm"
							iconRight="arrow_forward"
							disabled={!entryId}
							title={
								entryId
									? "Open the full briefing"
									: historyFetching
										? "Saving to history…"
										: "Full brief unavailable"
							}
							onClick={() => {
								if (!entryId) return;
								useHistoryStore.getState().closeDrawer();
								navigate(`/history/brief/${entryId}`);
							}}
						>
							{entryId ? "View full brief" : "Saving…"}
						</Button>
					</div>
				</div>
			) : null}
		</GhostCard>
	);
}
