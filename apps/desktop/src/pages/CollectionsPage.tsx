import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TypeBadge } from "@/features/archive/TypeBadge.js";
import { BOOKMARK_META } from "@/features/archive/type-meta.js";
import { detailPath } from "@/features/archive/detail-path.js";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import { CollectionCard } from "@/features/archive/CollectionCard.js";
import {
	CreateForm,
	AddItemsPanel,
} from "@/features/archive/collections-panels.js";
import {
	buildTree,
	findNodePath,
	subtreeFolderCount,
	subtreeItemCount,
} from "@/features/archive/collection-tree.js";
import { useArchiveUiStore } from "@/features/archive/archive-ui-store.js";
import {
	createCollection,
	deleteCollection,
	fetchArchiveItems,
	fetchCollections,
	patchArchiveItem,
	updateCollection,
} from "@/features/archive/archive-api.js";
import type { ArchiveItem } from "@vorynth/types";
import { cn } from "@/lib/cn";

/** Initial page size for the items list — "show more" fetches the next batch. */
const PAGE_SIZE = 20;

/**
 * Collections page (v1.7.0) — a Windows-Explorer style icon view of your
 * archive's folders.
 *
 * One window instead of a tree: the current folder's children render as big
 * folder cards. Single-click (or focus) selects a card and shows that folder's
 * items below; double-click (or Enter) goes inside — the breadcrumb and the
 * grid move in. Each card carries a ⋯ menu (Add items / New folder / Rename /
 * Delete). Items can be opened (detail page — Back returns to the same folder
 * and highlighted card, via archive-ui-store) or removed from their collection
 * (item stays in the archive).
 */
export function CollectionsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["archive"] });

	const currentCollectionId = useArchiveUiStore((s) => s.currentCollectionId);
	const selectedCollectionId = useArchiveUiStore((s) => s.selectedCollectionId);
	const setCurrent = useArchiveUiStore((s) => s.setCurrent);
	const setSelected = useArchiveUiStore((s) => s.setSelected);

	const { data: collectionsData } = useQuery({
		queryKey: ["archive", "collections"],
		queryFn: fetchCollections,
	});
	const { data: itemsData } = useQuery({
		queryKey: ["archive", "items", "all-for-collections"],
		queryFn: () => fetchArchiveItems({ limit: 200 }),
	});
	const collections = collectionsData?.items ?? [];
	const allItems = itemsData?.items ?? [];
	const tree = useMemo(
		() => buildTree(collections, allItems),
		[collections, allItems],
	);

	// If the current/selected collection was deleted elsewhere, fall back to
	// the root view once the collections list has loaded.
	useEffect(() => {
		if (!collectionsData) return;
		if (
			currentCollectionId &&
			!collections.some((c) => c.id === currentCollectionId)
		) {
			setCurrent(null);
		}
		if (
			selectedCollectionId &&
			!collections.some((c) => c.id === selectedCollectionId)
		) {
			setSelected(null);
		}
	}, [
		collectionsData,
		collections,
		currentCollectionId,
		selectedCollectionId,
		setCurrent,
		setSelected,
	]);

	// The folder we're "in" — its direct children render as the icon grid.
	// null = root (top-level collections).
	const currentPath = currentCollectionId
		? findNodePath(tree, currentCollectionId)
		: null;
	const currentNode = currentPath?.[currentPath.length - 1] ?? null;
	const gridChildren = currentNode ? currentNode.children : tree;

	// The folder whose items are listed below — the selected card, or the
	// folder we're in when nothing is singled out. The breadcrumb follows the
	// same path so it always explains what the items area shows.
	const viewCollectionId = selectedCollectionId ?? currentCollectionId;
	const viewPath = viewCollectionId
		? findNodePath(tree, viewCollectionId)
		: null;
	const viewNode = viewPath?.[viewPath.length - 1] ?? null;

	// Items of the view folder — Explorer semantics: only the folder's OWN
	// items (direct). Items in sub-folders belong to those folders and show
	// when you go inside them; the card's count label above still shows the
	// whole subtree at a glance.
	const [limit, setLimit] = useState(PAGE_SIZE);
	const { data: itemsPage, isPending } = useQuery({
		queryKey: ["archive", "items", "collection", viewCollectionId, limit],
		queryFn: () =>
			fetchArchiveItems({
				collectionId: viewCollectionId ?? undefined,
				direct: true,
				limit,
			}),
		enabled: Boolean(viewCollectionId),
	});
	useEffect(() => {
		setLimit(PAGE_SIZE);
	}, [viewCollectionId]);
	const items = itemsPage?.items ?? [];
	const total = itemsPage?.total ?? 0;
	const hasMore = itemsPage?.hasMore ?? false;

	// ── mutations ────────────────────────────────────────────────────────────

	const renameMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			updateCollection(id, { name }),
		onSuccess: () => {
			invalidate();
			setRenamingId(null);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteCollection(id),
		onSuccess: () => invalidate(),
	});
	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			kind: "category" | "folder";
			parentId?: string | null;
		}) => {
			const { name, kind, parentId } = input;
			return createCollection({ name, kind, parentId: parentId ?? undefined });
		},
		onSuccess: () => {
			invalidate();
			setShowCreate(null);
		},
	});
	const moveItemMutation = useMutation({
		mutationFn: ({
			itemId,
			collectionId,
		}: {
			itemId: string;
			collectionId: string | null;
		}) => patchArchiveItem(itemId, { collectionId }),
		onSuccess: () => {
			invalidate();
			setRemoveTarget(null);
		},
	});

	// ── local UI state ───────────────────────────────────────────────────────

	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const [showCreate, setShowCreate] = useState<string | "root" | null>(null);
	const [createName, setCreateName] = useState("");
	const [addItemsFor, setAddItemsFor] = useState<string | null>(null);
	const [addSearch, setAddSearch] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [removeTarget, setRemoveTarget] = useState<{
		itemId: string;
		title: string;
		collectionName: string;
	} | null>(null);

	const startRename = (c: { id: string; name: string }) => {
		setRenamingId(c.id);
		setRenameDraft(c.name);
	};
	const commitRename = (id: string) => {
		if (renameDraft.trim()) {
			renameMutation.mutate({ id, name: renameDraft.trim() });
		} else {
			setRenamingId(null);
		}
	};

	/** Open the create form — at root for a category, inside the current
	 *  folder for a sub-folder (R-A11: categories are roots only, so the kind
	 *  is fixed by location). */
	const startCreate = () => {
		setShowCreate(currentCollectionId ?? "root");
		setCreateName("");
	};

	// Filter the "add items" search to items NOT already in this collection.
	const addResults = useMemo(() => {
		if (!addItemsFor) return [];
		const needle = addSearch.trim().toLowerCase();
		return allItems
			.filter((item) => item.collectionId !== addItemsFor)
			.filter(
				(item) =>
					!needle ||
					(item.title ?? "").toLowerCase().includes(needle) ||
					(item.author ?? "").toLowerCase().includes(needle),
			)
			.slice(0, 12);
	}, [addItemsFor, addSearch, allItems]);

	// Windows-Explorer navigation:
	//   single-click → select (the items below update)
	//   double-click → go inside (breadcrumb + grid move in)
	//   breadcrumb   → jump up (grid moves back out)
	const selectCollection = (id: string) => setSelected(id);
	const openCollection = (id: string) => {
		setCurrent(id);
		setSelected(id);
	};
	const goTo = (id: string | null) => {
		setCurrent(id);
		setSelected(id);
	};

	/** Open an item's detail page — Back returns here via the UI store. */
	const openItem = (item: ArchiveItem) => navigate(detailPath(item));

	return (
		<ArchiveLayout
			title={t("collections.title")}
			subtitle={t("collections.subtitle")}
			docsSectionId="collections"
		>
			<GhostCard className="min-w-0">
				{/* Breadcrumb — the path to the folder whose items are shown.
				    Segments jump to that folder (grid moves in); "Collections"
				    returns to root. */}
				<nav
					aria-label={t("collections.breadcrumbAria")}
					className="mb-5 flex flex-wrap items-center gap-1 font-label text-label-sm"
				>
					{viewPath ? (
						<button
							type="button"
							onClick={() => goTo(null)}
							className="cursor-pointer rounded px-1 py-0.5 text-on-surface-variant transition-colors hover:text-primary"
						>
							{t("collections.title")}
						</button>
					) : (
						<span className="px-1 py-0.5 font-medium text-primary">
							{t("collections.title")}
						</span>
					)}
					{viewPath
						? viewPath.map((n, i) => (
								<Fragment key={n.id}>
									<Icon
										name="chevron_right"
										className="text-[14px] text-on-tertiary-container"
									/>
									{i === viewPath.length - 1 ? (
										<span className="px-1 py-0.5 font-medium text-primary">
											{n.name}
										</span>
									) : (
										<button
											type="button"
											onClick={() => goTo(n.id)}
											className="cursor-pointer rounded px-1 py-0.5 text-on-surface-variant transition-colors hover:text-primary"
										>
											{n.name}
										</button>
									)}
								</Fragment>
							))
						: null}
				</nav>

				{/* Folder icon grid — the current folder's direct children */}
				{gridChildren.length > 0 ? (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(min(8rem,100%),1fr))] gap-3">
						{gridChildren.map((node) => {
							const coll = collections.find((c) => c.id === node.id);
							if (!coll) return null;
							return (
								<CollectionCard
									key={node.id}
									collection={coll}
									itemCount={subtreeItemCount(node)}
									folderCount={subtreeFolderCount(node)}
									selected={selectedCollectionId === node.id}
									onSelect={selectCollection}
									onOpen={openCollection}
									renaming={renamingId === node.id}
									renameDraft={renameDraft}
									renameError={
										renamingId === node.id
											? renameMutation.error?.message
											: undefined
									}
									onRenameDraft={setRenameDraft}
									onCommitRename={commitRename}
									onCancelRename={() => setRenamingId(null)}
									onAddItems={(id) => {
										setAddItemsFor(id);
										setAddSearch("");
									}}
									onNewFolder={(id) => {
										setShowCreate(id);
										setCreateName("");
									}}
									onStartRename={startRename}
									onDelete={(id) => {
										const found = collections.find((c) => c.id === id);
										setDeleteTarget(found ? { id, name: found.name } : null);
									}}
								/>
							);
						})}
						{/* Same-size "+ New" tile — create a category (root) or a folder
						    (inside), Windows-Explorer style. */}
						<button
							type="button"
							onClick={startCreate}
							title={
								currentCollectionId
									? t("collections.createFolderInside")
									: t("collections.createTopLevelCategory")
							}
							className="group flex min-w-0 flex-col items-center gap-1.5 rounded-lg border border-dashed border-outline-variant px-3 py-4 text-center transition-colors hover:border-primary/60 hover:bg-surface-container-high"
						>
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors group-hover:bg-primary-container group-hover:text-primary">
								<Icon name="add" className="text-[28px]" />
							</span>
							<span className="w-full truncate font-body text-body-sm font-medium text-on-surface-variant group-hover:text-primary">
								{currentCollectionId
									? t("collections.newFolder")
									: t("collections.newCategory")}
							</span>
						</button>
					</div>
				) : (
					<div className="flex flex-col items-center gap-3 py-8 text-center">
						<Icon
							name="folder_open"
							className="text-[40px] text-on-tertiary-container"
						/>
						<p className="font-body text-body-md text-on-surface-variant">
							{currentCollectionId
								? t("collections.folderEmpty")
								: t("collections.noCollectionsYet")}
						</p>
						<button
							type="button"
							onClick={startCreate}
							className="inline-flex cursor-pointer items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
						>
							<Icon name="add" className="text-[16px]" />
							{currentCollectionId
								? t("collections.newFolder")
								: t("collections.newCategory")}
						</button>
					</div>
				)}

				{/* Create form / Add items panel */}
				{showCreate ? (
					<CreateForm
						parentLabel={
							showCreate === "root"
								? undefined
								: collections.find((c) => c.id === showCreate)?.name
						}
						name={createName}
						onName={setCreateName}
						error={createMutation.error?.message}
						onCreate={() => {
							if (!createName.trim()) return;
							createMutation.mutate({
								name: createName.trim(),
								kind: showCreate === "root" ? "category" : "folder",
								parentId: showCreate === "root" ? null : showCreate,
							});
						}}
						onCancel={() => setShowCreate(null)}
					/>
				) : null}
				{addItemsFor ? (
					<AddItemsPanel
						collectionName={
							collections.find((c) => c.id === addItemsFor)?.name ??
							t("collections.collection")
						}
						search={addSearch}
						onSearch={setAddSearch}
						results={addResults}
						onAdd={(itemId) =>
							moveItemMutation.mutate({
								itemId,
								collectionId: addItemsFor,
							})
						}
						onDone={() => setAddItemsFor(null)}
					/>
				) : null}

				{/* Items — everything inside the view folder's subtree */}
				<div className="mt-6 border-t border-outline-variant pt-5">
					<div className="mb-3 flex flex-wrap items-center gap-3">
						<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							<Icon name="inventory_2" className="text-base" />
							{t("collections.items")}
						</h3>
						<span className="font-mono text-[11px] tracking-widest text-on-tertiary-container">
							{viewCollectionId
								? t("collections.itemCount", { count: total })
								: ""}
						</span>
						{viewCollectionId ? (
							<button
								type="button"
								onClick={() => {
									setAddItemsFor(viewCollectionId);
									setAddSearch("");
								}}
								className="ms-auto inline-flex shrink-0 items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
								title={t("collections.moveItemsInto", {
									name: viewNode?.name ?? t("collections.thisFolder"),
								})}
							>
								<Icon name="add" className="text-[16px]" />
								{t("collections.addItems")}
							</button>
						) : null}
					</div>

					{!viewCollectionId ? (
						<div className="flex min-h-[10rem] flex-col items-center justify-center gap-3 text-center">
							<Icon
								name="folder_special"
								className="text-[48px] text-on-tertiary-container"
							/>
							<p className="font-body text-body-md text-on-surface-variant">
								{t("collections.clickFolderHint")}
							</p>
						</div>
					) : isPending ? (
						<p className="py-10 text-center font-body text-body-sm text-on-surface-variant">
							{t("collections.loadingItems")}
						</p>
					) : items.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-10 text-center">
							<Icon
								name="inbox"
								className="text-[40px] text-on-tertiary-container"
							/>
							<p className="font-body text-body-md text-on-surface-variant">
								{viewNode && viewNode.children.length > 0
									? t("collections.subfoldersHint", {
											folders: viewNode.children
												.map((c) => `"${c.name}"`)
												.join(", "),
										})
									: t("collections.noItemsHere")}
							</p>
						</div>
					) : (
						<>
							<div className="space-y-3">
								{items.map((item) => (
									<CollectionItemRow
										key={item.contentItemId}
										item={item}
										onOpen={() => openItem(item)}
										onRemove={() =>
											setRemoveTarget({
												itemId: item.contentItemId,
												title: item.title ?? t("collections.untitled"),
												collectionName:
													viewNode?.name ?? t("collections.collection"),
											})
										}
									/>
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
										{t("collections.showMore", {
											remaining: total - items.length,
										})}
									</button>
								</div>
							) : null}
						</>
					)}
				</div>
			</GhostCard>

			<ConfirmDialog
				open={Boolean(deleteTarget)}
				title={t("collections.moveToTrashTitle", {
					name: deleteTarget?.name ?? t("collections.collection"),
				})}
				message={t("collections.moveToTrashMessage", {
					name: deleteTarget?.name ?? "",
				})}
				confirmLabel={t("collections.moveToTrashConfirm")}
				icon="delete"
				danger
				onConfirm={() => {
					if (!deleteTarget) return;
					deleteMutation.mutate(deleteTarget.id);
					setDeleteTarget(null);
				}}
				onCancel={() => setDeleteTarget(null)}
			/>

			<ConfirmDialog
				open={Boolean(removeTarget)}
				title={t("collections.removeFromTitle", {
					name: removeTarget?.collectionName ?? t("collections.collection"),
				})}
				message={t("collections.removeFromMessage", {
					title: removeTarget?.title ?? t("collections.thisItem"),
				})}
				confirmLabel={t("collections.removeFromConfirm")}
				icon="link_off"
				danger={false}
				onConfirm={() => {
					if (!removeTarget) return;
					moveItemMutation.mutate({
						itemId: removeTarget.itemId,
						collectionId: null,
					});
				}}
				onCancel={() => setRemoveTarget(null)}
			/>
		</ArchiveLayout>
	);
}

// ── item row ────────────────────────────────────────────────────────────────

function CollectionItemRow({
	item,
	onOpen,
	onRemove,
}: {
	item: ArchiveItem;
	onOpen: () => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="rounded border border-outline-variant bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
			<div className="flex flex-wrap items-start gap-3">
				{/* Type badge with the type's own icon */}
				<TypeBadge contentType={item.contentType} className="mt-0.5 shrink-0" />

				{/* Title + meta */}
				<button
					type="button"
					onClick={onOpen}
					className="min-w-0 flex-1 cursor-pointer text-start"
					title={t("collections.openItem")}
				>
					<span className="block truncate font-body text-body-md font-medium text-on-surface">
						{item.title ?? t("collections.untitled")}
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
					</span>
				</button>

				{/* Remove from this collection */}
				<button
					type="button"
					onClick={onRemove}
					aria-label={t("collections.removeFromConfirm")}
					title={t("collections.removeFromConfirm")}
					className={cn(
						"shrink-0 cursor-pointer rounded p-1.5 text-on-surface-variant",
						"transition-colors hover:bg-surface-container-high hover:text-error",
					)}
				>
					<Icon name="link_off" className="text-[18px]" />
				</button>
			</div>
		</div>
	);
}
