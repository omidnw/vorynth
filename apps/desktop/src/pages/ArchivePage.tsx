import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CollectionsExplorer } from "@/features/archive/CollectionsExplorer.js";
import { cn } from "@/lib/cn";
import {
	createBookmark,
	deleteBookmark,
	fetchArchiveItems,
	fetchCollections,
	patchArchiveItem,
} from "@/features/archive/archive-api.js";
import type { ArchiveItem } from "@vorynth/types";

/** Initial page size — the "show more" button fetches the next batch. */
const PAGE_SIZE = 10;

/**
 * Archive page (v1.6.0) — the unified user-owned intelligence space.
 *
 * Single-column centered layout matching every other Vorynth page. Search is a
 * lightweight section linking to `/archive/search`. Items list below with type
 * filters, text filter, and pagination via "Show more".
 */
export function ArchivePage() {
	const [q, setQ] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [showArchived, setShowArchived] = useState(false);
	const [limit, setLimit] = useState(PAGE_SIZE);
	const [noteFor, setNoteFor] = useState<string | null>(null);
	const [noteDraft, setNoteDraft] = useState("");
	const navigate = useNavigate();

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
		}): Promise<unknown> =>
			saved ? deleteBookmark(id) : createBookmark(id),
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
		() => (collectionsData?.items ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			kind: c.kind,
		})),
		[collectionsData],
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
		if (items.length > prevCountRef.current && prevCountRef.current > 0 && firstNewItemRef.current) {
			firstNewItemRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		prevCountRef.current = items.length;
	}, [items.length, filterKey]);

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			{/* Header */}
			<header className="mb-10">
				<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
					Archive
				</h2>
				<p className="max-w-prose font-body text-body-md text-on-surface-variant">
					Everything Vorynth has collected — stories, saved items, summaries,
					searches, and AI answers — in one searchable space.
				</p>
			</header>

			<div className="space-y-8">
				{/* Search entry + bookmarks shortcut */}
				<GhostCard className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<Icon name="search" className="text-[24px] text-on-surface-variant" />
						<div>
							<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
								Search
							</h3>
							<p className="font-body text-body-sm text-on-tertiary-container">
								Keyword and Ask-AI search across every collected article
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							icon="bookmark"
							onClick={() => navigate("/bookmarks")}
							title="Saved stories"
						>
							Bookmarks
						</Button>
						<Button
							variant="secondary"
							size="sm"
							icon="search"
							onClick={() => navigate("/archive/search")}
						>
							Open search
						</Button>
					</div>
				</GhostCard>

				{/* Collections explorer — file-explorer style tree */}
				<CollectionsExplorer />

				{/* Items browser */}
				<GhostCard>
					<div className="mb-4 flex items-center gap-3">
						<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							<Icon name="inventory_2" className="text-base" />
							Items
						</h3>
						<span className="font-mono text-[11px] tracking-widest text-on-tertiary-container">
							{total} {total === 1 ? "item" : "items"}
						</span>
						<button
							type="button"
							onClick={() => {
								setShowArchived((v) => !v);
								setLimit(PAGE_SIZE);
							}}
							className={cn(
								"ml-auto flex items-center gap-1 rounded px-2 py-1 font-label text-label-sm transition-colors",
								showArchived
									? "text-secondary"
									: "text-on-surface-variant hover:text-primary",
							)}
							aria-pressed={showArchived}
						>
							<Icon name={showArchived ? "unarchive" : "archive"} className="text-[16px]" />
							{showArchived ? "Showing archived" : "Show archived"}
						</button>
					</div>

					{/* Filter row */}
					<div className="mb-6 flex flex-wrap items-center gap-3">
						<div className="flex flex-wrap gap-1">
							{TYPE_FILTERS.map((f) => (
								<button
									key={f.key}
									type="button"
									onClick={() => {
										setTypeFilter(f.key);
										setLimit(PAGE_SIZE);
									}}
									aria-pressed={typeFilter === f.key}
									className={cn(
										"rounded px-3 py-1 font-label text-label-sm transition-colors",
										typeFilter === f.key
											? "bg-primary text-on-primary"
											: "text-on-surface-variant hover:bg-surface-container-high",
									)}
								>
									{f.label}
								</button>
							))}
						</div>
						<div className="ml-auto">
							<input
								type="search"
								value={q}
								onChange={(e) => {
									setQ(e.target.value);
									setLimit(PAGE_SIZE);
								}}
								placeholder="Filter by title or note…"
								aria-label="Filter items"
								className="w-56 rounded border border-outline-variant bg-surface-container-low px-3 py-1.5 font-body text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
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
										ref={idx === prevCountRef.current ? firstNewItemRef : undefined}
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
										className="inline-flex items-center gap-1.5 rounded font-label text-label-md text-primary transition-colors hover:text-secondary"
									>
										<Icon name="expand_more" className="text-[18px]" />
										Show more ({total - items.length} remaining)
									</button>
								</div>
							) : null}
						</>
					)}
				</GhostCard>

				{/* Tip: documentation */}
				<GhostCard className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<Icon name="menu_book" className="text-[24px] text-on-surface-variant" />
						<div>
							<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
								How the Archive works
							</h3>
							<p className="font-body text-body-sm text-on-tertiary-container">
								Categories, folders, tags, notes, and bookmarks explained
							</p>
						</div>
					</div>
					<Link
						to="/docs#archive"
						className="inline-flex items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
					>
						<Icon name="open_in_new" className="text-[16px]" />
						Read docs
					</Link>
				</GhostCard>
			</div>
		</section>
	);
}

// ── item row ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
	article: "Story",
	summary: "Summary",
	"keyword-search": "Search",
	"ai-ask": "Ask AI",
};

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
	onMove: (collectionId: string) => void;
	onOpen: () => void;
}) {
	return (
		<div className="border border-outline-variant rounded bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
			<div className="flex items-start gap-3">
				{/* Type badge */}
				<DomainTag className="mt-0.5 shrink-0">
					{TYPE_LABELS[item.contentType] ?? item.contentType}
				</DomainTag>

				{/* Title + meta */}
				<button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
					<span className="block truncate font-body text-body-md font-medium text-on-surface">
						{item.title ?? "Untitled"}
					</span>
					<span className="flex flex-wrap items-center gap-2 font-body text-body-sm text-on-surface-variant">
						{item.author ? <span>by {item.author}</span> : null}
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
								<span className="text-secondary">Saved</span>
							</>
						) : null}
						{item.archivedAt ? (
							<>
								<span className="h-1 w-1 rounded-full bg-outline-variant" />
								<span className="text-on-tertiary-container">Archived</span>
							</>
						) : null}
					</span>
				</button>

				{/* Actions */}
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={() => onToggleBookmark(item.bookmarked)}
						aria-label={item.bookmarked ? "Remove bookmark" : "Bookmark this item"}
						aria-pressed={item.bookmarked}
						className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
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
						aria-label="Edit note"
						aria-pressed={isNoteOpen}
						className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon name="note" className="text-[18px]" />
					</button>
					<button
						type="button"
						onClick={() => onToggleArchived(Boolean(item.archivedAt))}
						aria-label={item.archivedAt ? "Unarchive" : "Archive"}
						className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon name={item.archivedAt ? "unarchive" : "archive"} className="text-[18px]" />
					</button>
				</div>
			</div>

			{/* Note */}
			{item.note ? (
				<p className="mt-2 border-l-2 border-primary pl-3 font-body text-body-sm italic text-on-surface-variant">
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
						placeholder="Write a note…"
						className="w-full resize-y border border-outline-variant bg-transparent p-3 font-body text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onSaveNote(item.contentItemId)}
							className="rounded bg-primary px-3 py-1 font-label text-label-sm text-on-primary"
						>
							Save note
						</button>
						<button
							type="button"
							onClick={() => onToggleNote(item.contentItemId)}
							className="rounded px-3 py-1 font-label text-label-sm text-on-surface-variant"
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
							aria-label="Move to collection"
							placeholder={item.collectionId ? "Uncategorize" : "Move to…"}
							options={[
								{ value: "", label: item.collectionId ? "Uncategorize" : "Move to…", icon: "inbox" },
								...collections.map((c) => ({
									value: c.id,
									label: c.name,
									icon: c.kind === "category" ? "folder_special" : "folder",
								})),
							]}
							className="ml-auto w-48"
						/>
					) : null}
				</div>
			) : null}
		</div>
	);
}

// ── routing to detail pages ─────────────────────────────────────────────────

function detailPath(item: ArchiveItem): string {
	const origin = item.origin as { id?: string; period?: string } | null;
	if (!origin?.id) return "/archive";
	switch (item.contentType) {
		case "article":
			return `/articles/${origin.id}`;
		case "keyword-search":
		case "ai-ask":
			return `/history/search/${origin.id}`;
		case "summary":
			return "period" in origin
				? `/history/brief/${origin.id}`
				: `/history/generated/${origin.id}`;
		default:
			return "/archive";
	}
}

const TYPE_FILTERS: Array<{ key: string; label: string }> = [
	{ key: "", label: "All" },
	{ key: "article", label: "Stories" },
	{ key: "bookmarked", label: "Saved" },
	{ key: "summary", label: "Summaries" },
	{ key: "keyword-search", label: "Searches" },
	{ key: "ai-ask", label: "AI asks" },
];
