import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearStories, fetchUsage, purgeLocalMedia } from "./usage-api.js";
import { formatBytes, formatDuration } from "./storage-format.js";
import { appInstallSize } from "@/features/updater/updater-api.js";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";
import type { UsageLibrary } from "@vorynth/types";

/**
 * Storage & Usage (v1.8.0) — the Settings section that answers "what is on my
 * disk and what is my machine doing".
 *
 *   • Storage: the installed app's size + the data directory broken into its
 *     libraries (Database, Media, Backups, Plugins) with a total. Stories and
 *     media each get their own clear action behind a confirmation dialog —
 *     the stories one warns that Auto-delete retention is the recommended way
 *     to shrink the feed, and that bookmarked / collected stories are kept.
 *   • System usage: the engine process's RAM + CPU (sampled by the engine over
 *     ~1 second) and the host's memory totals for context.
 */
export function StorageSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	const { data: usage, isLoading } = useQuery({
		queryKey: ["usage"],
		queryFn: fetchUsage,
		staleTime: 0,
	});
	const { data: appSize } = useQuery({
		queryKey: ["app-install-size"],
		queryFn: appInstallSize,
		enabled: isTauriShell(),
		staleTime: 60_000,
	});

	const [confirmStories, setConfirmStories] = useState(false);
	const [confirmMedia, setConfirmMedia] = useState(false);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["usage"] });
		queryClient.invalidateQueries({ queryKey: ["engine-status"] });
		queryClient.invalidateQueries({ queryKey: ["media-local"] });
	};

	const clearStoriesMutation = useMutation({
		mutationFn: clearStories,
		onSuccess: invalidate,
	});
	const clearMediaMutation = useMutation({
		mutationFn: purgeLocalMedia,
		onSuccess: invalidate,
	});

	const totalBytes = usage?.totalBytes ?? 0;
	const libraries = usage?.libraries ?? [];

	return (
		<>
			<GhostCard>
				<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
					<Icon name="data_usage" className="text-base" />
					{t("settings.storageTitle")}
				</h3>
				<p className="mb-4 font-body text-body-md text-on-surface-variant">
					{t("settings.storageHint")}
				</p>

				{isLoading ? (
					<p className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
						<Icon name="sync" className="animate-spin-reverse text-[16px]" />
						{t("settings.storageLoading")}
					</p>
				) : usage ? (
					<div className="space-y-4">
						{/* Totals row */}
						<div className="flex flex-wrap items-end justify-between gap-2">
							<div className="border-s-2 border-s-primary ps-3">
								<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
									{t("settings.storageTotal")}
								</p>
								<p className="mt-1 font-mono text-mono-technical text-on-surface">
									{formatBytes(totalBytes)}
								</p>
							</div>
							{appSize !== null && appSize !== undefined ? (
								<div className="border-s-2 border-s-outline-variant ps-3">
									<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
										{t("settings.storageApp")}
									</p>
									<p className="mt-1 font-mono text-mono-technical text-on-surface">
										{formatBytes(appSize)}
									</p>
								</div>
							) : null}
							<Button
								variant="ghost"
								size="sm"
								icon="refresh"
								onClick={() => invalidate()}
								aria-label={t("settings.storageRefresh")}
							>
								{t("settings.storageRefresh")}
							</Button>
						</div>

						{/* Library breakdown */}
						<div className="space-y-2">
							{libraries.map((lib) => (
								<LibraryRow
									key={lib.key}
									lib={lib}
									totalBytes={totalBytes}
									label={t(`settings.storageLibrary${capitalize(lib.key)}`)}
									itemsLabel={
										lib.items !== undefined
											? t(`settings.storageItems`, { count: lib.items })
											: undefined
									}
								/>
							))}
						</div>

						{/* Stories + media actions */}
						<div className="flex flex-col gap-3 border-t border-outline-variant pt-4 md:flex-row md:items-center md:justify-between">
							<div className="flex min-w-0 items-start gap-3">
								<Icon
									name="article"
									className="mt-0.5 text-[20px] text-on-surface-variant"
								/>
								<div className="min-w-0">
									<p className="font-label text-label-md text-on-surface">
										{t("settings.storageStoriesLabel", {
											count: usage.stories.total,
										})}
									</p>
									<p className="font-body text-body-sm text-on-surface-variant">
										{t("settings.storageStoriesSize", {
											size: formatBytes(usage.stories.contentBytes),
										})}
									</p>
								</div>
							</div>
							<Button
								variant="secondary"
								size="sm"
								icon="delete_sweep"
								onClick={() => setConfirmStories(true)}
							>
								{t("settings.storageClearStories")}
							</Button>
						</div>

						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div className="flex min-w-0 items-start gap-3">
								<Icon
									name="image"
									className="mt-0.5 text-[20px] text-on-surface-variant"
								/>
								<div className="min-w-0">
									<p className="font-label text-label-md text-on-surface">
										{t("settings.storageMediaLabel", {
											count: mediaItems(usage.libraries),
										})}
									</p>
									<p className="font-body text-body-sm text-on-surface-variant">
										{t("settings.storageMediaSize", {
											size: formatBytes(mediaBytes(usage.libraries)),
										})}
									</p>
								</div>
							</div>
							<Button
								variant="secondary"
								size="sm"
								icon="delete"
								onClick={() => setConfirmMedia(true)}
							>
								{t("settings.storageClearMedia")}
							</Button>
						</div>

						{usage.measuredAt ? (
							<p className="font-mono text-[11px] text-on-tertiary-container">
								{t("settings.storageMeasured", {
									at: new Date(usage.measuredAt).toLocaleTimeString(),
								})}
							</p>
						) : null}
					</div>
				) : null}
			</GhostCard>

			{/* System usage */}
			<GhostCard>
				<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
					<Icon name="speed" className="text-base" />
					{t("settings.storageSystemTitle")}
				</h3>
				{isLoading ? (
					<p className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
						<Icon name="sync" className="animate-spin-reverse text-[16px]" />
						{t("settings.storageLoading")}
					</p>
				) : usage ? (
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<Metric
							label={t("settings.storageRam")}
							value={formatBytes(usage.process.rssBytes)}
						/>
						<Metric
							label={t("settings.storageHeap")}
							value={formatBytes(usage.process.heapUsedBytes)}
						/>
						<Metric
							label={t("settings.storageCpu")}
							value={`${usage.process.cpuPercent.toFixed(1)}%`}
						/>
						<Metric
							label={t("settings.storageUptime")}
							value={formatDuration(usage.process.uptimeSeconds)}
						/>
						<Metric
							label={t("settings.storageSystemMemory")}
							value={`${formatBytes(usage.system.freeMemBytes)} / ${formatBytes(
								usage.system.totalMemBytes,
							)}`}
						/>
					</div>
				) : null}
			</GhostCard>

			{/* Clear-all-stories confirmation — the "not recommended" dialog */}
			<ConfirmDialog
				open={confirmStories}
				title={t("settings.storageClearStories")}
				message={storageConfirmMessage(
					t("settings.storageClearStoriesBody", {
						count: usage?.stories.total ?? 0,
					}),
					t("settings.storageClearStoriesKept"),
					t("settings.storageClearStoriesRecommend"),
				)}
				confirmLabel={t("settings.storageClearStoriesConfirmLabel")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setConfirmStories(false);
					void clearStoriesMutation.mutate();
				}}
				onCancel={() => setConfirmStories(false)}
				icon="delete_sweep"
				danger
				confirming={clearStoriesMutation.isPending}
				confirmingLabel={t("settings.storageClearing")}
			/>

			{/* Clear-media confirmation */}
			<ConfirmDialog
				open={confirmMedia}
				title={t("settings.storageClearMedia")}
				message={storageConfirmMessage(
					t("settings.storageClearMediaBody", {
						count: mediaItems(usage?.libraries ?? []),
						size: formatBytes(mediaBytes(usage?.libraries ?? [])),
					}),
					t("settings.storageClearMediaHint"),
				)}
				confirmLabel={t("settings.storageClearMediaConfirmLabel")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setConfirmMedia(false);
					void clearMediaMutation.mutate();
				}}
				onCancel={() => setConfirmMedia(false)}
				icon="delete"
				danger
				confirming={clearMediaMutation.isPending}
				confirmingLabel={t("settings.storageClearing")}
			/>
		</>
	);
}

/** One library row with a proportional size bar. */
function LibraryRow({
	lib,
	totalBytes,
	label,
	itemsLabel,
}: {
	lib: UsageLibrary;
	totalBytes: number;
	label: string;
	itemsLabel?: string;
}) {
	const pct =
		totalBytes > 0
			? Math.min(100, Math.round((lib.bytes / totalBytes) * 100))
			: 0;
	return (
		<div className="flex items-center gap-3">
			<div className="w-44 shrink-0 md:w-56">
				<p className="truncate font-label text-label-sm text-on-surface">
					{label}
				</p>
				{itemsLabel ? (
					<p className="font-body text-body-sm text-on-surface-variant">
						{itemsLabel}
					</p>
				) : null}
			</div>
			<div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-lowest">
				<div
					className="h-full rounded-full bg-primary"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="w-20 shrink-0 text-right font-mono text-mono-technical text-on-surface">
				{formatBytes(lib.bytes)}
			</span>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-s-2 border-s-outline-variant ps-3">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
				{label}
			</p>
			<p className="mt-1 font-mono text-mono-technical text-on-surface">
				{value}
			</p>
		</div>
	);
}

/** Confirm-dialog body convention: `\n\n`-joined plain text (R-A12 pattern). */
function storageConfirmMessage(...lines: string[]): string {
	return lines.join("\n\n");
}

function mediaBytes(libraries: UsageLibrary[]): number {
	return libraries.find((l) => l.key === "media")?.bytes ?? 0;
}

function mediaItems(libraries: UsageLibrary[]): number {
	return libraries.find((l) => l.key === "media")?.items ?? 0;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
