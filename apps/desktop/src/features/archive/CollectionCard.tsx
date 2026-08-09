import { useTranslation } from "react-i18next";
import { MenuButton, type MenuItem } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Collection } from "@vorynth/types";

/**
 * One folder card in the Collections icon view (v1.7.0) — Windows-Explorer
 * style: a big folder icon with the name below.
 *
 *   • Single-click / focus → select (highlight; that folder's items show below)
 *   • Double-click / Enter  → go inside (breadcrumb + grid navigate in)
 *   • ⋯ menu (hover / selected / focus) → Add items · New folder · Rename ·
 *     Delete
 *
 * Renaming swaps the name for an inline input (Enter saves, Esc cancels). The
 * card is a `role="button"` with its own tab stop; the ⋯ trigger is a real
 * nested button so the menu stays keyboard-accessible.
 */
export function CollectionCard({
	collection,
	itemCount,
	folderCount,
	selected,
	onSelect,
	onOpen,
	renaming,
	renameDraft,
	renameError,
	onRenameDraft,
	onCommitRename,
	onCancelRename,
	onAddItems,
	onNewFolder,
	onStartRename,
	onDelete,
}: {
	collection: Collection;
	/** Total items inside the folder's whole subtree. */
	itemCount: number;
	/** Total sub-folders inside the folder's whole subtree. */
	folderCount: number;
	selected: boolean;
	onSelect: (id: string) => void;
	onOpen: (id: string) => void;
	renaming: boolean;
	renameDraft: string;
	/** Conflict/validation message for the in-progress rename, if any. */
	renameError?: string;
	onRenameDraft: (v: string) => void;
	onCommitRename: (id: string) => void;
	onCancelRename: () => void;
	onAddItems: (id: string) => void;
	onNewFolder: (id: string) => void;
	onStartRename: (c: Collection) => void;
	onDelete: (id: string) => void;
}) {
	const { t } = useTranslation();
	const isCategory = collection.kind === "category";

	// The count line tells the user at a glance what's inside: sub-folders and
	// items (e.g. "2 folders · 5 items"), or "Empty" for a bare folder.
	const countParts: string[] = [];
	if (folderCount > 0) {
		countParts.push(t("collections.folders", { count: folderCount }));
	}
	if (itemCount > 0) {
		countParts.push(t("collections.items", { count: itemCount }));
	}
	const countLabel =
		countParts.length > 0 ? countParts.join(" · ") : t("collections.empty");

	const menuItems: MenuItem[] = [
		{
			key: "add-items",
			label: t("collections.addItems"),
			icon: "add",
			onClick: () => onAddItems(collection.id),
		},
		{
			key: "new-folder",
			label: t("collections.newFolder"),
			icon: "create_new_folder",
			onClick: () => onNewFolder(collection.id),
		},
		{
			key: "rename",
			label: t("collections.rename"),
			icon: "edit",
			onClick: () => onStartRename(collection),
		},
		{
			key: "delete",
			label: t("collections.delete"),
			icon: "delete",
			danger: true,
			onClick: () => onDelete(collection.id),
		},
	];

	return (
		<div
			role="button"
			tabIndex={0}
			aria-label={collection.name}
			title={
				isCategory ? t("collections.categoryHint") : t("collections.folderHint")
			}
			onClick={() => onSelect(collection.id)}
			onFocus={() => onSelect(collection.id)}
			onDoubleClick={() => onOpen(collection.id)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen(collection.id);
				}
			}}
			className={cn(
				"group relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-4 text-center outline-none transition-colors",
				selected
					? "border-primary bg-primary-container/30 ring-1 ring-primary"
					: "border-outline-variant bg-surface-container-low hover:border-primary/50 hover:bg-surface-container-high",
				"focus-visible:ring-2 focus-visible:ring-secondary",
			)}
		>
			{/* ⋯ menu — revealed on hover/selected/focus, never occupies layout
			    space (hidden until then, so narrow grids can't overflow).
			    Clicks are stopped here so opening the menu never double-opens
			    the folder. */}
			<div
				className="absolute end-1.5 top-1.5 hidden shrink-0 group-hover:flex group-focus-within:flex"
				onClick={(e) => e.stopPropagation()}
				onDoubleClick={(e) => e.stopPropagation()}
			>
				<MenuButton
					aria-label={t("collections.actionsFor", {
						name: collection.name,
					})}
					items={menuItems}
				/>
			</div>

			{/* Big folder icon — filled for categories, plain for folders */}
			<Icon
				name={isCategory ? "folder_special" : "folder"}
				fill={isCategory}
				className={cn(
					"text-[48px]",
					isCategory ? "text-secondary" : "text-on-surface-variant",
				)}
			/>

			{/* Name or inline rename */}
			{renaming ? (
				<input
					autoFocus
					value={renameDraft}
					onChange={(e) => onRenameDraft(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter") onCommitRename(collection.id);
						if (e.key === "Escape") onCancelRename();
					}}
					onBlur={() => onCommitRename(collection.id)}
					aria-label={t("collections.renameFor", {
						name: collection.name,
					})}
					className="w-full min-w-0 rounded border border-secondary bg-surface-container-lowest px-1.5 py-0.5 text-center font-body text-body-sm text-on-surface outline-none"
				/>
			) : (
				<span
					className="w-full truncate font-body text-body-sm font-medium text-on-surface"
					title={collection.name}
				>
					{collection.name}
				</span>
			)}

			<span className="font-mono text-[11px] text-on-tertiary-container">
				{countLabel}
			</span>

			{renaming && renameError ? (
				<p className="font-mono text-mono-technical text-error">
					{renameError}
				</p>
			) : null}
		</div>
	);
}
