import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import {
	deleteAllData,
	deleteBackup,
	downloadBackup,
	exportBackup,
	listBackups,
	restoreBackup,
	type BackupInfo,
} from "./backup-api.js";

/**
 * Data-ownership section of Settings (project-details.md §32.3–§32.5).
 *
 *   Export → writes a `.vorynth-backup` SQLite snapshot
 *   Restore → overwrites the live DB from a chosen backup
 *   Delete All → permanently wipes ALL local data
 *
 * Backups list shows existing snapshots with size + date, each removable.
 */
export function DataOwnershipSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	const { data, refetch } = useQuery({
		queryKey: ["backups"],
		queryFn: listBackups,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["backups"] });
		queryClient.invalidateQueries({ queryKey: ["engine-status"] });
		queryClient.invalidateQueries({ queryKey: ["reports"] });
	};

	const exportM = useMutation({
		mutationFn: exportBackup,
		onSuccess: (r) => {
			setStatus(
				t("dataOwnership.exported", {
					path: r.path,
					size: (r.sizeBytes / 1024).toFixed(0),
				}),
			);
			void refetch();
		},
		onError: (e) =>
			setStatus(
				t("dataOwnership.exportFailed", { message: (e as Error).message }),
			),
	});
	const restoreM = useMutation({
		mutationFn: (path: string) => restoreBackup(path),
		onSuccess: (r) => {
			setStatus(r.message);
			invalidate();
		},
		onError: (e) =>
			setStatus(
				t("dataOwnership.restoreFailed", { message: (e as Error).message }),
			),
	});
	const removeM = useMutation({
		mutationFn: (name: string) => deleteBackup(name),
		onSuccess: () => refetch(),
	});
	const downloadM = useMutation({
		mutationFn: (name: string) => downloadBackup(name),
		onSuccess: () => setStatus(t("dataOwnership.downloaded")),
		onError: (e) =>
			setStatus(
				t("dataOwnership.downloadFailed", { message: (e as Error).message }),
			),
	});
	const deleteAllM = useMutation({
		mutationFn: deleteAllData,
		onSuccess: (r) => {
			setStatus(r.message);
			setConfirmDelete(false);
			invalidate();
		},
		onError: (e) =>
			setStatus(
				t("dataOwnership.deleteFailed", { message: (e as Error).message }),
			),
	});

	return (
		<GhostCard accentLeft>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-error">
				<Icon name="warning" className="text-base" />
				{t("settings.dataOwnership")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("dataOwnership.body")}
			</p>

			{/* Existing backups list — always visible (v1.8.0): the user owns
			    these files and can download / restore / remove each one. */}
			<div className="mb-4 space-y-2">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("dataOwnership.backups")}
				</p>
				{data && data.backups.length === 0 ? (
					<p className="font-body text-body-sm text-on-surface-variant">
						{t("dataOwnership.noBackups")}
					</p>
				) : null}
				{data?.backups.map((b: BackupInfo) => (
					<div
						key={b.path}
						className="flex flex-wrap items-center gap-3 rounded border border-outline-variant px-4 py-3"
					>
						<Icon name="archive" className="text-on-surface-variant" />
						<div className="min-w-0 flex-1">
							<p className="truncate font-label text-label-md text-on-surface">
								{b.name}
							</p>
							<p className="font-mono text-[11px] text-on-tertiary-container">
								{(b.sizeBytes / 1024).toFixed(0)} KB ·{" "}
								{new Date(b.createdAt).toLocaleString()} ·{" "}
								{b.kind === "sqlite"
									? t("dataOwnership.kindSqlite")
									: t("dataOwnership.kindEngine")}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							icon="download"
							onClick={() => downloadM.mutate(b.name)}
							disabled={downloadM.isPending}
						>
							{downloadM.isPending
								? t("dataOwnership.downloading")
								: t("dataOwnership.download")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							icon="restore"
							onClick={() => restoreM.mutate(b.path)}
							disabled={restoreM.isPending}
						>
							{t("settings.restore")}
						</Button>
						<button
							onClick={() => removeM.mutate(b.name)}
							className="p-2 text-on-surface-variant hover:text-error"
							title={t("dataOwnership.removeBackup")}
						>
							<Icon name="delete" className="text-[18px]" />
						</button>
					</div>
				))}
			</div>

			{/* Action buttons */}
			<div className="flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					icon="download"
					onClick={() => exportM.mutate()}
					disabled={exportM.isPending}
				>
					{exportM.isPending
						? t("dataOwnership.exporting")
						: t("settings.exportBackup")}
				</Button>
				{confirmDelete ? (
					<div className="flex items-center gap-2">
						<span className="font-body text-body-md text-error">
							{t("dataOwnership.sure")}
						</span>
						<Button
							variant="ghost"
							size="sm"
							icon="delete"
							className="text-error"
							onClick={() => deleteAllM.mutate()}
							disabled={deleteAllM.isPending}
						>
							{deleteAllM.isPending
								? t("dataOwnership.deleting")
								: t("dataOwnership.deleteEverything")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmDelete(false)}
						>
							{t("common.cancel")}
						</Button>
					</div>
				) : (
					<Button
						variant="ghost"
						size="sm"
						icon="delete"
						className="text-error"
						onClick={() => setConfirmDelete(true)}
					>
						{t("settings.delete")}
					</Button>
				)}
			</div>

			{status ? (
				<p className="mt-4 font-mono text-mono-technical text-secondary">
					{status}
				</p>
			) : null}
		</GhostCard>
	);
}
