import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ArchiveItem } from "@vorynth/types";
import { typeMeta } from "./type-meta.js";

// ── create form ─────────────────────────────────────────────────────────────

/**
 * Create form — the kind is fixed by location (R-A11): at the root you create
 * a category, inside a folder you create a folder. No kind selector: the
 * engine refuses root folders and nested categories, so offering them would be
 * dead options.
 */
export function CreateForm({
	parentLabel,
	name,
	onName,
	onCreate,
	onCancel,
	error,
}: {
	parentLabel?: string;
	name: string;
	onName: (v: string) => void;
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

export function AddItemsPanel({
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
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h4 className="min-w-0 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
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
							<Icon
								name={typeMeta(item.contentType).icon}
								className="shrink-0 text-[14px] text-on-tertiary-container"
							/>
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
