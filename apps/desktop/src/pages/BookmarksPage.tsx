import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	deleteBookmark,
	fetchBookmarks,
} from "@/features/archive/archive-api.js";
import { detailPath } from "@/features/archive/detail-path.js";
import { TypeBadge } from "@/features/archive/TypeBadge.js";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import type { ArchiveItem } from "@vorynth/types";

/**
 * Bookmarks page (v1.7.0) — everything the user saved. A bookmark is user
 * ownership of a reference: removing it keeps the underlying story/item.
 *
 * Single-column centered layout matching every other Vorynth page.
 */
export function BookmarksPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [unsaveTarget, setUnsaveTarget] = useState<string | null>(null);

	const { data } = useQuery({
		queryKey: ["bookmarks"],
		queryFn: () => fetchBookmarks({ limit: 100 }),
	});
	const unsave = useMutation({
		mutationFn: (contentItemId: string) => deleteBookmark(contentItemId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
			queryClient.invalidateQueries({ queryKey: ["archive"] });
		},
	});

	const items = data?.items ?? [];

	return (
		<ArchiveLayout
			title={t("bookmarks.title")}
			subtitle={t("bookmarks.subtitle")}
			docsSectionId="bookmarks"
		>
			<div className="space-y-8">
				{items.length === 0 ? (
					<GhostCard className="flex flex-col items-center gap-4 py-16 text-center">
						<Icon
							name="bookmark_border"
							className="text-[48px] text-on-tertiary-container"
						/>
						<h3 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
							{t("bookmarks.emptyTitle")}
						</h3>
						<p className="font-body text-body-md text-on-surface-variant">
							{t("bookmarks.emptyBody")}
						</p>
						<Link
							to="/brief"
							className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-secondary transition-colors hover:text-primary hover:underline"
						>
							<Icon name="arrow_back" className="text-[14px]" />
							{t("bookmarks.goToBrief")}
						</Link>
					</GhostCard>
				) : (
					<GhostCard>
						<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							<Icon name="bookmark" className="text-base" />
							{t("bookmarks.savedItems")}
							<span className="font-mono text-[11px] tracking-widest text-on-tertiary-container">
								{items.length}
							</span>
						</h3>
						<div className="space-y-3">
							{items.map((item) => (
								<BookmarkRow
									key={item.contentItemId}
									item={item}
									onOpen={() => navigate(detailPath(item))}
									onUnsave={() => setUnsaveTarget(item.contentItemId)}
								/>
							))}
						</div>
					</GhostCard>
				)}

				{/* Tip: archive */}
				<GhostCard className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<Icon
							name="inventory_2"
							className="text-[24px] text-on-surface-variant"
						/>
						<div>
							<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
								{t("bookmarks.tipTitle")}
							</h3>
							<p className="font-body text-body-sm text-on-tertiary-container">
								{t("bookmarks.tipBody")}
							</p>
						</div>
					</div>
					<Link
						// v1.8.1 — "Organize your saved items" should land on the
						// COLLECTIONS view, not the flat Items list.
						to="/archive/collections"
						className="inline-flex items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
					>
						<Icon name="open_in_new" className="text-[16px]" />
						{t("bookmarks.archiveLink")}
					</Link>
				</GhostCard>
			</div>

			{/* Unsave confirmation */}
			<ConfirmDialog
				open={Boolean(unsaveTarget)}
				title={t("bookmarks.removeTitle")}
				message={t("bookmarks.removeMessage")}
				confirmLabel={t("bookmarks.removeConfirm")}
				icon="bookmark_remove"
				danger={false}
				onConfirm={() => {
					if (unsaveTarget) unsave.mutate(unsaveTarget);
					setUnsaveTarget(null);
				}}
				onCancel={() => setUnsaveTarget(null)}
			/>
		</ArchiveLayout>
	);
}

function BookmarkRow({
	item,
	onOpen,
	onUnsave,
}: {
	item: ArchiveItem;
	onOpen: () => void;
	onUnsave: () => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex items-center gap-3 border border-outline-variant rounded bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
			<TypeBadge contentType={item.contentType} className="shrink-0" />
			<button
				type="button"
				onClick={onOpen}
				className="min-w-0 flex-1 cursor-pointer text-start"
			>
				<span className="block truncate font-body text-body-md font-medium text-on-surface">
					{item.title ?? t("bookmarks.untitled")}
				</span>
				<span className="flex flex-wrap items-center gap-2 font-body text-body-sm text-on-surface-variant">
					{item.author ? (
						<span>
							{t("article.by")} {item.author}
						</span>
					) : null}
					{item.publishedAt ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							{new Date(item.publishedAt).toLocaleDateString("en-US", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</>
					) : null}
					{item.tags.length > 0 ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							{item.tags.map((t) => (
								<span key={t}>#{t}</span>
							))}
						</>
					) : null}
				</span>
			</button>
			<button
				type="button"
				onClick={onUnsave}
				aria-label={t("bookmarks.removeConfirm")}
				className="shrink-0 rounded p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
			>
				<Icon name="bookmark" fill className="text-[18px]" />
			</button>
		</div>
	);
}
