import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import {
	deleteAllData,
	deleteBackup,
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
				`Backup exported: ${r.path} (${(r.sizeBytes / 1024).toFixed(0)} KB)`,
			);
			void refetch();
		},
		onError: (e) => setStatus(`Export failed: ${(e as Error).message}`),
	});
	const restoreM = useMutation({
		mutationFn: (path: string) => restoreBackup(path),
		onSuccess: (r) => {
			setStatus(r.message);
			invalidate();
		},
		onError: (e) => setStatus(`Restore failed: ${(e as Error).message}`),
	});
	const removeM = useMutation({
		mutationFn: (name: string) => deleteBackup(name),
		onSuccess: () => refetch(),
	});
	const deleteAllM = useMutation({
		mutationFn: deleteAllData,
		onSuccess: (r) => {
			setStatus(r.message);
			setConfirmDelete(false);
			invalidate();
		},
		onError: (e) => setStatus(`Delete failed: ${(e as Error).message}`),
	});

	return (
		<GhostCard accentLeft>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-error">
				<Icon name="warning" className="text-base" />
				Data Ownership
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				Your data lives in a local SQLite file. Export a backup, restore from
				one, or permanently delete everything.
			</p>

			{/* Existing backups list */}
			{data?.backups.length ? (
				<div className="mb-4 space-y-2">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						Backups
					</p>
					{data.backups.map((b: BackupInfo) => (
						<div
							key={b.path}
							className="flex items-center gap-3 border border-outline-variant px-4 py-3 rounded"
						>
							<Icon name="archive" className="text-on-surface-variant" />
							<div className="flex-1">
								<p className="font-label text-label-md text-on-surface">
									{b.name}
								</p>
								<p className="font-mono text-[11px] text-on-tertiary-container">
									{(b.sizeBytes / 1024).toFixed(0)} KB ·{" "}
									{new Date(b.createdAt).toLocaleString()}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								icon="restore"
								onClick={() => restoreM.mutate(b.path)}
								disabled={restoreM.isPending}
							>
								Restore
							</Button>
							<button
								onClick={() => removeM.mutate(b.name)}
								className="p-2 text-on-surface-variant hover:text-error"
								title="Remove backup"
							>
								<Icon name="delete" className="text-[18px]" />
							</button>
						</div>
					))}
				</div>
			) : null}

			{/* Action buttons */}
			<div className="flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					icon="download"
					onClick={() => exportM.mutate()}
					disabled={exportM.isPending}
				>
					{exportM.isPending ? "Exporting…" : "Export Backup"}
				</Button>
				{confirmDelete ? (
					<div className="flex items-center gap-2">
						<span className="font-body text-body-md text-error">Sure?</span>
						<Button
							variant="ghost"
							size="sm"
							icon="delete"
							className="text-error"
							onClick={() => deleteAllM.mutate()}
							disabled={deleteAllM.isPending}
						>
							{deleteAllM.isPending ? "Deleting…" : "Yes, delete everything"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmDelete(false)}
						>
							Cancel
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
						Delete All Data
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
