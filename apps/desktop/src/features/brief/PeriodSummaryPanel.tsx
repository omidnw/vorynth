import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BriefPeriod, PeriodSummary } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { CitedText } from "@/components/ui/CitedText.js";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { useTextDirection } from "@/i18n";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { fetchBriefHistory } from "@/features/history/history-api.js";
import { findBriefEntryId } from "@/features/history/use-history-id.js";
import { periodSummaryExportContent } from "@/features/brief/period-summary-export.js";

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
	const { t } = useTranslation();
	const textDir = useTextDirection();
	const { startSummarize, isActive, jobs } = useJobsStore();
	const summarizeActive = isActive("summarize");
	const [summary, setSummary] = useState<PeriodSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showExport, setShowExport] = useState(false);
	// v1.8.1 — a CLOSE button hides the panel (per page view); a fresh summary
	// brings it back. The surfaced-job guard below keeps a routine poll from
	// re-showing a panel the user just closed on this page.
	const [dismissed, setDismissed] = useState(false);
	// v1.8.0 — a bilingual summary carries its original-language version; this
	// toggles between the user's language and the majority-story language.
	const [showOriginal, setShowOriginal] = useState(false);
	const storyExports = usePluginStoryExports();

	// Watch the most recent summarize job and surface its result. The store
	// re-fetches jobs every few seconds (new `jobs.recent` array every poll), so
	// only a job we haven't surfaced yet may re-show the panel — otherwise a
	// routine poll would reopen a panel the user just closed.
	const surfacedJobIdRef = useRef<string | null>(null);
	useEffect(() => {
		const list = jobs.recent.find((j) => j.kind === "summarize");
		if (!list || list.status !== "done") return;
		if (surfacedJobIdRef.current === list.id) return;
		surfacedJobIdRef.current = list.id;
		const result = list.result as
			PeriodSummary | { ok: false; reason: string } | null;
		if (!result) return;
		if ("ok" in result && result.ok === false) {
			setSummary(null);
			setError(result.reason);
			setDismissed(false);
		} else if ("period" in result) {
			setSummary(result);
			setError(null);
			setDismissed(false);
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

	const periodLabel = t(
		period === "today"
			? "periodSummary.periodToday"
			: period === "week"
				? "periodSummary.periodWeek"
				: period === "month"
					? "periodSummary.periodMonth"
					: "periodSummary.recently",
	);

	// v1.8.0 — the bilingual summary: the translated version is the user's AI
	// output language; the ORIGINAL is the majority-story language. The toggle
	// appears when a distinct original exists.
	const hasOriginal = Boolean(
		summary?.originalHeadline && summary.originalHeadline !== summary.headline,
	);
	const displayHeadline =
		showOriginal && hasOriginal
			? (summary?.originalHeadline ?? summary?.headline ?? "")
			: (summary?.headline ?? "");
	const displayThemes =
		showOriginal && hasOriginal
			? (summary?.originalThemes ?? summary?.themes ?? [])
			: (summary?.themes ?? []);
	const displayTakeaways =
		showOriginal && hasOriginal
			? (summary?.originalTakeaways ?? summary?.takeaways ?? [])
			: (summary?.takeaways ?? []);

	// v1.8.1 — CLOSE hides the panel (a new summary brings it back).
	if (dismissed) return null;

	return (
		<GhostCard className="mb-10 border-s-2 border-s-primary">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="font-label text-label-md uppercase tracking-widest text-primary">
						{t("periodSummary.title")}
					</h3>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("periodSummary.intro", { period: periodLabel })}
					</p>
				</div>
				<Button
					variant="secondary"
					size="sm"
					icon="auto_awesome"
					onClick={() => void startSummarize({ period })}
					disabled={summarizeActive}
				>
					{summarizeActive
						? t("periodSummary.summarizing")
						: t("periodSummary.summarize", { period: periodLabel })}
				</Button>
				{/* Bilingual summary (v1.8.0): flip between the translated version
				    and the majority-story (original) version. */}
				{hasOriginal ? (
					<button
						type="button"
						onClick={() => setShowOriginal((v) => !v)}
						className="shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
						title={t("periodSummary.showOriginalHint")}
					>
						{showOriginal ? t("article.translated") : t("article.original")}
					</button>
				) : null}
			</div>

			{summarizeActive ? (
				<div className="mt-4 flex items-center gap-2 border-s-2 border-s-secondary bg-surface-container-low px-3 py-2 rounded">
					<Icon name="sync" className="animate-spin-reverse text-secondary" />
					<span className="font-body text-body-md text-on-surface-variant">
						{t("periodSummary.runningHint")}
					</span>
				</div>
			) : null}

			{error ? (
				<p className="mt-4 font-mono text-mono-technical text-error">{error}</p>
			) : null}

			{summary ? (
				<div className="mt-6 space-y-5">
					<h4
						className="font-headline text-headline-md leading-snug text-primary dark:text-primary-fixed"
						dir={textDir(displayHeadline)}
					>
						<CitedText text={displayHeadline} citations={summary.citations} />
					</h4>

					{displayThemes.length > 0 ? (
						// The chips follow the displayed summary language: in the
						// translated (RTL) state the whole row must flow right-to-left.
						<div
							className="flex flex-wrap gap-2"
							dir={textDir(displayThemes[0]?.name ?? "")}
						>
							{displayThemes.map((th) => {
								// RTL theme names (translated Persian/Arabic) must keep
								// their natural script — no letter-spacing, proper dir.
								const rtl = textDir(th.name) === "rtl";
								const chip = (
									<span
										dir={textDir(th.name)}
										className={cn(
											"inline-flex items-center rounded border border-outline-variant px-2 py-0.5 font-label text-label-sm uppercase text-on-tertiary-container",
											rtl ? "tracking-normal" : "tracking-widest",
											th.rationale ? "cursor-help" : undefined,
										)}
									>
										{th.name}
										{typeof th.count === "number" ? ` · ${th.count}` : ""}
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
					) : null}

					{displayTakeaways.length > 0 ? (
						<div className="space-y-2">
							<h5 className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
								{t("periodSummary.takeaways")}
							</h5>
							{displayTakeaways.slice(0, PREVIEW_TAKEAWAYS).map((tk, i) => {
								const rtl = textDir(tk) === "rtl";
								return (
									<p
										key={i}
										className="flex gap-2 font-body text-body-md text-on-surface"
										dir={textDir(tk)}
									>
										{/* RTL: the bullet leads from the right and points
											    into the text (mirrored, like the full brief). */}
										<span className="font-mono text-secondary">
											{rtl ? "←" : "→"}
										</span>
										<CitedText text={tk} citations={summary.citations} />
									</p>
								);
							})}
							{displayTakeaways.length > PREVIEW_TAKEAWAYS ? (
								<p className="ps-5 font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
									{t("periodSummary.moreInFullBrief", {
										count: displayTakeaways.length - PREVIEW_TAKEAWAYS,
									})}
								</p>
							) : null}
						</div>
					) : null}

					<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
						<p className="font-mono text-[11px] text-on-tertiary-container">
							{t("periodSummary.basedOn", {
								count: summary.storyCount,
								period: periodLabel,
							})}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							{/* v1.8.1 — dismiss the panel (the next summary brings it back). */}
							<Button
								variant="ghost"
								size="sm"
								icon="close"
								onClick={() => setDismissed(true)}
							>
								{t("common.close")}
							</Button>
							{storyExports.length > 0 ? (
								<Button
									variant="secondary"
									size="sm"
									icon="file_download"
									onClick={() => setShowExport(true)}
								>
									{t("search.export")}
								</Button>
							) : null}
							<Button
								variant="secondary"
								size="sm"
								iconRight="arrow_forward"
								disabled={!entryId}
								title={
									entryId
										? t("periodSummary.openFullBrief")
										: historyFetching
											? t("search.savingToHistory")
											: t("periodSummary.fullBriefUnavailable")
								}
								onClick={() => {
									if (!entryId) return;
									useHistoryStore.getState().closeDrawer();
									navigate(`/history/brief/${entryId}`);
								}}
							>
								{entryId
									? t("periodSummary.viewFullBrief")
									: t("search.saving")}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			{/* Export — the period briefing as a self-contained document (v1.8.0). */}
			{summary && showExport ? (
				<ExportDialog
					content={periodSummaryExportContent(summary)}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</GhostCard>
	);
}
