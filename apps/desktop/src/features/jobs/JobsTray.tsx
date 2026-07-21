import { useEffect, useState } from "react";
import type { Job, JobKind } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { useJobsStore } from "./jobs-store.js";

/**
 * Floating jobs tray — mounted once inside the shell so it survives route
 * changes. Shows a small badge in the bottom-right when jobs are running;
 * click to expand a list of active + recent jobs with live progress bars.
 *
 * The tray starts the engine polling loop on mount and stops it on unmount.
 */
export function JobsTray() {
	const { jobs, startPolling, stopPolling, cancel, refresh } = useJobsStore();
	const [expanded, setExpanded] = useState(false);

	// Start the polling loop once for the whole app.
	useEffect(() => {
		startPolling();
		return () => stopPolling();
	}, [startPolling, stopPolling]);

	const activeCount = jobs.active.length;
	if (activeCount === 0 && !expanded) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
			{/* Active jobs summary — click to expand */}
			<button
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left shadow-lg transition-colors hover:bg-surface-container-low"
			>
				<span className="flex items-center gap-2">
					<Icon
						name={activeCount > 0 ? "sync" : "check_circle"}
						className={`text-[18px] ${activeCount > 0 ? "animate-spin text-secondary" : "text-primary"}`}
					/>
					<span className="font-label text-label-md text-on-surface">
						{activeCount > 0
							? `${activeCount} job${activeCount > 1 ? "s" : ""} running`
							: "Jobs"}
					</span>
				</span>
				<Icon
					name={expanded ? "expand_more" : "expand_less"}
					className="text-[18px] text-on-surface-variant"
				/>
			</button>

			{/* Expanded panel */}
			{expanded ? (
				<div className="mt-2 max-h-[60vh] overflow-auto rounded border border-outline-variant bg-surface-container-lowest shadow-lg">
					{/* Active */}
					{jobs.active.length > 0 ? (
						<div className="border-b border-outline-variant p-3">
							<p className="mb-2 font-label text-label-sm uppercase tracking-widest text-secondary">
								Active
							</p>
							<div className="space-y-3">
								{jobs.active.map((job) => (
									<JobRow key={job.id} job={job} onCancel={cancel} />
								))}
							</div>
						</div>
					) : (
						<div className="p-3">
							<p className="font-body text-body-md text-on-tertiary-container">
								No active jobs.
							</p>
						</div>
					)}

					{/* Recent */}
					{jobs.recent.length > 0 ? (
						<div className="p-3">
							<p className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
								Recent
							</p>
							<div className="space-y-2">
								{jobs.recent.slice(0, 8).map((job) => (
									<JobRow key={job.id} job={job} onCancel={cancel} compact />
								))}
							</div>
						</div>
					) : null}

					<div className="border-t border-outline-variant p-2">
						<button
							onClick={() => void refresh()}
							className="flex w-full items-center justify-center gap-1 py-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant hover:text-primary"
						>
							<Icon name="refresh" className="text-[14px]" />
							Refresh
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function JobRow({
	job,
	onCancel,
	compact = false,
}: {
	job: Job;
	onCancel: (id: string) => void;
	compact?: boolean;
}) {
	const pct = Math.round(
		(job.progress.fraction < 0 ? 0 : job.progress.fraction) * 100,
	);
	return (
		<div>
			<div className="flex items-center justify-between gap-2">
				<span className="flex items-center gap-1.5 font-label text-label-md text-on-surface">
					<Icon
						name={kindIcon(job.kind)}
						className="text-[16px] text-on-surface-variant"
					/>
					{job.label}
				</span>
				{job.status === "running" ? (
					<button
						onClick={() => onCancel(job.id)}
						className="p-1 text-on-surface-variant hover:text-error"
						title="Cancel"
					>
						<Icon name="cancel" className="text-[16px]" />
					</button>
				) : (
					<StatusChip status={job.status} />
				)}
			</div>
			{!compact && job.status === "running" ? (
				<div className="mt-1.5">
					<div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${pct}%` }}
						/>
					</div>
					<p className="mt-1 font-mono text-[10px] text-on-tertiary-container">
						{job.progress.message}
						{typeof job.progress.itemsDone === "number" &&
						typeof job.progress.itemsTotal === "number"
							? ` · ${job.progress.itemsDone}/${job.progress.itemsTotal}`
							: null}
					</p>
				</div>
			) : null}
			{compact ? (
				<p className="mt-0.5 font-mono text-[10px] text-on-tertiary-container">
					{job.progress.message}
					{job.durationMs ? ` · ${Math.round(job.durationMs / 1000)}s` : ""}
				</p>
			) : null}
		</div>
	);
}

function StatusChip({ status }: { status: Job["status"] }) {
	const styles: Record<string, string> = {
		done: "text-secondary",
		error: "text-error",
		canceled: "text-on-tertiary-container",
		queued: "text-on-surface-variant",
		running: "text-primary",
	};
	const icons: Record<string, string> = {
		done: "check_circle",
		error: "error",
		canceled: "block",
		queued: "schedule",
		running: "sync",
	};
	return (
		<span
			className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${styles[status] ?? ""}`}
		>
			<Icon name={icons[status] ?? "circle"} className="text-[12px]" />
			{status}
		</span>
	);
}

function kindIcon(kind: JobKind): string {
	switch (kind) {
		case "collect":
			return "download";
		case "generate":
			return "bolt";
		case "summarize":
			return "auto_awesome";
		default:
			return "task";
	}
}
