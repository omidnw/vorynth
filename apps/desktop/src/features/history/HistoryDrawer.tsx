import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AppSettings,
	BriefHistoryEntry,
	GeneratedHistoryEntry,
	SearchHistoryEntry,
	SearchMode,
} from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { cn } from "@/lib/cn";
import {
	deleteBriefEntries,
	deleteGeneratedEntries,
	deleteSearchEntries,
	fetchBriefHistory,
	fetchGeneratedHistory,
	fetchSearchHistory,
	patchBriefEntry,
	patchGeneratedEntry,
	patchSearchEntry,
} from "./history-api.js";
import { useHistoryStore, type HistoryScope } from "./history-store.js";

/**
 * Right-side History drawer.
 *
 * Context-aware: on `/brief` it shows briefing history; everywhere else it
 * shows search history. One header button (in ShellLayout) opens it.
 *
 * Three interaction modes baked in:
 *   • List view — click a row to open the cached result.
 *   • Detail view — renders the saved answer/briefing; a secondary action can
 *     re-run the query when the user is on the matching page.
 *   • Select mode — checkbox per row + bulk archive/delete.
 *
 * Mounted once inside <ShellLayout> (next to <JobsTray>) so open/close state
 * survives route changes.
 */
export function HistoryDrawer() {
	const { open, scope, closeDrawer, setScope } = useHistoryStore();

	// Snap scope to the current route whenever the drawer opens.
	const location = useLocation();
	useEffect(() => {
		if (!open) return;
		const path = location.pathname;
		const next: HistoryScope = path.startsWith("/brief")
			? "brief"
			: path.startsWith("/profile")
				? "generated"
				: "search";
		if (next !== scope) setScope(next);
	}, [open, location.pathname, scope, setScope]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50">
			{/* Click-away backdrop */}
			<button
				type="button"
				aria-label="Close history"
				onClick={closeDrawer}
				className="absolute inset-0 bg-on-surface/20 backdrop-blur-[1px]"
			/>
			{/* Drawer panel — RTL-aware: pinned to the inline-end edge. */}
			<aside
				className={cn(
					"absolute top-0 flex h-screen w-[420px] max-w-[92vw] flex-col border-outline-variant bg-surface-container-lowest shadow-2xl",
					// LTR: right edge. RTL: left edge (flipped by the rtl-flip utility).
					"end-0 border-l rtl:border-l-0 rtl:border-r",
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<DrawerHeader />
				<DrawerBody />
			</aside>
		</div>
	);
}

// ── Header ─────────────────────────────────────────────────────────────────

function DrawerHeader() {
	const { scope, closeDrawer } = useHistoryStore();
	// The drawer silently follows the current page: on /brief it shows
	// briefings, on /profile it shows generated summaries, everywhere else
	// searches. No toggle — the title makes it obvious which one the user is
	// looking at.
	const meta =
		scope === "brief"
			? { icon: "today", title: "Briefing History", sub: "from Today's Brief" }
			: scope === "generated"
				? {
						icon: "auto_awesome",
						title: "Generated History",
						sub: "from Profile",
					}
				: { icon: "search", title: "Search History", sub: "from Search" };
	return (
		<header className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
			<div className="flex items-center gap-2">
				<Icon name={meta.icon} className="text-[20px] text-primary" />
				<div>
					<h2 className="font-label text-label-md uppercase tracking-widest text-on-surface">
						{meta.title}
					</h2>
					<p className="font-mono text-[10px] uppercase tracking-widest text-on-tertiary-container">
						{meta.sub}
					</p>
				</div>
			</div>
			<button
				type="button"
				onClick={closeDrawer}
				aria-label="Close"
				className="text-on-surface-variant transition-colors hover:text-primary"
			>
				<Icon name="close" />
			</button>
		</header>
	);
}

// ── Body ───────────────────────────────────────────────────────────────────

function DrawerBody() {
	const { scope, selectMode } = useHistoryStore();
	return (
		<>
			{scope === "search" ? (
				<SearchList />
			) : scope === "generated" ? (
				<GeneratedList />
			) : (
				<BriefList />
			)}
			{selectMode ? <BulkActionBar scope={scope} /> : null}
		</>
	);
}

// ── Search list ────────────────────────────────────────────────────────────

function SearchList() {
	const navigate = useNavigate();
	const {
		mutationNonce,
		selectMode,
		selectedIds,
		toggleSelect,
		setSelectMode,
	} = useHistoryStore();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const qc = useQueryClient();
	const { data, isLoading, error } = useQuery({
		queryKey: ["history", "search", mutationNonce],
		queryFn: () => fetchSearchHistory(true),
		staleTime: 10_000,
	});

	if (isLoading) return <DrawerLoading />;
	if (error) return <DrawerError message={(error as Error).message} />;

	const items = data?.items ?? [];
	if (items.length === 0) {
		return (
			<EmptyState
				icon="search"
				title="No searches yet"
				body="Run a keyword or Ask-AI search and it'll show up here. Ask-AI answers are saved by default; keyword recording can be enabled in Settings."
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{items.length} entries
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? "Done" : "Select"}
				</button>
			</div>
			<ul className="space-y-2">
				{items.map((e) => (
					<SearchRow
						key={e.id}
						entry={e}
						selectMode={selectMode}
						selected={selectedIds.has(e.id)}
						onToggle={() => toggleSelect(e.id)}
						onOpen={() => {
							closeDrawer();
							navigate(`/history/search/${e.id}`);
						}}
						onArchive={async () => {
							await patchSearchEntry(e.id, { archived: !e.archived });
							void qc.invalidateQueries({ queryKey: ["history", "search"] });
							useHistoryStore.getState().noteMutation();
						}}
					/>
				))}
			</ul>
		</div>
	);
}

function SearchRow({
	entry,
	selectMode,
	selected,
	onToggle,
	onOpen,
	onArchive,
}: {
	entry: SearchHistoryEntry;
	selectMode: boolean;
	selected: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onArchive: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<li>
			<GhostCard
				interactive={!selectMode}
				onClick={selectMode ? onToggle : onOpen}
				className={cn(
					"relative p-4",
					selected && "ring-1 ring-primary",
					entry.archived && "opacity-60",
				)}
			>
				<div className="flex items-start gap-3">
					{selectMode ? (
						<span
							className={cn(
								"mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border",
								selected
									? "border-primary bg-primary text-on-primary"
									: "border-outline-variant",
							)}
						>
							{selected ? (
								<Icon name="check" className="text-[12px]" fill />
							) : null}
						</span>
					) : (
						<ModeBadge mode={entry.mode} />
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate font-body text-body-md font-medium text-on-surface">
							{entry.title}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(entry.createdAt)}</span>
							<span>· {entry.hitCount} hits</span>
							{entry.tokensUsed > 0 ? (
								<span>· {entry.tokensUsed.toLocaleString()} tokens</span>
							) : null}
							{entry.archived ? <span>· archived</span> : null}
						</div>
					</div>
					{!selectMode ? (
						<div className="relative">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								}}
								className="text-on-surface-variant hover:text-primary"
								aria-label="More actions"
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute right-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon="drive_file_rename_outline"
										label="Rename"
										onClick={() => {
											setMenuOpen(false);
											const next = window.prompt("Rename entry", entry.title);
											if (next && next.trim())
												void patchSearchEntry(entry.id, {
													title: next.trim(),
												}).then(() => {
													useHistoryStore.getState().noteMutation();
												});
										}}
									/>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={entry.archived ? "Unarchive" : "Archive"}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label="Delete"
										danger
										onClick={() => {
											setMenuOpen(false);
											if (window.confirm("Delete this entry permanently?"))
												void deleteSearchEntries([entry.id]).then(() => {
													useHistoryStore.getState().noteMutation();
												});
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
		</li>
	);
}

// ── Brief list ─────────────────────────────────────────────────────────────

function BriefList() {
	const navigate = useNavigate();
	const {
		mutationNonce,
		selectMode,
		selectedIds,
		toggleSelect,
		setSelectMode,
	} = useHistoryStore();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const qc = useQueryClient();
	const { data, isLoading, error } = useQuery({
		queryKey: ["history", "brief", mutationNonce],
		queryFn: () => fetchBriefHistory(true),
		staleTime: 10_000,
	});

	if (isLoading) return <DrawerLoading />;
	if (error) return <DrawerError message={(error as Error).message} />;

	const items = data?.items ?? [];
	if (items.length === 0) {
		return (
			<EmptyState
				icon="today"
				title="No briefings saved"
				body="Generate a period summary from Today's Brief and it'll be saved here automatically, so you can revisit it without regenerating."
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{items.length} entries
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? "Done" : "Select"}
				</button>
			</div>
			<ul className="space-y-2">
				{items.map((e) => (
					<BriefRow
						key={e.id}
						entry={e}
						selectMode={selectMode}
						selected={selectedIds.has(e.id)}
						onToggle={() => toggleSelect(e.id)}
						onOpen={() => {
							closeDrawer();
							navigate(`/history/brief/${e.id}`);
						}}
						onArchive={async () => {
							await patchBriefEntry(e.id, { archived: !e.archived });
							void qc.invalidateQueries({ queryKey: ["history", "brief"] });
							useHistoryStore.getState().noteMutation();
						}}
					/>
				))}
			</ul>
		</div>
	);
}

function BriefRow({
	entry,
	selectMode,
	selected,
	onToggle,
	onOpen,
	onArchive,
}: {
	entry: BriefHistoryEntry;
	selectMode: boolean;
	selected: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onArchive: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<li>
			<GhostCard
				interactive={!selectMode}
				onClick={selectMode ? onToggle : onOpen}
				className={cn(
					"relative p-4",
					selected && "ring-1 ring-primary",
					entry.archived && "opacity-60",
				)}
			>
				<div className="flex items-start gap-3">
					{selectMode ? (
						<span
							className={cn(
								"mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border",
								selected
									? "border-primary bg-primary text-on-primary"
									: "border-outline-variant",
							)}
						>
							{selected ? (
								<Icon name="check" className="text-[12px]" fill />
							) : null}
						</span>
					) : (
						<PeriodBadge period={entry.period} />
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate font-body text-body-md font-medium text-on-surface">
							{entry.title}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(entry.createdAt)}</span>
							<span>· {entry.storyCount} stories</span>
							{entry.archived ? <span>· archived</span> : null}
						</div>
					</div>
					{!selectMode ? (
						<div className="relative">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								}}
								className="text-on-surface-variant hover:text-primary"
								aria-label="More actions"
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute right-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon="drive_file_rename_outline"
										label="Rename"
										onClick={() => {
											setMenuOpen(false);
											const next = window.prompt("Rename entry", entry.title);
											if (next && next.trim())
												void patchBriefEntry(entry.id, {
													title: next.trim(),
												}).then(() => {
													useHistoryStore.getState().noteMutation();
												});
										}}
									/>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={entry.archived ? "Unarchive" : "Archive"}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label="Delete"
										danger
										onClick={() => {
											setMenuOpen(false);
											if (window.confirm("Delete this entry permanently?"))
												void deleteBriefEntries([entry.id]).then(() => {
													useHistoryStore.getState().noteMutation();
												});
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
		</li>
	);
}

// ── Generated list ──────────────────────────────────────────────────────────

function GeneratedList() {
	const navigate = useNavigate();
	const {
		mutationNonce,
		selectMode,
		selectedIds,
		toggleSelect,
		setSelectMode,
	} = useHistoryStore();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const qc = useQueryClient();
	const { data, isLoading, error } = useQuery({
		queryKey: ["history", "generated", mutationNonce],
		queryFn: () => fetchGeneratedHistory(true),
		staleTime: 10_000,
	});

	if (isLoading) return <DrawerLoading />;
	if (error) return <DrawerError message={(error as Error).message} />;

	const items = data?.items ?? [];
	if (items.length === 0) {
		return (
			<EmptyState
				icon="auto_awesome"
				title="No generations yet"
				body="Generate a behavior summary or improve a custom instruction from the Profile page and each one will be saved here."
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{items.length} entries
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? "Done" : "Select"}
				</button>
			</div>
			<ul className="space-y-2">
				{items.map((e) => (
					<GeneratedRow
						key={e.id}
						entry={e}
						selectMode={selectMode}
						selected={selectedIds.has(e.id)}
						onToggle={() => toggleSelect(e.id)}
						onOpen={() => {
							closeDrawer();
							navigate(`/history/generated/${e.id}`);
						}}
						onArchive={async () => {
							await patchGeneratedEntry(e.id, { archived: !e.archived });
							void qc.invalidateQueries({ queryKey: ["history", "generated"] });
							useHistoryStore.getState().noteMutation();
						}}
					/>
				))}
			</ul>
		</div>
	);
}

function GeneratedRow({
	entry,
	selectMode,
	selected,
	onToggle,
	onOpen,
	onArchive,
}: {
	entry: GeneratedHistoryEntry;
	selectMode: boolean;
	selected: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onArchive: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<li>
			<GhostCard
				interactive={!selectMode}
				onClick={selectMode ? onToggle : onOpen}
				className={cn(
					"relative p-4",
					selected && "ring-1 ring-primary",
					entry.archived && "opacity-60",
				)}
			>
				<div className="flex items-start gap-3">
					{selectMode ? (
						<span
							className={cn(
								"mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border",
								selected
									? "border-primary bg-primary text-on-primary"
									: "border-outline-variant",
							)}
						>
							{selected ? (
								<Icon name="check" className="text-[12px]" fill />
							) : null}
						</span>
					) : (
						<KindBadge kind={entry.kind} />
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate font-body text-body-md font-medium text-on-surface">
							{entry.title}
						</p>
						<p className="mt-0.5 line-clamp-2 font-body text-body-sm text-on-surface-variant">
							{entry.result}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(entry.createdAt)}</span>
							{entry.tokensUsed > 0 ? (
								<span>· {entry.tokensUsed.toLocaleString()} tokens</span>
							) : null}
							{entry.archived ? <span>· archived</span> : null}
						</div>
					</div>
					{!selectMode ? (
						<div className="relative">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								}}
								className="text-on-surface-variant hover:text-primary"
								aria-label="More actions"
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute right-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={entry.archived ? "Unarchive" : "Archive"}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label="Delete"
										danger
										onClick={() => {
											setMenuOpen(false);
											if (window.confirm("Delete this entry permanently?"))
												void deleteGeneratedEntries([entry.id]).then(() => {
													useHistoryStore.getState().noteMutation();
												});
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
		</li>
	);
}

// ── Bulk actions ───────────────────────────────────────────────────────────

function BulkActionBar({ scope }: { scope: HistoryScope }) {
	const { selectedIds, clearSelection, setSelectMode } = useHistoryStore();
	const qc = useQueryClient();
	const count = selectedIds.size;
	if (count === 0) {
		return (
			<div className="border-t border-outline-variant px-5 py-3 text-center font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
				Select entries to enable bulk actions
			</div>
		);
	}
	const ids = [...selectedIds];
	const doArchive = async () => {
		const patch =
			scope === "search"
				? patchSearchEntry
				: scope === "generated"
					? patchGeneratedEntry
					: patchBriefEntry;
		await Promise.all(ids.map((id) => patch(id, { archived: true })));
		void qc.invalidateQueries({ queryKey: ["history", scope] });
		useHistoryStore.getState().noteMutation();
		clearSelection();
	};
	const doDelete = async () => {
		if (!window.confirm(`Delete ${count} entries permanently?`)) return;
		const del =
			scope === "search"
				? deleteSearchEntries
				: scope === "generated"
					? deleteGeneratedEntries
					: deleteBriefEntries;
		await del(ids);
		void qc.invalidateQueries({ queryKey: ["history", scope] });
		useHistoryStore.getState().noteMutation();
		setSelectMode(false);
	};
	return (
		<div className="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-5 py-3">
			<span className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
				{count} selected
			</span>
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" icon="archive" onClick={doArchive}>
					Archive
				</Button>
				<Button variant="secondary" size="sm" icon="delete" onClick={doDelete}>
					Delete
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setSelectMode(false)}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

function ModeBadge({ mode }: { mode: SearchMode }) {
	return (
		<span
			className={cn(
				"inline-flex flex-none items-center rounded px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest",
				mode === "ai"
					? "bg-primary-container text-on-primary-container"
					: "bg-surface-variant text-on-surface-variant",
			)}
		>
			{mode === "ai" ? "AI" : "KW"}
		</span>
	);
}

function PeriodBadge({ period }: { period: BriefHistoryEntry["period"] }) {
	const label =
		period === "today"
			? "Today"
			: period === "week"
				? "Week"
				: period === "month"
					? "Month"
					: "All";
	const icon =
		period === "today"
			? "today"
			: period === "week"
				? "date_range"
				: period === "month"
					? "calendar_month"
					: "all_inclusive";
	return (
		<span className="inline-flex flex-none items-center gap-1 rounded bg-secondary-container px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest text-on-secondary-container">
			<Icon name={icon} className="text-[12px]" />
			{label}
		</span>
	);
}

function KindBadge({ kind }: { kind: GeneratedHistoryEntry["kind"] }) {
	const isSummary = kind === "behavior-summary";
	return (
		<span className="inline-flex flex-none items-center gap-1 rounded bg-primary-container px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest text-on-primary-container">
			<Icon name={isSummary ? "insights" : "tune"} className="text-[12px]" />
			{isSummary ? "Summary" : "Instruction"}
		</span>
	);
}

function MenuItem({
	icon,
	label,
	onClick,
	danger,
}: {
	icon: string;
	label: string;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-2 px-3 py-1.5 text-left font-body text-body-sm transition-colors hover:bg-surface-container",
				danger ? "text-error" : "text-on-surface",
			)}
		>
			<Icon name={icon} className="text-[16px]" />
			{label}
		</button>
	);
}

function DrawerLoading() {
	return (
		<div className="flex flex-1 items-center justify-center gap-2 text-on-surface-variant">
			<Icon name="sync" className="animate-spin text-[18px]" />
			<span className="font-mono text-[11px] uppercase tracking-widest">
				Loading…
			</span>
		</div>
	);
}

function DrawerError({ message }: { message: string }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
			<Icon name="error" className="text-[24px] text-error" />
			<p className="font-body text-body-sm text-on-surface-variant">
				{message}
			</p>
		</div>
	);
}

function EmptyState({
	icon,
	title,
	body,
}: {
	icon: string;
	title: string;
	body: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
			<Icon name={icon} className="text-[32px] text-on-tertiary-container" />
			<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface">
				{title}
			</h3>
			<p className="font-body text-body-sm text-on-surface-variant">{body}</p>
		</div>
	);
}

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return "just now";
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 30) return `${day}d ago`;
	const mo = Math.round(day / 30);
	if (mo < 12) return `${mo}mo ago`;
	return `${Math.round(mo / 12)}y ago`;
}

// Re-export so SettingsPage can read/write app settings via the same module.
export { fetchSettings, patchSettings } from "./history-api.js";
export type { AppSettings };
