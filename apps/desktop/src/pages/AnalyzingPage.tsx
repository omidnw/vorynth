import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { aiErrorCode, aiErrorMessage } from "@/features/llm/ai-error.js";
import type { WorkflowNodeName, WorkflowNodeStatus } from "@vorynth/types";

/**
 * Analyzing screen — kicks off a real generate job and visualizes its progress.
 *
 * On mount, starts `POST /jobs/generate` (background). The stage list advances
 * based on the job's `progress.fraction` (0→1 maps across the 8 workflow
 * stages). When the job reaches a terminal state (done/error), navigates to
 * the Brief.
 */
const STAGES: { node: WorkflowNodeName; labelKey: string; icon: string }[] = [
	{ node: "collector", labelKey: "analyzing.collecting", icon: "download" },
	{ node: "normalizer", labelKey: "analyzing.normalizing", icon: "tune" },
	{ node: "dedup", labelKey: "analyzing.dedup", icon: "filter_alt" },
	{ node: "classifier", labelKey: "analyzing.classifying", icon: "category" },
	{ node: "ranker", labelKey: "analyzing.ranking", icon: "leaderboard" },
	{ node: "analyzer", labelKey: "analyzing.analyzing", icon: "psychology" },
	{ node: "localizer", labelKey: "analyzing.localizing", icon: "translate" },
	{ node: "report", labelKey: "analyzing.report", icon: "description" },
];

export function AnalyzingPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { startGenerate, jobs } = useJobsStore();
	const [started, setStarted] = useState(false);

	// Find the active generate job (may have been started on another page).
	const genJob =
		jobs.active.find((j) => j.kind === "generate") ??
		jobs.recent.find((j) => j.kind === "generate");

	// Start a generate job on mount if none is running.
	useEffect(() => {
		if (started) return;
		const active = jobs.active.some((j) => j.kind === "generate");
		if (!active) {
			void startGenerate({ cap: 10 });
		}
		setStarted(true);
	}, [started, jobs.active, startGenerate]);

	// Navigate to Brief when the job completes.
	useEffect(() => {
		if (!genJob) return;
		if (
			genJob.status === "done" ||
			genJob.status === "error" ||
			genJob.status === "canceled"
		) {
			const t = setTimeout(() => navigate("/brief"), 800);
			return () => clearTimeout(t);
		}
	}, [genJob?.status, navigate]);

	// Map the job's progress fraction to a stage index (0..7).
	const fraction = genJob?.progress.fraction ?? 0;
	const currentStage = Math.min(
		STAGES.length - 1,
		Math.floor(fraction * STAGES.length),
	);

	const statusOf = (idx: number): WorkflowNodeStatus => {
		if (!genJob || genJob.status === "error")
			return idx === 0 ? "running" : "pending";
		if (genJob.status === "done") return "done";
		if (idx < currentStage) return "done";
		if (idx === currentStage) return "running";
		return "pending";
	};

	return (
		<section className="mx-auto flex min-h-screen w-full max-w-max-content-width flex-col items-center justify-center px-gutter">
			<header className="mb-12 text-center">
				<Icon
					name="hub"
					className="mb-4 animate-pulse text-[64px] text-primary"
				/>
				<h2 className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
					{t("analyzing.title")}
				</h2>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{genJob?.progress.message ?? t("analyzing.starting")}
				</p>
			</header>

			<GhostCard className="w-full max-w-[640px]">
				<ol className="space-y-3">
					{STAGES.map((s, idx) => {
						const status = statusOf(idx);
						return (
							<li key={s.node} className="flex items-center gap-4">
								<span
									className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
										status === "done"
											? "border-primary bg-primary text-on-primary"
											: status === "running"
												? "border-primary text-primary"
												: "border-outline-variant text-on-tertiary-container"
									}`}
								>
									<Icon
										name={status === "done" ? "check" : s.icon}
										className={
											status === "running"
												? "animate-pulse text-[18px]"
												: "text-[18px]"
										}
									/>
								</span>
								<span
									className={`font-label text-label-md uppercase tracking-wide ${
										status === "pending"
											? "text-on-tertiary-container"
											: "text-on-surface"
									}`}
								>
									{t(s.labelKey)}
								</span>
								{status === "running" ? (
									<span className="ms-auto font-mono text-[11px] uppercase tracking-widest text-primary">
										{t("analyzing.running")}
									</span>
								) : status === "done" ? (
									<span className="ms-auto font-mono text-[11px] uppercase tracking-widest text-secondary">
										{t("analyzing.done")}
									</span>
								) : null}
							</li>
						);
					})}
				</ol>

				{genJob?.status === "error" ? (
					<p className="mt-4 font-mono text-mono-technical text-error">
						{aiErrorCode(genJob.error)
							? aiErrorMessage(t, genJob.error, "analyzing.generationFailed")
							: (genJob.error ?? t("analyzing.generationFailed"))}
					</p>
				) : null}
			</GhostCard>
		</section>
	);
}
