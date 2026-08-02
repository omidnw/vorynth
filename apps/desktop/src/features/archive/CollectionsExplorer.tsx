import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import {
	createCollection,
	deleteCollection,
	fetchArchiveItems,
	fetchCollections,
	patchArchiveItem,
	updateCollection,
} from "@/features/archive/archive-api.js";
import type { ArchiveItem, Collection } from "@vorynth/types";

/**
 * Collections explorer (v1.6.0) — a file-explorer style tree for organizing
 * archive items.
 *
 * Features:
 *   • Tree view: categories (roots) → folders → items, expandable
 *   • Inline rename: click the title, edit, Enter to save / Esc to cancel
 *   • Add items: search the archive and move results into the collection
 *   • Delete: removes the collection (items move to uncategorized)
 *
 * Nesting is enforced by the engine (R-A11): category → folder → folder,
 * max depth 3.
 */
export function CollectionsExplorer() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["archive"] });

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

	const tree = useMemo(() => buildTree(collections, allItems), [collections, allItems]);

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
		onSuccess: invalidate,
	});
	const createMutation = useMutation({
		mutationFn: (input: { name: string; kind: "category" | "folder"; parentId?: string | null }) => {
			const { name, kind, parentId } = input;
			return createCollection({ name, kind, parentId: parentId ?? undefined });
		},
		onSuccess: () => {
			invalidate();
			setShowCreate(null);
		},
	});
	const moveItemMutation = useMutation({
		mutationFn: ({ itemId, collectionId }: { itemId: string; collectionId: string }) =>
			patchArchiveItem(itemId, { collectionId }),
		onSuccess: invalidate,
	});

	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const [showCreate, setShowCreate] = useState<string | "root" | null>(null);
	const [createName, setCreateName] = useState("");
	const [createKind, setCreateKind] = useState<"category" | "folder">("folder");
	const [addItemsFor, setAddItemsFor] = useState<string | null>(null);
	const [addSearch, setAddSearch] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

	const toggleExpand = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const startRename = (c: Collection) => {
		setRenamingId(c.id);
		setRenameDraft(c.name);
	};
	const commitRename = (id: string) => {
		if (renameDraft.trim()) renameMutation.mutate({ id, name: renameDraft.trim() });
		else setRenamingId(null);
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

	return (
		<GhostCard>
			<div className="mb-4 flex items-center justify-between gap-4">
				<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
					<Icon name="folder_special" className="text-base" />
					Collections
				</h3>
				<button
					type="button"
					onClick={() => {
						setShowCreate("root");
						setCreateKind("category");
						setCreateName("");
					}}
					className="inline-flex items-center gap-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
				>
					<Icon name="add" className="text-[16px]" />
					New category
				</button>
			</div>

			{tree.length === 0 && showCreate !== "root" ? (
				<p className="font-body text-body-sm text-on-tertiary-container">
					No collections yet. Create categories (semantic roots) and folders to
					organize your items.
				</p>
			) : (
				<div className="space-y-1">
					{tree.map((node) => (
						<CollectionNodeView
							key={node.id}
							node={node}
							level={0}
							expanded={expanded}
							onToggleExpand={toggleExpand}
							renamingId={renamingId}
							renameDraft={renameDraft}
							renameError={renamingId ? renameMutation.error?.message : undefined}
							onRenameDraft={setRenameDraft}
							onStartRename={startRename}
							onCommitRename={commitRename}
							onCancelRename={() => setRenamingId(null)}
							onDelete={(id) => {
								const found = collections.find((c) => c.id === id);
								setDeleteTarget(found ? { id, name: found.name } : null);
							}}
							onShowCreate={(parentId) => {
								setShowCreate(parentId);
								setCreateKind("folder");
								setCreateName("");
							}}
							onShowAddItems={(id) => {
								setAddItemsFor(id);
								setAddSearch("");
							}}
						/>
					))}
				</div>
			)}

			{/* Create form (root or nested) */}
				{showCreate ? (
					<CreateForm
						parentLabel={
							showCreate === "root"
								? undefined
								: collections.find((c) => c.id === showCreate)?.name
						}
						defaultKind={showCreate === "root" ? "category" : "folder"}
						name={createName}
						onName={setCreateName}
						kind={createKind}
						onKind={setCreateKind}
						error={createMutation.error?.message}
						onCreate={() => {
							if (!createName.trim()) return;
							createMutation.mutate({
								name: createName.trim(),
								kind: createKind,
								parentId: showCreate === "root" ? null : showCreate,
							});
						}}
						onCancel={() => setShowCreate(null)}
					/>
				) : null}

			{/* Add items to a collection */}
			{addItemsFor ? (
				<AddItemsPanel
					collectionName={
						collections.find((c) => c.id === addItemsFor)?.name ?? "collection"
					}
					search={addSearch}
					onSearch={setAddSearch}
					results={addResults}
					onAdd={(itemId) =>
						moveItemMutation.mutate({ itemId, collectionId: addItemsFor })
					}
					onDone={() => setAddItemsFor(null)}
				/>
			) : null}

			<p className="mt-3 font-body text-body-sm text-on-tertiary-container">
				Items move to uncategorized when their collection is deleted — nothing is
				lost.
			</p>

			<ConfirmDialog
				open={Boolean(deleteTarget)}
				title={`Delete "${deleteTarget?.name ?? "collection"}"?`}
				message={`The collection "${deleteTarget?.name ?? ""}" and all its sub-folders will be removed. Items inside them will move to uncategorized — no stories or data will be deleted.`}
				confirmLabel="Delete collection"
				icon="delete"
				danger
				onConfirm={() => {
					if (!deleteTarget) return;
					deleteMutation.mutate(deleteTarget.id);
					setDeleteTarget(null);
				}}
				onCancel={() => setDeleteTarget(null)}
			/>
		</GhostCard>
	);
}

// ── tree node view ──────────────────────────────────────────────────────────

interface TreeNode {
	id: string;
	name: string;
	kind: "category" | "folder";
	items: ArchiveItem[];
	children: TreeNode[];
}

function CollectionNodeView({
	node,
	level,
	expanded,
	onToggleExpand,
	renamingId,
	renameDraft,
	renameError,
	onRenameDraft,
	onStartRename,
	onCommitRename,
	onCancelRename,
	onDelete,
	onShowCreate,
	onShowAddItems,
}: {
	node: TreeNode;
	level: number;
	expanded: Set<string>;
	onToggleExpand: (id: string) => void;
	renamingId: string | null;
	renameDraft: string;
	/** Conflict/validation message for the in-progress rename, if any. */
	renameError?: string;
	onRenameDraft: (v: string) => void;
	onStartRename: (c: Collection) => void;
	onCommitRename: (id: string) => void;
	onCancelRename: () => void;
	onDelete: (id: string) => void;
	onShowCreate: (parentId: string) => void;
	onShowAddItems: (id: string) => void;
}) {
	const isOpen = expanded.has(node.id);
	const isRenaming = renamingId === node.id;
	const hasChildren = node.children.length > 0;
	const itemCount = node.items.length;

	return (
		<div>
			<div
				className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-container-high"
				style={{ paddingLeft: `${level * 16 + 8}px` }}
			>
				{/* Expand/collapse chevron */}
				<button
					type="button"
					onClick={() => onToggleExpand(node.id)}
					aria-label={isOpen ? "Collapse" : "Expand"}
					className="shrink-0 rounded p-0.5 text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon
						name={hasChildren || itemCount > 0 ? "chevron_right" : "fiber_manual_record"}
						className={cn(
							"text-[16px] transition-transform",
							isOpen && "rotate-90",
							!hasChildren && itemCount === 0 && "text-[8px] opacity-40",
						)}
					/>
				</button>

				{/* Folder/category icon */}
				<Icon
					name={node.kind === "category" ? "folder_special" : isOpen ? "folder_open" : "folder"}
					className="shrink-0 text-[18px] text-on-surface-variant"
					fill={node.kind === "category"}
				/>

				{/* Name or inline rename */}
				{isRenaming ? (
					<input
						autoFocus
						value={renameDraft}
						onChange={(e) => onRenameDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") onCommitRename(node.id);
							if (e.key === "Escape") onCancelRename();
						}}
						onBlur={() => onCommitRename(node.id)}
						className="min-w-0 flex-1 rounded border border-secondary bg-surface-container-lowest px-2 py-0.5 font-body text-body-sm text-on-surface outline-none"
					/>
				) : (
					<button
						type="button"
						onClick={() => onToggleExpand(node.id)}
						onDoubleClick={() =>
							onStartRename({
								id: node.id,
								name: node.name,
								kind: node.kind,
								parentId: null,
								description: null,
								llmGenerated: false,
								createdAt: "",
								updatedAt: "",
							})
						}
						className="min-w-0 flex-1 truncate text-left font-body text-body-md text-on-surface"
						title="Double-click to rename"
					>
						{node.name}
					</button>
				)}

				{/* Item count badge */}
				<span className="shrink-0 font-mono text-[11px] text-on-tertiary-container">
					{itemCount > 0 ? itemCount : ""}
				</span>

				{/* Actions (visible on hover) */}
				<div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						onClick={() => onShowAddItems(node.id)}
						aria-label="Add items"
						className="rounded p-1 text-on-surface-variant transition-colors hover:text-primary"
						title="Add items"
					>
						<Icon name="add" className="text-[16px]" />
					</button>
					{node.kind === "category" || node.kind === "folder" ? (
						<button
							type="button"
							onClick={() => onShowCreate(node.id)}
							aria-label="New folder"
							className="rounded p-1 text-on-surface-variant transition-colors hover:text-primary"
							title="New folder"
						>
							<Icon name="create_new_folder" className="text-[16px]" />
						</button>
					) : null}
					<button
						type="button"
						onClick={() =>
							onStartRename({
								id: node.id,
								name: node.name,
								kind: node.kind,
								parentId: null,
								description: null,
								llmGenerated: false,
								createdAt: "",
								updatedAt: "",
							})
						}
						aria-label="Rename"
						className="rounded p-1 text-on-surface-variant transition-colors hover:text-primary"
						title="Rename"
					>
						<Icon name="edit" className="text-[16px]" />
					</button>
					<button
						type="button"
						onClick={() => onDelete(node.id)}
						aria-label="Delete"
						className="rounded p-1 text-on-surface-variant transition-colors hover:text-error"
						title="Delete"
					>
						<Icon name="delete" className="text-[16px]" />
					</button>
					</div>
				</div>

				{/* Rename conflict message (keeps the input open for fixing) */}
				{isRenaming && renameError ? (
					<p
						className="font-mono text-mono-technical text-error"
						style={{ paddingLeft: `${level * 16 + 56}px` }}
					>
						{renameError}
					</p>
				) : null}

				{/* Expanded: children + items */}
				{isOpen ? (
					<div>
						{node.children.map((child) => (
							<CollectionNodeView
								key={child.id}
								node={child}
								level={level + 1}
								expanded={expanded}
								onToggleExpand={onToggleExpand}
								renamingId={renamingId}
								renameDraft={renameDraft}
								renameError={renameError}
								onRenameDraft={onRenameDraft}
								onStartRename={onStartRename}
								onCommitRename={onCommitRename}
								onCancelRename={onCancelRename}
								onDelete={onDelete}
								onShowCreate={onShowCreate}
								onShowAddItems={onShowAddItems}
							/>
						))}
					{node.items.map((item) => (
						<ItemInCollection
							key={item.contentItemId}
							item={item}
							level={level + 1}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function ItemInCollection({ item, level }: { item: ArchiveItem; level: number }) {
	return (
		<div
			className="flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-container"
			style={{ paddingLeft: `${level * 16 + 28}px` }}
		>
			<Icon name="article" className="shrink-0 text-[14px] text-on-tertiary-container" />
			<span className="min-w-0 flex-1 truncate font-body text-body-sm text-on-surface-variant">
				{item.title ?? "Untitled"}
			</span>
		</div>
	);
}

// ── create form ─────────────────────────────────────────────────────────────

function CreateForm({
	parentLabel,
	defaultKind,
	name,
	onName,
	kind,
	onKind,
	onCreate,
	onCancel,
	error,
}: {
	parentLabel?: string;
	defaultKind: "category" | "folder";
	name: string;
	onName: (v: string) => void;
	kind: "category" | "folder";
	onKind: (v: "category" | "folder") => void;
	onCreate: () => void;
	onCancel: () => void;
	/** Conflict/validation message — the form stays open so the user can fix it. */
	error?: string;
}) {
	return (
		<div className="mt-4 space-y-3 border-l-2 border-l-primary bg-surface-container-low p-4 rounded">
			<h4 className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				{parentLabel ? `New folder in "${parentLabel}"` : "New category"}
			</h4>
			<Input
				value={name}
				onChange={(e) => onName(e.target.value)}
				placeholder="Name…"
				aria-label="Collection name"
				autoFocus
				onKeyDown={(e) => {
					if (e.key === "Enter") onCreate();
					if (e.key === "Escape") onCancel();
				}}
			/>
			{defaultKind === "folder" ? (
				<div className="flex items-center gap-2">
					<span className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						Type
					</span>
					<button
						type="button"
						onClick={() => onKind("folder")}
						className={cn(
							"rounded px-3 py-1 font-label text-label-sm transition-colors",
							kind === "folder"
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:bg-surface-container-high",
						)}
					>
						Folder
					</button>
					<button
						type="button"
						onClick={() => onKind("category")}
						className={cn(
							"rounded px-3 py-1 font-label text-label-sm transition-colors",
							kind === "category"
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:bg-surface-container-high",
						)}
					>
						Category
					</button>
				</div>
			) : null}
				{error ? (
					<p className="font-mono text-mono-technical text-error">{error}</p>
				) : null}
				<div className="flex gap-2">
					<Button size="sm" onClick={onCreate} disabled={!name.trim()}>
						Create
					</Button>
					<Button size="sm" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
		</div>
	);
}

// ── add items panel ─────────────────────────────────────────────────────────

function AddItemsPanel({
	collectionName,
	search,
	onSearch,
	results,
	onAdd,
	onDone,
}: {
	collectionName: string;
	search: string;
	onSearch: (v: string) => void;
	results: ArchiveItem[];
	onAdd: (itemId: string) => void;
	onDone: () => void;
}) {
	return (
		<div className="mt-4 space-y-3 border-l-2 border-l-secondary bg-surface-container-low p-4 rounded">
			<div className="flex items-center justify-between gap-4">
				<h4 className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					Add items to "{collectionName}"
				</h4>
				<button
					type="button"
					onClick={onDone}
					className="font-label text-label-sm text-on-surface-variant hover:text-primary"
				>
					Done
				</button>
			</div>
			<Input
				value={search}
				onChange={(e) => onSearch(e.target.value)}
				placeholder="Search items to add…"
				icon="search"
				aria-label="Search items"
			/>
			{results.length === 0 ? (
				<p className="font-body text-body-sm text-on-tertiary-container">
					{search.trim()
						? "No matching items."
						: "Type to search your archive items."}
				</p>
			) : (
				<div className="max-h-48 space-y-1 overflow-auto">
					{results.map((item) => (
						<div
							key={item.contentItemId}
							className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-container"
						>
							<Icon name="article" className="shrink-0 text-[14px] text-on-tertiary-container" />
							<span className="min-w-0 flex-1 truncate font-body text-body-sm text-on-surface">
								{item.title ?? "Untitled"}
							</span>
							<button
								type="button"
								onClick={() => onAdd(item.contentItemId)}
								className="shrink-0 rounded px-2 py-0.5 font-label text-label-sm text-primary transition-colors hover:bg-primary hover:text-on-primary"
							>
								Add
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── tree builder ────────────────────────────────────────────────────────────

function buildTree(collections: Collection[], items: ArchiveItem[]): TreeNode[] {
	const nodes = new Map<string, TreeNode>();
	for (const c of collections) {
		nodes.set(c.id, {
			id: c.id,
			name: c.name,
			kind: c.kind,
			items: [],
			children: [],
		});
	}

	// Attach items to their collections.
	for (const item of items) {
		if (item.collectionId && nodes.has(item.collectionId)) {
			nodes.get(item.collectionId)!.items.push(item);
		}
	}

	// Build the tree: roots are collections with no parent; children attach to parents.
	const roots: TreeNode[] = [];
	for (const c of collections) {
		const node = nodes.get(c.id)!;
		if (c.parentId && nodes.has(c.parentId)) {
			nodes.get(c.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}
