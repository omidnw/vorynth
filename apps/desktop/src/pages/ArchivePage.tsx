import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTextDirection, useTranslation } from "@/i18n";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import { TypeBadge } from "@/features/archive/TypeBadge.js";
import { BOOKMARK_META, TYPE_META } from "@/features/archive/type-meta.js";
import { detailPath } from "@/features/archive/detail-path.js";
import { cn } from "@/lib/cn";
import {
	createBookmark,
	deleteArchiveItem,
	deleteBookmark,
	fetchArchiveItems,
	fetchCollections,
	patchArchiveItem,
} from "@/features/archive/archive-api.js";
import type { ArchiveItem } from "@vorynth/types";

/** Initial page size — the "show more" button fetches the next batch. */
const PAGE_SIZE = 10;

/**
 * Archive page (v1.7.0) — the unified user-owned intelligence space.
 *
 * A clean, single-pane items browser: every item type has its own icon badge,
 * and items can be bookmarked, noted, archived, or moved into a collection.
 * Organizing by folder lives on the dedicated Collections page
 * (`/archive/collections`) — reach it from the header or the sidebar. Opening
 * an item's detail page and pressing Back returns here unchanged.
 */
export function ArchivePage() {
	const [q, setQ] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [showArchived, setShowArchived] = useState(false);
	const [limit, setLimit] = useState(PAGE_SIZE);
	const [noteFor, setNoteFor] = useState<string | null>(null);
	const [noteDraft, setNoteDraft] = useState("");
	/** The archived item awaiting permanent-delete confirmation. */
	const [deleteFor, setDeleteFor] = useState<string | null>(null);
	const navigate = useNavigate();
	const { t } = useTranslation();

	const queryClient = useQueryClient();
	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["archive"] });
	};

	const { data: itemsPage } = useQuery({
		queryKey: ["archive", "items", typeFilter, q, showArchived, limit],
		queryFn: () =>
			fetchArchiveItems({
				contentType:
					typeFilter === "bookmarked" ? undefined : typeFilter || undefined,
				bookmarked: typeFilter === "bookmarked" ? true : undefined,
				q: q || undefined,
				archived: showArchived ? true : undefined,
				limit,
			}),
	});

	const bookmarkMutation = useMutation({
		mutationFn: ({
			id,
			saved,
		}: {
			id: string;
			saved: boolean;
		}): Promise<unknown> => (saved ? deleteBookmark(id) : createBookmark(id)),
		onSuccess: () => {
			invalidate();
			queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
		},
	});
	const noteMutation = useMutation({
		mutationFn: ({ id, note }: { id: string; note: string | null }) =>
			patchArchiveItem(id, { note }),
		onSuccess: () => {
			invalidate();
			setNoteFor(null);
		},
	});
	const archiveMutation = useMutation({
		mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
			patchArchiveItem(id, { archived }),
		onSuccess: invalidate,
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteArchiveItem(id),
		onSuccess: () => {
			invalidate();
			setDeleteFor(null);
		},
	});
	const moveMutation = useMutation({
		mutationFn: ({ id, collectionId }: { id: string; collectionId: string }) =>
			patchArchiveItem(id, { collectionId }),
		onSuccess: invalidate,
	});

	const { data: collectionsData } = useQuery({
		queryKey: ["archive", "collections"],
		queryFn: fetchCollections,
	});
	const collections = useMemo(
		() =>
			(collectionsData?.items ?? []).map((c) => ({
				id: c.id,
				name: c.name,
				kind: c.kind,
			})),
		[collectionsData],
	);

	/** Type-filter chips — labels come from `archive.filterAll` + `types.*`. */
	const typeFilterOptions = useMemo(
		() => [
			{ key: "", label: t("archive.filterAll"), icon: "inventory_2" },
			{
				key: "article",
				label: t("types.stories"),
				icon: TYPE_META.article.icon,
			},
			{ key: "bookmarked", label: t("types.saved"), icon: BOOKMARK_META.icon },
			{
				key: "summary",
				label: t("types.summaries"),
				icon: TYPE_META.summary.icon,
			},
			{
				key: "keyword-search",
				label: t("types.searches"),
				icon: TYPE_META["keyword-search"].icon,
			},
			{
				key: "ai-ask",
				label: t("types.aiAsks"),
				icon: TYPE_META["ai-ask"].icon,
			},
		],
		[t],
	);

	const items = itemsPage?.items ?? [];
	const total = itemsPage?.total ?? 0;
	const hasMore = itemsPage?.hasMore ?? false;

	// "Show more" scroll: when items grow (new page fetched), scroll to the
	// first new item instead of jumping to the top of the page. Resets on
	// filter/type changes so switching context doesn't trigger a phantom scroll.
	// IMPORTANT: ignore loading states (items temporarily []) — otherwise the
	// ref resets to 0 and the scroll targets the top of the list.
	const prevCountRef = useRef(0);
	const firstNewItemRef = useRef<HTMLDivElement | null>(null);
	const lastFilterKey = useRef("");
	const filterKey = `${typeFilter}|${q}|${showArchived}`;
	useEffect(() => {
		// Skip empty/loading renders — don't touch the ref.
		if (items.length === 0) {
			prevCountRef.current = 0;
			return;
		}
		if (filterKey !== lastFilterKey.current) {
			prevCountRef.current = items.length;
			lastFilterKey.current = filterKey;
			return;
		}
		// Only scroll when growing FROM a positive count (real "show more", not
		// a recovery from a loading gap).
		if (
			items.length > prevCountRef.current &&
			prevCountRef.current > 0 &&
			firstNewItemRef.current
		) {
			firstNewItemRef.current.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}
		prevCountRef.current = items.length;
	}, [items.length, filterKey]);

	return (
		<>
			<ArchiveLayout
				title={t("archive.title")}
				subtitle={t("archive.subtitle")}
				docsSectionId="archive"
			>
				{/* Items browser */}
				<GhostCard className="min-w-0">
					<div className="mb-4 flex flex-wrap items-center gap-3">
						<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							<Icon name="inventory_2" className="text-base" />
							{t("archive.itemsTitle")}
						</h3>
						<span className="font-mono text-[11px] tracking-widest text-on-tertiary-container">
							{total} {t("archive.item", { count: total })}
						</span>
						<button
							type="button"
							onClick={() => {
								setShowArchived((v) => !v);
								setLimit(PAGE_SIZE);
							}}
							className={cn(
								"ms-auto flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-label text-label-sm transition-colors",
								showArchived
									? "text-secondary"
									: "text-on-surface-variant hover:text-primary",
							)}
							aria-pressed={showArchived}
						>
							<Icon
								name={showArchived ? "unarchive" : "archive"}
								className="text-[16px]"
							/>
							{showArchived
								? t("archive.showingArchived")
								: t("archive.showArchived")}
						</button>
					</div>

					{/* Filter row */}
					<div className="mb-6 flex flex-wrap items-center gap-3">
						<div className="flex flex-wrap gap-1">
							{typeFilterOptions.map((f) => (
								<button
									key={f.key}
									type="button"
									onClick={() => {
										setTypeFilter(f.key);
										setLimit(PAGE_SIZE);
									}}
									aria-pressed={typeFilter === f.key}
									className={cn(
										"inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 font-label text-label-sm transition-colors",
										typeFilter === f.key
											? "bg-primary text-on-primary"
											: "text-on-surface-variant hover:bg-surface-container-high",
									)}
								>
									<Icon name={f.icon} className="text-[16px]" />
									{f.label}
								</button>
							))}
						</div>
						<div className="ms-auto w-full max-w-56">
							<input
								type="search"
								value={q}
								onChange={(e) => {
									setQ(e.target.value);
									setLimit(PAGE_SIZE);
								}}
								placeholder={t("archive.filterPlaceholder")}
								aria-label={t("archive.filterAria")}
								className="w-full rounded border border-outline-variant bg-surface-container-low px-3 py-1.5 font-body text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
							/>
						</div>
					</div>

					{/* Item list */}
					{items.length === 0 ? (
						<div className="flex flex-col items-center gap-4 py-12 text-center">
							<Icon
								name="inbox"
								className="text-[48px] text-on-tertiary-container"
							/>
							<p className="font-body text-body-md text-on-surface-variant">
								{showArchived
									? "No archived items."
									: typeFilter === "bookmarked"
										? "No saved items yet. Hit the bookmark icon on any story in the Brief."
										: "Nothing here yet. Collect stories from your sources and save the ones you care about."}
							</p>
						</div>
					) : (
						<>
							<div className="space-y-3">
								{items.map((item, idx) => (
									<div
										key={item.contentItemId}
										ref={
											idx === prevCountRef.current ? firstNewItemRef : undefined
										}
									>
										<ArchiveItemRow
											item={item}
											collections={collections}
											isNoteOpen={noteFor === item.contentItemId}
											noteDraft={noteDraft}
											onNoteDraft={setNoteDraft}
											onToggleNote={(id) => {
												if (noteFor === id) {
													setNoteFor(null);
												} else {
													setNoteFor(id);
													setNoteDraft(item.note ?? "");
												}
											}}
											onSaveNote={(id) =>
												noteMutation.mutate({ id, note: noteDraft || null })
											}
											onToggleBookmark={(saved) =>
												bookmarkMutation.mutate({
													id: item.contentItemId,
													saved,
												})
											}
											onToggleArchived={(archived) =>
												archiveMutation.mutate({
													id: item.contentItemId,
													archived,
												})
											}
											onDelete={() => setDeleteFor(item.contentItemId)}
											onMove={(collectionId) =>
												moveMutation.mutate({
													id: item.contentItemId,
													collectionId,
												})
											}
											onOpen={() => navigate(detailPath(item))}
										/>
									</div>
								))}
							</div>
							{hasMore ? (
								<div className="mt-6 border-t border-outline-variant pt-4 text-center">
									<button
										type="button"
										onClick={() => setLimit((l) => l + PAGE_SIZE)}
										className="inline-flex cursor-pointer items-center gap-1.5 rounded font-label text-label-md text-primary transition-colors hover:text-secondary"
									>
										<Icon name="expand_more" className="text-[18px]" />
										{/* v1.8.1 — say how many load and how many remain. */}
										{t("archive.showMore", {
											count: PAGE_SIZE,
											remaining: total - items.length,
										})}
									</button>
								</div>
							) : null}
						</>
					)}
				</GhostCard>
			</ArchiveLayout>
			{/* Permanent delete — archived items only, explicitly confirmed. */}
			<ConfirmDialog
				open={deleteFor !== null}
				title={t("archive.deleteTitle")}
				message={t("archive.deleteMessage")}
				confirmLabel={t("archive.deleteConfirm")}
				cancelLabel={t("common.cancel")}
				icon="delete_forever"
				danger
				confirming={deleteMutation.isPending}
				onConfirm={() => {
					if (deleteFor) deleteMutation.mutate(deleteFor);
				}}
				onCancel={() => setDeleteFor(null)}
			/>
		</>
	);
}

// ── item row ────────────────────────────────────────────────────────────────

function ArchiveItemRow({
	item,
	collections,
	isNoteOpen,
	noteDraft,
	onNoteDraft,
	onToggleNote,
	onSaveNote,
	onToggleBookmark,
	onToggleArchived,
	onDelete,
	onMove,
	onOpen,
}: {
	item: ArchiveItem;
	collections: Array<{ id: string; name: string; kind: "category" | "folder" }>;
	isNoteOpen: boolean;
	noteDraft: string;
	onNoteDraft: (v: string) => void;
	onToggleNote: (id: string) => void;
	onSaveNote: (id: string) => void;
	onToggleBookmark: (saved: boolean) => void;
	onToggleArchived: (archived: boolean) => void;
	/** Ask to permanently delete this (archived) item — v1.8.0. */
	onDelete: () => void;
	onMove: (collectionId: string) => void;
	onOpen: () => void;
}) {
	const textDir = useTextDirection();
	const { t } = useTranslation();
	// v1.8.0 — an Original/Translated toggle sits right under the type badge
	// when the item is a translated story; it swaps which title is primary.
	const [showOriginal, setShowOriginal] = useState(false);
	const translated = Boolean(
		item.originalTitle && item.title !== item.originalTitle,
	);
	const mainTitle =
		showOriginal && translated ? item.originalTitle : item.title;
	const secondaryTitle = translated
		? showOriginal
			? item.title
			: item.originalTitle
		: null;

	return (
		<div className="border border-outline-variant rounded bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
			<div className="flex flex-wrap items-start gap-3">
				{/* Type badge with the type's own icon + the Original/Translated
				    toggle for translated stories, stacked under it (v1.8.0). */}
				<div className="flex shrink-0 flex-col items-start gap-1.5">
					<TypeBadge contentType={item.contentType} className="mt-0.5" />
					{translated ? (
						<button
							type="button"
							onClick={() => setShowOriginal((v) => !v)}
							aria-pressed={showOriginal}
							className="rounded border border-outline-variant px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
						>
							{showOriginal ? t("article.translated") : t("article.original")}
						</button>
					) : null}
				</div>

				{/* Title + meta */}
				<button
					type="button"
					onClick={onOpen}
					className="min-w-0 flex-1 cursor-pointer text-start"
				>
					<span
						className="block truncate font-body text-body-md font-medium text-on-surface"
						dir={textDir(mainTitle ?? "")}
					>
						{mainTitle ?? "Untitled"}
					</span>
					{/* A translated story keeps the OTHER title visible (v1.8.0) —
					    the original muted under the translation and vice versa. */}
					{secondaryTitle ? (
						<span
							className="block truncate font-body text-body-sm text-on-surface-variant"
							dir={textDir(secondaryTitle)}
						>
							<span className="me-1 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container">
								{showOriginal ? t("article.translated") : t("article.original")}
							</span>
							{secondaryTitle}
						</span>
					) : null}
					<span className="flex flex-wrap items-center gap-2 font-body text-body-sm text-on-surface-variant">
						{item.author ? (
							<span dir={textDir(item.author)}>by {item.author}</span>
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
						{item.bookmarked ? (
							<>
								<span className="h-1 w-1 rounded-full bg-outline-variant" />
								<span className="flex items-center gap-1 text-secondary">
									<Icon
										name={BOOKMARK_META.icon}
										fill
										className="text-[14px]"
									/>
									{t("types.saved")}
								</span>
							</>
						) : null}
						{item.archivedAt ? (
							<>
								<span className="h-1 w-1 rounded-full bg-outline-variant" />
								<span className="text-on-tertiary-container">
									{t("archive.archived")}
								</span>
							</>
						) : null}
					</span>
				</button>

				{/* Actions */}
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={() => onToggleBookmark(item.bookmarked)}
						aria-label={
							item.bookmarked ? "Remove bookmark" : "Bookmark this item"
						}
						aria-pressed={item.bookmarked}
						className="cursor-pointer rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon
							name={item.bookmarked ? "bookmark" : "bookmark_border"}
							fill={item.bookmarked}
							className="text-[18px]"
						/>
					</button>
					<button
						type="button"
						onClick={() => onToggleNote(item.contentItemId)}
						aria-label={t("archive.editNoteAria")}
						aria-pressed={isNoteOpen}
						className="cursor-pointer rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon name="note" className="text-[18px]" />
					</button>
					<button
						type="button"
						onClick={() => onToggleArchived(!item.archivedAt)}
						aria-label={
							item.archivedAt
								? t("archive.unarchiveAria")
								: t("archive.archiveAria")
						}
						className="cursor-pointer rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon
							name={item.archivedAt ? "unarchive" : "archive"}
							className="text-[18px]"
						/>
					</button>
					{/* Permanent delete lives in the archived view (v1.8.0): a live item
						    is archived first, then deleted here — the confirm dialog makes
						    the irreversibility explicit (R-A10). */}
					{item.archivedAt ? (
						<button
							type="button"
							onClick={onDelete}
							aria-label={t("archive.deletePermanentlyAria")}
							className="cursor-pointer rounded p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
						>
							<Icon name="delete" className="text-[18px]" />
						</button>
					) : null}
				</div>
			</div>

			{/* Note */}
			{item.note ? (
				<p
					className="mt-2 break-words border-s-2 border-s-primary ps-3 font-body text-body-sm italic text-on-surface-variant"
					dir={textDir(item.note)}
				>
					{item.note}
				</p>
			) : null}

			{/* Note editor */}
			{isNoteOpen ? (
				<div className="mt-3 flex flex-col gap-2">
					<textarea
						value={noteDraft}
						onChange={(e) => onNoteDraft(e.target.value)}
						rows={2}
						placeholder={t("archive.notePlaceholder")}
						className="w-full resize-y border border-outline-variant bg-transparent p-3 font-body text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onSaveNote(item.contentItemId)}
							className="cursor-pointer rounded bg-primary px-3 py-1 font-label text-label-sm text-on-primary"
						>
							Save note
						</button>
						<button
							type="button"
							onClick={() => onToggleNote(item.contentItemId)}
							className="cursor-pointer rounded px-3 py-1 font-label text-label-sm text-on-surface-variant"
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}

			{/* Tags + move */}
			{(item.tags.length > 0 || collections.length > 0) && !isNoteOpen ? (
				<div className="mt-2 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-2">
					{item.tags.map((t) => (
						<span
							key={t}
							className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-label-sm text-on-tertiary-container"
						>
							#{t}
						</span>
					))}
					{collections.length > 0 ? (
						<Select
							value={item.collectionId ?? ""}
							onChange={(v) => v && onMove(v)}
							aria-label={t("archive.moveToCollectionAria")}
							placeholder={
								item.collectionId
									? t("archive.uncategorize")
									: t("archive.moveTo")
							}
							options={[
								{
									value: "",
									label: item.collectionId
										? t("archive.uncategorize")
										: t("archive.moveTo"),
									icon: "inbox",
								},
								...collections.map((c) => ({
									value: c.id,
									label: c.name,
									icon: c.kind === "category" ? "folder_special" : "folder",
								})),
							]}
							className="ms-auto w-48 max-w-full"
						/>
					) : null}
				</div>
			) : null}
		</div>
	);
}
