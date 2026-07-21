import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import type { WorkflowNodeName, WorkflowNodeStatus } from "@vorynth/types";

/**
 * Analyzing screen — kicks off a real generate job and visualizes its progress.
 *
 * On mount, starts `POST /jobs/generate` (background). The stage list advances
 * based on the job's `progress.fraction` (0→1 maps across the 8 workflow
 * stages). When the job reaches a terminal state (done/error), navigates to
 * the Brief.
 */
const STAGES: { node: WorkflowNodeName; label: string; icon: string }[] = [
	{ node: "collector", label: "Collecting sources", icon: "download" },
	{ node: "normalizer", label: "Normalizing content", icon: "tune" },
	{ node: "dedup", label: "Detecting duplicates", icon: "filter_alt" },
	{ node: "classifier", label: "Classifying topics", icon: "category" },
	{ node: "ranker", label: "Ranking importance", icon: "leaderboard" },
	{ node: "analyzer", label: "Analyzing impact", icon: "psychology" },
	{ node: "localizer", label: "Localizing output", icon: "translate" },
	{ node: "report", label: "Compiling brief", icon: "description" },
];

export function AnalyzingPage() {
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
					Distilling Intelligence
				</h2>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{genJob?.progress.message ?? "Starting the engine…"}
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
									{s.label}
								</span>
								{status === "running" ? (
									<span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-primary">
										Running…
									</span>
								) : status === "done" ? (
									<span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-secondary">
										Done
									</span>
								) : null}
							</li>
						);
					})}
				</ol>

				{genJob?.status === "error" ? (
					<p className="mt-4 font-mono text-mono-technical text-error">
						{genJob.error ?? "Generation failed."}
					</p>
				) : null}
			</GhostCard>
		</section>
	);
}
