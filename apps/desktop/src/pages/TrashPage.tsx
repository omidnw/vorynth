import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import { fetchSettings } from "@/features/history/history-api.js";
import {
	emptyTrash,
	fetchTrash,
	purgeTrashEntry,
	restoreTrashEntry,
} from "@/features/trash/trash-api.js";
import type { TrashEntry, TrashKind } from "@vorynth/types";

/** Badge meta per trash kind — the entry's own icon + label. */
const KIND_META: Record<TrashKind, { label: string; icon: string }> = {
	collection: { label: "Collection", icon: "folder_special" },
	search: { label: "Search", icon: "search" },
	brief: { label: "Briefing", icon: "summarize" },
	generated: { label: "Generated", icon: "auto_awesome" },
};

/**
 * Trash page (v1.7.0) — soft-deleted collections & history.
 *
 * Deleting a collection or history entry from its page only soft-deletes it:
 * it lands here, hidden from the live view, restorable with one click. Restore
 * returns a collection's whole subtree — items that still point into it come
 * back with it, items the user moved elsewhere keep their new home. After the
 * retention window (Settings → Trash, default 7 days) expired entries are
 * purged automatically; "Delete forever" / "Empty trash" purge immediately
 * (saved items inside require explicit confirmation).
 */
export function TrashPage() {
	const queryClient = useQueryClient();
	const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null);
	const [emptyOpen, setEmptyOpen] = useState(false);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["trash"] });
		queryClient.invalidateQueries({ queryKey: ["archive"] });
		queryClient.invalidateQueries({ queryKey: ["history"] });
	};

	const { data: trashData } = useQuery({
		queryKey: ["trash"],
		queryFn: fetchTrash,
	});
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const entries = trashData?.items ?? [];

	const retentionHint = useMemo(() => {
		const value = (settings?.["trash.retentionValue"] as number | undefined) ?? 7;
		const unit = (settings?.["trash.retentionUnit"] as string | undefined) ?? "days";
		if (value <= 0) {
			return "Trash is kept until you empty it (auto-delete is off in Settings → Trash).";
		}
		return `Entries are auto-deleted after ${value} ${value === 1 ? unit.slice(0, -1) : unit} (Settings → Trash).`;
	}, [settings]);

	const totalBookmarked = entries.reduce((sum, e) => sum + e.bookmarkedCount, 0);

	const restoreMutation = useMutation({
		mutationFn: (e: TrashEntry) => restoreTrashEntry({ kind: e.kind, id: e.id }),
		onSuccess: invalidate,
	});
	const purgeMutation = useMutation({
		mutationFn: ({ e, force }: { e: TrashEntry; force: boolean }) =>
			purgeTrashEntry({ kind: e.kind, id: e.id, force }),
		onSuccess: () => {
			setPurgeTarget(null);
			invalidate();
		},
	});
	const emptyMutation = useMutation({
		mutationFn: (force: boolean) => emptyTrash({ force }),
		onSuccess: () => {
			setEmptyOpen(false);
			invalidate();
		},
	});

	return (
		<ArchiveLayout
			title="Trash"
			subtitle="Deleted collections and history entries live here — nothing is lost until you delete it forever."
			docsSectionId="trash"
			actions={
				entries.length > 0 ? (
					<button
						type="button"
						onClick={() => setEmptyOpen(true)}
						title="Permanently delete everything in the trash"
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded px-3 py-1.5 font-label text-label-sm uppercase text-error transition-colors hover:bg-error/10"
					>
						<Icon name="delete_sweep" className="text-[18px]" />
						Empty trash
					</button>
				) : undefined
			}
			hint={
				<p className="font-body text-body-sm text-on-tertiary-container">
					{retentionHint}
				</p>
			}
		>
			{/* Entries */}
			<GhostCard>
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon name="delete" className="text-base" />
						{entries.length} {entries.length === 1 ? "entry" : "entries"}
					</h3>
				</div>

				{entries.length === 0 ? (
					<div className="flex flex-col items-center gap-4 py-12 text-center">
						<Icon
							name="delete_sweep"
							className="text-[48px] text-on-tertiary-container"
						/>
						<p className="font-body text-body-md text-on-surface-variant">
							The trash is empty. Deleting a collection or history entry moves
							it here instead of destroying it.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{entries.map((e) => (
							<TrashEntryRow
								key={`${e.kind}:${e.id}`}
								entry={e}
								busy={purgeMutation.isPending || restoreMutation.isPending}
								onRestore={() => restoreMutation.mutate(e)}
								onPurge={() => setPurgeTarget(e)}
							/>
						))}
					</div>
				)}
			</GhostCard>

			{/* Delete-forever confirmation */}
			<ConfirmDialog
				open={purgeTarget !== null}
				title={`Delete "${purgeTarget?.name ?? ""}" forever?`}
				message={
					purgeTarget
						? purgeTarget.bookmarkedCount > 0
							? `${purgeTarget.bookmarkedCount} saved ${
									purgeTarget.bookmarkedCount === 1 ? "item" : "items"
								} inside will be permanently removed too — including its bookmark. This can't be undone.`
							: purgeTarget.kind === "collection"
								? "The folder and its sub-folders are permanently removed. Stories inside move to uncategorized — no articles are deleted, but the organization is gone for good."
								: "The history entry and its cached data are permanently deleted. This can't be undone."
						: ""
				}
				confirmLabel="Delete forever"
				icon="delete"
				danger
				confirming={purgeMutation.isPending}
				confirmingLabel="Deleting…"
				onConfirm={() => purgeTarget && purgeMutation.mutate({ e: purgeTarget, force: true })}
				onCancel={() => setPurgeTarget(null)}
			/>

			{/* Empty-trash confirmation */}
			<ConfirmDialog
				open={emptyOpen}
				title="Empty trash?"
				message={
					totalBookmarked > 0
						? `${totalBookmarked} saved ${
								totalBookmarked === 1 ? "item" : "items"
							} in the trash will be permanently removed too — including their bookmarks. This can't be undone.`
						: "Every entry in the trash is permanently deleted. This can't be undone."
				}
				confirmLabel="Empty trash"
				icon="delete_sweep"
				danger
				confirming={emptyMutation.isPending}
				confirmingLabel="Emptying…"
				onConfirm={() => emptyMutation.mutate(true)}
				onCancel={() => setEmptyOpen(false)}
			/>
		</ArchiveLayout>
	);
}

// ── entry row ────────────────────────────────────────────────────────────────

function TrashEntryRow({
	entry,
	busy,
	onRestore,
	onPurge,
}: {
	entry: TrashEntry;
	busy: boolean;
	onRestore: () => void;
	onPurge: () => void;
}) {
	const meta = KIND_META[entry.kind];
	return (
		<div className="flex flex-wrap items-center gap-3 rounded border border-outline-variant bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
			<span
				className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 font-label text-label-sm text-on-tertiary-container"
				title={`Type: ${meta.label}`}
			>
				<Icon name={meta.icon} className="text-[15px]" />
				{meta.label}
			</span>
			<div className="min-w-0 flex-1">
				<span className="block truncate font-body text-body-md font-medium text-on-surface">
					{entry.name}
				</span>
				<span className="flex flex-wrap items-center gap-2 font-body text-body-sm text-on-surface-variant">
					{entry.subtitle ? <span>{entry.subtitle}</span> : null}
					<span className="h-1 w-1 rounded-full bg-outline-variant" />
					Deleted {new Date(entry.deletedAt).toLocaleDateString("en-US", {
						day: "numeric",
						month: "short",
						year: "numeric",
					})}
					{entry.bookmarkedCount > 0 ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="text-secondary">
								{entry.bookmarkedCount} saved{" "}
								{entry.bookmarkedCount === 1 ? "item" : "items"}
							</span>
						</>
					) : null}
				</span>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					icon="restore"
					onClick={onRestore}
					disabled={busy}
					title="Restore to its original place"
				>
					Restore
				</Button>
				<button
					type="button"
					onClick={onPurge}
					disabled={busy}
					title="Permanently delete"
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded px-3 py-1.5 font-label text-label-sm uppercase text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Icon name="delete" className="text-[18px]" />
					Delete forever
				</button>
			</div>
		</div>
	);
}
