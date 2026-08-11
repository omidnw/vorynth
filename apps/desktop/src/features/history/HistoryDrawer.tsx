import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
	AppSettings,
	BriefHistoryEntry,
	GeneratedHistoryEntry,
	SearchHistoryEntry,
	SearchMode,
} from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { GhostCard } from "@/components/ui/GhostCard";
import { Reveal } from "@/components/ui/Reveal";
import { DismissibleTip } from "@/components/ui/DismissibleTip";
import { useTextDirection } from "@/i18n";
import { ConfirmDialog, PromptDialog } from "@/components/ui/ConfirmDialog";
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
import { StoryViewHistory } from "@/features/story-views/StoryViewHistory.js";

/** Minimal `t` shape — matches react-i18next's `t` as threaded through helpers. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

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
	const { t } = useTranslation();
	const navigate = useNavigate();

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

	// v1.8.1 — the drawer now offers ALL history surfaces explicitly (Search /
	// Briefings / Generated / Viewed), defaulting to the current page's scope,
	// plus a filter box over the active list and a dismissible recording tip.
	const [drawerTab, setDrawerTab] = useState<
		"search" | "brief" | "generated" | "views"
	>(
		scope === "brief"
			? "brief"
			: scope === "generated"
				? "generated"
				: "search",
	);
	const [drawerFilter, setDrawerFilter] = useState("");
	// Follow the page when the drawer opens (a fresh open shows that page's own
	// history by default).
	useEffect(() => {
		if (!open) return;
		setDrawerTab(
			scope === "brief"
				? "brief"
				: scope === "generated"
					? "generated"
					: "search",
		);
		setDrawerFilter("");
	}, [open, scope]);

	// The drawer stays mounted while closing so Reveal can play the exit
	// animations — the backdrop fades out while the panel slides back out to
	// the inline-end edge (the reverse of how it opens). `open` toggles
	// visibility; `duration` covers the 260ms slide-out so it isn't cut short.
	return (
		<Reveal
			open={open}
			enter="animate-fade-in"
			exit="animate-fade-out"
			duration={260}
			className="fixed inset-0 z-50"
		>
			{/* Click-away backdrop — the app-wide neutral black scrim
			    (bg-black/60), not a theme-relative on-surface wash that turns
			    into a milky gray haze in black/white themes. */}
			<button
				type="button"
				aria-label={t("history.closeAria")}
				onClick={closeDrawer}
				className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
			/>
			{/* Drawer panel — slides in from the inline-end on open and slides
			    back out (reverse) on close via its own Reveal. */}
			<Reveal
				open={open}
				enter="animate-slide-in-end-full"
				exit="animate-slide-out-end-full"
				duration={260}
				className="absolute inset-y-0 end-0"
			>
				<aside
					className={cn(
						"flex h-full w-[420px] max-w-[92vw] flex-col border-outline-variant bg-surface-container-lowest shadow-2xl",
						// LTR: right edge. RTL: left edge (flipped by the rtl-flip utility).
						"border-l rtl:border-l-0 rtl:border-r",
					)}
					onClick={(e) => e.stopPropagation()}
				>
					<DrawerHeader />
					{/* v1.8.1 — every history surface is one tap away: this page's
					    history (search/briefings/generated) + viewed stories. */}
					<div className="flex items-center gap-1 overflow-x-auto border-b border-outline-variant px-4 py-2">
						{(
							[
								{
									value: "search",
									icon: "search",
									label: t("history.titleSearch"),
								},
								{
									value: "brief",
									icon: "today",
									label: t("history.titleBrief"),
								},
								{
									value: "generated",
									icon: "auto_awesome",
									label: t("history.titleGenerated"),
								},
								{
									value: "views",
									icon: "visibility",
									label: t("history.tabViews"),
								},
							] as const
						).map((tab) => (
							<button
								key={tab.value}
								type="button"
								onClick={() => setDrawerTab(tab.value)}
								aria-pressed={drawerTab === tab.value}
								className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 font-label text-label-sm transition-colors ${
									drawerTab === tab.value
										? "bg-primary-container text-on-primary-container"
										: "text-on-surface-variant hover:bg-surface-container-high"
								}`}
							>
								<Icon name={tab.icon} className="text-[15px]" />
								{tab.label}
							</button>
						))}
					</div>
					{/* v1.8.1 — filter the active history list by its title/text. */}
					{drawerTab !== "views" ? (
						<div className="border-b border-outline-variant px-4 py-2">
							<Input
								value={drawerFilter}
								onChange={(e) => setDrawerFilter(e.target.value)}
								placeholder={t("history.filterPlaceholder")}
								icon="search"
								aria-label={t("history.filterPlaceholder")}
								className="w-full"
							/>
						</div>
					) : null}
					{drawerTab === "views" ? (
						<div className="flex-1 overflow-y-auto px-4 py-3">
							<StoryViewHistory
								onOpen={(articleId) => {
									closeDrawer();
									navigate(`/articles/${articleId}`);
								}}
							/>
						</div>
					) : (
						<DrawerBody tab={drawerTab} filter={drawerFilter} />
					)}
				</aside>
			</Reveal>
		</Reveal>
	);
}

// ── Header ─────────────────────────────────────────────────────────────────

function DrawerHeader() {
	const { scope, closeDrawer } = useHistoryStore();
	const navigate = useNavigate();
	const { t } = useTranslation();
	// The drawer silently follows the current page: on /brief it shows
	// briefings, on /profile it shows generated summaries, everywhere else
	// searches. No toggle — the title makes it obvious which one the user is
	// looking at.
	const meta =
		scope === "brief"
			? {
					icon: "today",
					title: t("history.titleBrief"),
					sub: t("history.fromBrief"),
				}
			: scope === "generated"
				? {
						icon: "auto_awesome",
						title: t("history.titleGenerated"),
						sub: t("history.fromProfile"),
					}
				: {
						icon: "search",
						title: t("history.titleSearch"),
						sub: t("history.fromSearch"),
					};
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
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => {
						closeDrawer();
						navigate("/docs#history");
					}}
					aria-label={t("history.howItWorks")}
					title={t("history.howItWorks")}
					className="flex items-center gap-1 px-1.5 py-1 font-label text-label-sm text-primary transition-colors hover:text-secondary"
				>
					<Icon name="menu_book" className="text-[16px]" />
					<span className="hidden sm:inline">{t("history.readDocs")}</span>
				</button>
				<button
					type="button"
					onClick={closeDrawer}
					aria-label={t("settings.close")}
					className="text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon name="close" />
				</button>
			</div>
		</header>
	);
}

// ── Body ───────────────────────────────────────────────────────────────────

function DrawerBody({
	tab,
	filter,
}: {
	tab: "search" | "brief" | "generated";
	/** v1.8.1 — client-side title filter for the active list. */
	filter: string;
}) {
	const { scope, selectMode } = useHistoryStore();
	return (
		<>
			{tab === "search" ? (
				<SearchList filter={filter} />
			) : tab === "generated" ? (
				<GeneratedList filter={filter} />
			) : (
				<BriefList filter={filter} />
			)}
			{selectMode ? <BulkActionBar scope={scope} /> : null}
		</>
	);
}

// ── Search list ────────────────────────────────────────────────────────────

function SearchList({ filter }: { filter: string }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
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

	// v1.8.1 — client-side filter over the recorded searches.
	const items = (data?.items ?? []).filter(
		(e) =>
			!filter ||
			e.title.toLowerCase().includes(filter.toLowerCase()) ||
			e.query.toLowerCase().includes(filter.toLowerCase()),
	);
	if (items.length === 0) {
		return (
			<EmptyState
				icon="search"
				title={t("history.noSearches")}
				body={t("history.noSearchesBody")}
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			{/* v1.8.1 — why keyword searches may be missing (recordKeyword is
			    opt-in); dismissible. */}
			{!filter ? (
				<DismissibleTip
					id="history-keyword-recording"
					icon="info"
					className="mb-3"
				>
					{t("history.recordKeywordTip")}{" "}
					<button
						type="button"
						onClick={() => {
							closeDrawer();
							navigate("/settings");
						}}
						className="font-label text-label-sm text-secondary underline-offset-2 hover:underline"
					>
						{t("history.openSettings")}
					</button>
				</DismissibleTip>
			) : null}
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{t("history.entries", { count: items.length })}
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? t("history.done") : t("history.select")}
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
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const textDir = useTextDirection();
	const [showRename, setShowRename] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
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
						<p
							className="truncate font-body text-body-md font-medium text-on-surface"
							dir={textDir(entry.title)}
						>
							{entry.title}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(t, entry.createdAt)}</span>
							<span>· {t("history.hits", { count: entry.hitCount })}</span>
							{entry.tokensUsed > 0 ? (
								<span>
									·{" "}
									{t("history.tokens", {
										count: entry.tokensUsed.toLocaleString(),
									})}
								</span>
							) : null}
							{entry.archived ? <span>· {t("history.archived")}</span> : null}
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
								aria-label={t("history.moreActions")}
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute end-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon="drive_file_rename_outline"
										label={t("history.rename")}
										onClick={() => {
											setMenuOpen(false);
											setShowRename(true);
										}}
									/>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={
											entry.archived
												? t("history.unarchive")
												: t("history.archive")
										}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label={t("history.delete")}
										danger
										onClick={() => {
											setMenuOpen(false);
											setShowDelete(true);
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
			<PromptDialog
				open={showRename}
				title={t("history.renameTitle")}
				defaultValue={entry.title}
				onSubmit={(next) => {
					setShowRename(false);
					void patchSearchEntry(entry.id, { title: next }).then(() => {
						useHistoryStore.getState().noteMutation();
					});
				}}
				onCancel={() => setShowRename(false)}
			/>
			<ConfirmDialog
				open={showDelete}
				title={t("history.deleteTitle")}
				message={t("history.deleteMessage")}
				confirmLabel={t("history.deleteConfirm")}
				icon="delete"
				danger
				onConfirm={() => {
					setShowDelete(false);
					void deleteSearchEntries([entry.id]).then(() => {
						useHistoryStore.getState().noteMutation();
					});
				}}
				onCancel={() => setShowDelete(false)}
			/>
		</li>
	);
}

// ── Brief list ─────────────────────────────────────────────────────────────

function BriefList({ filter }: { filter: string }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
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

	// v1.8.1 — client-side filter over the recorded briefings.
	const items = (data?.items ?? []).filter(
		(e) => !filter || e.title.toLowerCase().includes(filter.toLowerCase()),
	);
	if (items.length === 0) {
		return (
			<EmptyState
				icon="today"
				title={t("history.noBriefings")}
				body={t("history.noBriefingsBody")}
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{t("history.entries", { count: items.length })}
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? t("history.done") : t("history.select")}
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
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const textDir = useTextDirection();
	const [showRename, setShowRename] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
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
						<p
							className="truncate font-body text-body-md font-medium text-on-surface"
							dir={textDir(entry.title)}
						>
							{entry.title}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(t, entry.createdAt)}</span>
							<span>· {t("brief.stories", { count: entry.storyCount })}</span>
							{entry.archived ? <span>· {t("history.archived")}</span> : null}
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
								aria-label={t("history.moreActions")}
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute end-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon="drive_file_rename_outline"
										label={t("history.rename")}
										onClick={() => {
											setMenuOpen(false);
											setShowRename(true);
										}}
									/>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={
											entry.archived
												? t("history.unarchive")
												: t("history.archive")
										}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label={t("history.delete")}
										danger
										onClick={() => {
											setMenuOpen(false);
											setShowDelete(true);
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
			<PromptDialog
				open={showRename}
				title={t("history.renameTitle")}
				defaultValue={entry.title}
				onSubmit={(next) => {
					setShowRename(false);
					void patchBriefEntry(entry.id, { title: next }).then(() => {
						useHistoryStore.getState().noteMutation();
					});
				}}
				onCancel={() => setShowRename(false)}
			/>
			<ConfirmDialog
				open={showDelete}
				title={t("history.deleteTitle")}
				message={t("history.deleteMessage")}
				confirmLabel={t("history.deleteConfirm")}
				icon="delete"
				danger
				onConfirm={() => {
					setShowDelete(false);
					void deleteBriefEntries([entry.id]).then(() => {
						useHistoryStore.getState().noteMutation();
					});
				}}
				onCancel={() => setShowDelete(false)}
			/>
		</li>
	);
}

// ── Generated list ──────────────────────────────────────────────────────────

function GeneratedList({ filter }: { filter: string }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
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

	// v1.8.1 — client-side filter over the generated summaries.
	const items = (data?.items ?? []).filter(
		(e) => !filter || e.title.toLowerCase().includes(filter.toLowerCase()),
	);
	if (items.length === 0) {
		return (
			<EmptyState
				icon="auto_awesome"
				title={t("history.noGenerations")}
				body={t("history.noGenerationsBody")}
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3">
			<div className="mb-2 flex items-center justify-between px-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
					{t("history.entries", { count: items.length })}
				</span>
				<button
					type="button"
					onClick={() => setSelectMode(!selectMode)}
					className="font-label text-label-sm uppercase tracking-widest text-secondary hover:text-primary"
				>
					{selectMode ? t("history.done") : t("history.select")}
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
							void qc.invalidateQueries({
								queryKey: ["history", "generated"],
							});
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
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const textDir = useTextDirection();
	const [showDelete, setShowDelete] = useState(false);
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
						<p
							className="truncate font-body text-body-md font-medium text-on-surface"
							dir={textDir(entry.title)}
						>
							{entry.title}
						</p>
						<p
							className="mt-0.5 line-clamp-2 font-body text-body-sm text-on-surface-variant"
							dir={textDir(entry.result)}
						>
							{entry.result}
						</p>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-on-tertiary-container">
							<span>{timeAgo(t, entry.createdAt)}</span>
							{entry.tokensUsed > 0 ? (
								<span>
									·{" "}
									{t("history.tokens", {
										count: entry.tokensUsed.toLocaleString(),
									})}
								</span>
							) : null}
							{entry.archived ? <span>· {t("history.archived")}</span> : null}
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
								aria-label={t("history.moreActions")}
							>
								<Icon name="more_vert" className="text-[18px]" />
							</button>
							{menuOpen ? (
								<div
									className="absolute end-0 top-7 z-10 w-40 rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
									onClick={(e) => e.stopPropagation()}
								>
									<MenuItem
										icon={entry.archived ? "unarchive" : "archive"}
										label={
											entry.archived
												? t("history.unarchive")
												: t("history.archive")
										}
										onClick={() => {
											setMenuOpen(false);
											onArchive();
										}}
									/>
									<MenuItem
										icon="delete"
										label={t("history.delete")}
										danger
										onClick={() => {
											setMenuOpen(false);
											setShowDelete(true);
										}}
									/>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</GhostCard>
			<ConfirmDialog
				open={showDelete}
				title={t("history.deleteTitle")}
				message={t("history.deleteMessage")}
				confirmLabel={t("history.deleteConfirm")}
				icon="delete"
				danger
				onConfirm={() => {
					setShowDelete(false);
					void deleteGeneratedEntries([entry.id]).then(() => {
						useHistoryStore.getState().noteMutation();
					});
				}}
				onCancel={() => setShowDelete(false)}
			/>
		</li>
	);
}

// ── Bulk actions ───────────────────────────────────────────────────────────

function BulkActionBar({ scope }: { scope: HistoryScope }) {
	const { t } = useTranslation();
	const { selectedIds, clearSelection, setSelectMode } = useHistoryStore();
	const qc = useQueryClient();
	const count = selectedIds.size;
	const [showDelete, setShowDelete] = useState(false);
	if (count === 0) {
		return (
			<div className="border-t border-outline-variant px-5 py-3 text-center font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
				{t("history.selectHint")}
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
				{t("history.selectedCount", { count })}
			</span>
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" icon="archive" onClick={doArchive}>
					{t("history.archive")}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					icon="delete"
					onClick={() => setShowDelete(true)}
				>
					{t("history.delete")}
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setSelectMode(false)}>
					{t("common.cancel")}
				</Button>
			</div>
			<ConfirmDialog
				open={showDelete}
				title={t("history.deleteManyTitle", { count })}
				message={t("history.deleteManyMessage", { count })}
				confirmLabel={t("history.deleteConfirm")}
				icon="delete"
				danger
				onConfirm={() => {
					setShowDelete(false);
					void doDelete();
				}}
				onCancel={() => setShowDelete(false)}
			/>
		</div>
	);
}

function ModeBadge({ mode }: { mode: SearchMode }) {
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				"inline-flex flex-none items-center rounded px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest",
				mode === "ai"
					? "bg-primary-container text-on-primary-container"
					: "bg-surface-variant text-on-surface-variant",
			)}
		>
			{mode === "ai" ? t("history.modeAi") : t("history.modeKw")}
		</span>
	);
}

function PeriodBadge({ period }: { period: BriefHistoryEntry["period"] }) {
	const { t } = useTranslation();
	const label =
		period === "today"
			? t("history.periodToday")
			: period === "week"
				? t("history.periodWeek")
				: period === "month"
					? t("history.periodMonth")
					: t("history.periodAll");
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
	const { t } = useTranslation();
	const isSummary = kind === "behavior-summary";
	return (
		<span className="inline-flex flex-none items-center gap-1 rounded bg-primary-container px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest text-on-primary-container">
			<Icon name={isSummary ? "insights" : "tune"} className="text-[12px]" />
			{isSummary ? t("history.kindSummary") : t("history.kindInstruction")}
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
				"flex w-full items-center gap-2 px-3 py-1.5 text-start font-body text-body-sm transition-colors hover:bg-surface-container",
				danger ? "text-error" : "text-on-surface",
			)}
		>
			<Icon name={icon} className="text-[16px]" />
			{label}
		</button>
	);
}

function DrawerLoading() {
	const { t } = useTranslation();
	return (
		<div className="flex flex-1 items-center justify-center gap-2 text-on-surface-variant">
			<Icon name="sync" className="animate-spin-reverse text-[18px]" />
			<span className="font-mono text-[11px] uppercase tracking-widest">
				{t("article.loading")}
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

function timeAgo(t: Translate, iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return t("history.timeJustNow");
	const min = Math.round(sec / 60);
	if (min < 60) return t("history.timeMinutesAgo", { count: min });
	const hr = Math.round(min / 60);
	if (hr < 24) return t("history.timeHoursAgo", { count: hr });
	const day = Math.round(hr / 24);
	if (day < 30) return t("history.timeDaysAgo", { count: day });
	const mo = Math.round(day / 30);
	if (mo < 12) return t("history.timeMonthsAgo", { count: mo });
	return t("history.timeYearsAgo", { count: Math.round(mo / 12) });
}

// Re-export so SettingsPage can read/write app settings via the same module.
export { fetchSettings, patchSettings } from "./history-api.js";
export type { AppSettings };
