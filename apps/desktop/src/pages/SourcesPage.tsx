import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateSourceInput,
	Source,
	SourceCategory,
	SourceRange,
	SourceType,
} from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { cn } from "@/lib/cn";
import { ApiException } from "@/lib/api/config";
import { useTextDirection } from "@/i18n";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import {
	createSource,
	deleteSource,
	fetchSourceArticles,
	fetchSources,
	toggleSource,
	updateSource,
} from "@/features/sources/sources-api.js";

const CATEGORIES: SourceCategory[] = [
	"ai",
	"software-engineering",
	"programming-languages",
	"web-development",
	"backend",
	"devops",
	"cloud",
	"security",
	"open-source",
	"other",
];

const TYPES: SourceType[] = ["rss", "api", "html", "sitemap"];

/**
 * Time range presets for a source — the advanced fetch window.
 * Each maps to a fetchWindowDays value (how many days of articles to keep).
 */
const TIME_RANGE_OPTIONS = [
	{ value: "1", label: "Last 24h", icon: "schedule" },
	{ value: "7", label: "Last week", icon: "schedule" },
	{ value: "30", label: "Last month", icon: "schedule" },
	{ value: "365", label: "Last year", icon: "calendar_month" },
	{ value: "0", label: "Unlimited", icon: "all_inclusive" },
	{ value: "custom", label: "Custom…", icon: "edit" },
];

/** Preset day values that have a named label (anything else is a custom amount). */
const PRESET_DAYS = new Set([1, 7, 30, 365, 0]);

/**
 * Source management page (examples/source-management.html).
 *
 * List configured sources, enable/disable, add new (RSS/API/HTML/Sitemap),
 * remove. Per project-details.md §29: new sources are configuration, not code.
 */
export function SourcesPage() {
	const queryClient = useQueryClient();
	const { data: sources = [], isLoading } = useQuery({
		queryKey: ["sources"],
		queryFn: fetchSources,
	});
	const [showAdd, setShowAdd] = useState(false);
	/** Source whose Custom time-range dialog is open, else null. */
	const [customRangeFor, setCustomRangeFor] = useState<string | null>(null);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<{
		id: string;
		count: number;
	} | null>(null);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["sources"] });
	const toggle = useMutation({
		mutationFn: (s: Source) => toggleSource(s.id, !s.enabled),
		onSuccess: invalidate,
	});
	const setWindow = useMutation({
		mutationFn: ({
			id,
			days,
			fetchFrom,
			fetchTo,
		}: {
			id: string;
			days: number;
			fetchFrom?: Date | null;
			fetchTo?: Date | null;
		}) =>
			updateSource(id, {
				fetchWindowDays: days,
				...(fetchFrom !== undefined ? { fetchFrom } : {}),
				...(fetchTo !== undefined ? { fetchTo } : {}),
			}),
		onSuccess: invalidate,
	});
	/**
	 * Source deletion respects domain ownership (R-A10): the engine refuses
	 * (409 BOOKMARKED_ARTICLES_EXIST) when the source owns saved stories. We
	 * surface that as an explicit "N saved stories will be deleted — delete
	 * anyway?" confirmation before retrying with force.
	 */
	const remove = useMutation({
		mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
			deleteSource(id, force),
		onSuccess: () => {
			invalidate();
			setPendingDelete(null);
		},
		onError: (err, vars) => {
			if (err instanceof ApiException && err.status === 409 && !vars.force) {
				const details = err.details as
					{ code?: string; bookmarkedCount?: number } | undefined;
				if (details?.code === "BOOKMARKED_ARTICLES_EXIST") {
					setPendingDelete({
						id: vars.id,
						count: details.bookmarkedCount ?? 0,
					});
					return;
				}
			}
			setPendingDelete(null);
		},
	});

	const enabledCount = sources.filter((s) => s.enabled).length;
	const customRangeSource =
		sources.find((s) => s.id === customRangeFor) ?? null;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						Sources
					</h2>
					<div className="flex items-center gap-4 font-label text-label-md text-on-tertiary-container">
						<span>{sources.length} total</span>
						<span className="h-1 w-1 rounded-full bg-outline-variant" />
						<span className="text-secondary">{enabledCount} enabled</span>
					</div>
				</div>
				<div className="flex flex-col items-end gap-2">
					{/* Help sits at the top-right, level with the page title. */}
					<DocsHelpButton sectionId="sources" />
					<Button icon="add" onClick={() => setShowAdd((v) => !v)}>
						Add Source
					</Button>
				</div>
			</header>

			{showAdd ? <AddSourceForm onDone={() => setShowAdd(false)} /> : null}

			{isLoading ? (
				<p className="font-body text-body-md text-on-surface-variant">
					Loading sources…
				</p>
			) : (
				<div className="space-y-4">
					{sources.map((s) => (
						<Fragment key={s.id}>
							<GhostCard className="flex items-center gap-4 py-4">
								<div
									className={`flex h-10 w-10 items-center justify-center rounded bg-surface-container-high ${s.enabled ? "" : "opacity-40"}`}
								>
									<Icon name={typeIcon(s.type)} className="text-primary" />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-3">
										<h3
											className={`font-label text-label-md text-on-surface ${s.enabled ? "" : "line-through opacity-60"}`}
										>
											{s.name}
										</h3>
										<DomainTag>{s.category}</DomainTag>
									</div>
									<p className="mt-1 font-mono text-mono-technical text-on-tertiary-container">
										{s.url}
									</p>
									{/* Per-source time range = the advanced fetch window (default 7 days).
									Custom… opens a dialog instead of replacing the select inline. */}
									<div className="mt-2 flex items-center gap-2">
										<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
											Time range
										</span>
										<Select
											value={rangeValueFor(s)}
											onChange={(v) => {
												if (v === "custom") {
													setCustomRangeFor(s.id);
												} else {
													setWindow.mutate({
														id: s.id,
														days: Number(v),
														fetchFrom: null,
														fetchTo: null,
													});
												}
											}}
											aria-label={`Time range for ${s.name}`}
											options={windowOptionsFor(s)}
											className="w-52"
										/>
									</div>
								</div>
								{s.lastCheckedAt ? (
									<span className="hidden font-mono text-mono-technical text-on-tertiary-container sm:block">
										{s.lastCheckedAt.toLocaleString()}
									</span>
								) : null}
								<div className="flex items-center gap-1">
									<Tooltip
										label={
											s.enabled ? "Disable this source" : "Enable this source"
										}
										position="bottom"
									>
										<button
											onClick={() => toggle.mutate(s)}
											className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${s.enabled ? "bg-primary" : "bg-outline-variant"}`}
											aria-label={s.enabled ? "Disable" : "Enable"}
										>
											<span
												className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform ${s.enabled ? "translate-x-5" : "translate-x-0"}`}
											/>
										</button>
									</Tooltip>
									<Tooltip
										label={
											expanded === s.id
												? "Hide articles in this time range"
												: "Show articles in this time range"
										}
										position="bottom"
									>
										<button
											onClick={() =>
												setExpanded((cur) => (cur === s.id ? null : s.id))
											}
											className="ml-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
											aria-label="Toggle articles in time range"
											aria-expanded={expanded === s.id}
										>
											<Icon name="article" className="text-[18px]" />
										</button>
									</Tooltip>
									<Tooltip label="Delete this source" position="bottom">
										<button
											onClick={() => setConfirmDeleteId(s.id)}
											className="ml-2 p-2 text-on-surface-variant transition-colors hover:text-error"
											aria-label="Remove"
										>
											<Icon name="delete" className="text-[18px]" />
										</button>
									</Tooltip>
								</div>
							</GhostCard>

							{/* Articles within this source's time range (v1.6.0). */}
							{expanded === s.id ? <SourceArticles source={s} /> : null}

							{/* Delete confirmation — the source owns saved stories. */}
							{pendingDelete?.id === s.id ? (
								<GhostCard className="border-error/40 bg-error/5">
									<p className="font-body text-body-md text-on-surface">
										{pendingDelete.count > 0
											? `${pendingDelete.count} saved storie(s) belong to this source and will be deleted too. Delete anyway?`
											: "Delete this source and all its stories?"}
									</p>
									<div className="mt-3 flex gap-2">
										<button
											type="button"
											onClick={() => remove.mutate({ id: s.id, force: true })}
											className="rounded bg-error px-3 py-1 font-label text-label-md text-on-error"
										>
											Delete anyway
										</button>
										<button
											type="button"
											onClick={() => setPendingDelete(null)}
											className="rounded px-3 py-1 font-label text-label-md text-on-surface-variant"
										>
											Cancel
										</button>
									</div>
								</GhostCard>
							) : null}
						</Fragment>
					))}
				</div>
			)}

			{/* Delete confirmation — always show before removing a source. */}
			<ConfirmDialog
				open={Boolean(confirmDeleteId)}
				title="Delete source?"
				message={
					sources.find((s) => s.id === confirmDeleteId) ? (
						<>
							The source{" "}
							<strong className="text-on-surface">
								&quot;{sources.find((s) => s.id === confirmDeleteId)?.name}
								&quot;
							</strong>{" "}
							and all its collected stories will be permanently removed. This
							cannot be undone.
						</>
					) : (
						"This source and all its collected stories will be permanently removed. This cannot be undone."
					)
				}
				confirmLabel="Delete source"
				icon="delete"
				danger
				onConfirm={() => {
					if (!confirmDeleteId) return;
					remove.mutate({ id: confirmDeleteId });
					setConfirmDeleteId(null);
				}}
				onCancel={() => setConfirmDeleteId(null)}
			/>
			{/* Custom time range — a dialog, not an inline editor (cleaner card). */}
			<CustomRangeDialog
				source={customRangeSource}
				onApply={(range) => {
					if (!customRangeSource) return;
					setWindow.mutate({
						id: customRangeSource.id,
						days: range.days,
						fetchFrom: range.fetchFrom,
						fetchTo: range.fetchTo,
					});
					setCustomRangeFor(null);
				}}
				onClose={() => setCustomRangeFor(null)}
			/>
		</section>
	);
}

/**
 * Articles for one source within a time range — informational over surviving
 * data: retention pruning may have removed older stories, and `prunedNote`
 * explains when that happens instead of showing a silent empty list.
 */
/** Coerce an API date (ISO string or Date) into a Date, or null. */
function toDate(v: Date | string | null | undefined): Date | null {
	if (!v) return null;
	return v instanceof Date ? v : new Date(v);
}

/**
 * Time range select options for a source. Preset amounts get their named
 * label; a custom day amount appears as "N days"; an absolute from/to range
 * appears as "Custom dates (…)" so the current mode is always visible.
 */
function windowOptionsFor(s: Source) {
	const days = s.fetchWindowDays ?? 7;
	const from = toDate(s.fetchFrom);
	const to = toDate(s.fetchTo);
	const options = from
		? [
				{
					value: "custom",
					label: `Custom dates (${fmtDate(from)} – ${fmtDate(to)})`,
					icon: "date_range",
				},
				...TIME_RANGE_OPTIONS.filter((o) => o.value !== "custom"),
			]
		: !PRESET_DAYS.has(days)
			? [
					{ value: String(days), label: `${days} days`, icon: "schedule" },
					...TIME_RANGE_OPTIONS,
				]
			: TIME_RANGE_OPTIONS;
	return options;
}

/** The select's current value: "custom" when in absolute range mode, else days. */
function rangeValueFor(s: Source): string {
	return s.fetchFrom ? "custom" : String(s.fetchWindowDays ?? 7);
}

function fmtDate(d: Date | null): string {
	return d
		? d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
		: "?";
}

/** Map a source's fetchWindowDays to the backend range window it represents. */
function daysToRange(days: number): {
	range: SourceRange;
	from?: string;
	to?: string;
} {
	if (days <= 1) return { range: "day" };
	if (days <= 7) return { range: "week" };
	if (days <= 30) return { range: "month" };
	if (days <= 365) return { range: "year" };
	const from = new Date(Date.now() - days * 86_400_000)
		.toISOString()
		.slice(0, 10);
	return { range: "custom", from };
}

/** How many source articles to show before "Show more". */
const SOURCE_ARTICLES_PAGE = 10;

function SourceArticles({ source }: { source: Source }) {
	const textDir = useTextDirection();
	const fromDate = toDate(source.fetchFrom);
	const toDateValue = toDate(source.fetchTo);
	const { range, from, to } = fromDate
		? {
				range: "custom" as const,
				from: fromDate.toISOString().slice(0, 10),
				to: toDateValue?.toISOString().slice(0, 10),
			}
		: daysToRange(source.fetchWindowDays ?? 7);
	const { data, isLoading } = useQuery({
		queryKey: [
			"sources",
			source.id,
			"articles",
			fromDate?.getTime() ?? source.fetchWindowDays,
		],
		queryFn: () => fetchSourceArticles(source.id, { range, from, to }),
	});
	const articles = data?.articles ?? [];
	const [visible, setVisible] = useState(SOURCE_ARTICLES_PAGE);
	const shown = articles.slice(0, visible);
	/** Human label for the active window, shown in the panel header. */
	const rangeLabel = fromDate
		? `${fmtDate(fromDate)} – ${fmtDate(toDateValue)}`
		: source.fetchWindowDays === 0
			? "all time"
			: `last ${range === "custom" ? `${source.fetchWindowDays ?? 7} days` : range}`;

	return (
		<GhostCard className="space-y-3">
			{/* Panel header — what this list shows, and how many (R-D07). */}
			<div className="flex items-center justify-between gap-3">
				<span className="inline-flex items-center gap-1.5 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					<Icon name="article" className="text-[16px] text-primary" />
					Articles in this range
				</span>
				{data ? (
					<span className="rounded-full bg-secondary-container px-2 py-0.5 font-mono text-mono-technical text-on-secondary-container">
						{data.total}
					</span>
				) : null}
			</div>

			{data?.prunedNote ? (
				<p className="font-body text-body-sm italic text-on-surface-variant">
					{data.prunedNote}
				</p>
			) : null}

			{isLoading ? (
				<p className="font-body text-body-sm text-on-surface-variant">
					Loading articles…
				</p>
			) : articles.length === 0 ? (
				<p className="font-body text-body-sm text-on-surface-variant">
					No articles in this time range.
				</p>
			) : (
				<>
					<ul
						aria-label={`Articles from this source — ${rangeLabel}`}
						className="-mx-1.5 divide-y divide-outline-variant"
					>
						{shown.map((a) => (
							<li key={a.id}>
								<Link
									to={`/articles/${a.id}`}
									className="group flex items-center gap-3 rounded px-1.5 py-1.5 transition-colors hover:bg-surface-container"
								>
									<span
										dir={textDir(a.title)}
										className="min-w-0 flex-1 truncate font-body text-body-sm text-on-surface transition-colors group-hover:text-primary"
									>
										{a.title}
									</span>
									{a.publishedAt ? (
										<span className="inline-flex shrink-0 items-center gap-1 font-mono text-mono-technical text-on-tertiary-container">
											<Icon name="schedule" className="text-[12px]" />
											{new Date(a.publishedAt).toLocaleDateString("en-US", {
												day: "numeric",
												month: "short",
											})}
										</span>
									) : null}
									<Icon
										name="chevron_right"
										className="hidden shrink-0 text-[16px] text-on-surface-variant transition-transform group-hover:translate-x-0.5 sm:block"
									/>
								</Link>
							</li>
						))}
					</ul>
					{articles.length > shown.length ? (
						<div className="border-t border-outline-variant pt-2 text-center">
							<button
								type="button"
								onClick={() => setVisible((v) => v + SOURCE_ARTICLES_PAGE)}
								className="inline-flex items-center gap-1 rounded font-label text-label-sm text-primary transition-colors hover:text-secondary"
							>
								<Icon name="expand_more" className="text-[16px]" />
								Show more ({articles.length - shown.length} more)
							</button>
						</div>
					) : null}
				</>
			)}
		</GhostCard>
	);
}

/**
 * Custom time range — a themed dialog (R-A12: no native dialogs), opened by
 * choosing "Custom…" in the Time range select. Two modes: a relative window
 * (N days) or an absolute date range (from → to). Seeds its inputs from the
 * source each time it opens; OK applies via the parent mutation, Escape or
 * backdrop click cancels.
 */
function CustomRangeDialog({
	source,
	onApply,
	onClose,
}: {
	source: Source | null;
	onApply: (range: {
		days: number;
		fetchFrom: Date | null;
		fetchTo: Date | null;
	}) => void;
	onClose: () => void;
}) {
	const [mode, setMode] = useState<"days" | "dates">("days");
	const [days, setDays] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");

	// Seed from the source each time the dialog opens.
	useEffect(() => {
		if (!source) return;
		setMode(source.fetchFrom ? "dates" : "days");
		setDays(String(source.fetchWindowDays ?? 7));
		setFrom(toDate(source.fetchFrom)?.toISOString().slice(0, 10) ?? "");
		setTo(toDate(source.fetchTo)?.toISOString().slice(0, 10) ?? "");
	}, [source]);

	// Escape closes; Enter applies when the current mode is valid.
	useEffect(() => {
		if (!source) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key !== "Enter") return;
			const valid =
				mode === "days"
					? days !== "" && Number(days) >= 1
					: Boolean(from && to);
			if (!valid) return;
			e.preventDefault();
			if (mode === "days") {
				onApply({
					days: Math.floor(Number(days)),
					fetchFrom: null,
					fetchTo: null,
				});
			} else {
				onApply({ days: 0, fetchFrom: new Date(from), fetchTo: new Date(to) });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [source, mode, days, from, to, onApply, onClose]);

	if (!source) return null;

	const canApply =
		mode === "days" ? days !== "" && Number(days) >= 1 : Boolean(from && to);

	const apply = () => {
		if (!canApply) return;
		if (mode === "days") {
			onApply({
				days: Math.floor(Number(days)),
				fetchFrom: null,
				fetchTo: null,
			});
		} else {
			onApply({ days: 0, fetchFrom: new Date(from), fetchTo: new Date(to) });
		}
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="custom-range-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-4">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="date_range" className="text-[20px]" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="custom-range-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							Custom time range
						</h2>
						<p className="mt-1 font-body text-body-sm text-on-surface-variant">
							{source.name}
						</p>
					</div>
				</div>

				{/* Mode toggle: relative window (days) or absolute range (dates). */}
				<div className="mb-4 inline-flex rounded border border-outline-variant bg-surface-container-low p-0.5">
					<button
						type="button"
						onClick={() => setMode("days")}
						aria-pressed={mode === "days"}
						className={cn(
							"rounded px-2.5 py-1 font-label text-label-sm transition-colors",
							mode === "days"
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:text-primary",
						)}
					>
						Days
					</button>
					<button
						type="button"
						onClick={() => setMode("dates")}
						aria-pressed={mode === "dates"}
						className={cn(
							"rounded px-2.5 py-1 font-label text-label-sm transition-colors",
							mode === "dates"
								? "bg-primary text-on-primary"
								: "text-on-surface-variant hover:text-primary",
						)}
					>
						Dates
					</button>
				</div>

				{mode === "days" ? (
					<div className="mb-6 flex flex-col gap-1">
						<div className="flex items-center gap-1.5">
							<input
								autoFocus
								type="number"
								min={1}
								value={days}
								onChange={(e) => setDays(e.target.value)}
								placeholder="e.g. 45"
								aria-label={`Time range in days for ${source.name}`}
								className="w-24 rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
							/>
							<span className="font-label text-label-sm text-on-surface-variant">
								days
							</span>
						</div>
						<p className="font-body text-body-sm text-on-tertiary-container">
							Keep articles from the last N days.
						</p>
					</div>
				) : (
					<div className="mb-6 flex flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<input
								autoFocus
								type="date"
								value={from}
								onChange={(e) => setFrom(e.target.value)}
								aria-label={`From date for ${source.name}`}
								className="rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
							/>
							<span className="font-label text-label-sm text-on-tertiary-container">
								to
							</span>
							<input
								type="date"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								aria-label={`To date for ${source.name}`}
								className="rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
							/>
						</div>
						<p className="font-body text-body-sm text-on-tertiary-container">
							Keep only articles published between these two dates.
						</p>
					</div>
				)}

				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button size="sm" icon="check" onClick={apply} disabled={!canApply}>
						OK
					</Button>
				</div>
			</div>
		</div>
	);
}

function AddSourceForm({ onDone }: { onDone: () => void }) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [type, setType] = useState<SourceType>("rss");
	const [category, setCategory] = useState<SourceCategory>("ai");
	const [useCustomCategory, setUseCustomCategory] = useState(false);
	const [customCategory, setCustomCategory] = useState("");

	const finalCategory = useCustomCategory
		? customCategory.trim().toLowerCase().replace(/\s+/g, "-") || "other"
		: category;

	const create = useMutation({
		mutationFn: (input: CreateSourceInput) => createSource(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			onDone();
		},
	});

	const submit = () => {
		if (!name.trim() || !url.trim()) return;
		const configuration =
			type === "rss"
				? { feedUrl: url }
				: type === "sitemap"
					? { sitemapUrl: url }
					: { baseUrl: url };
		create.mutate({ name, url, type, category: finalCategory, configuration });
	};

	// Escape closes the dialog; Enter submits through the native form.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onDone();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onDone]);

	const canSubmit = Boolean(name.trim() && url.trim()) && !create.isPending;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-source-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onDone();
			}}
		>
			<div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-4">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="rss_feed" className="text-[20px]" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="add-source-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							Add new source
						</h2>
						<p className="mt-1 font-body text-body-sm text-on-surface-variant">
							A feed Vorynth collects stories from.
						</p>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
					className="space-y-4"
				>
					<div>
						<label
							htmlFor="add-source-name"
							className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
						>
							Name
						</label>
						<div className="mt-1">
							<Input
								id="add-source-name"
								autoFocus
								value={name}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && canSubmit) {
										e.preventDefault();
										submit();
									}
								}}
								placeholder="OpenAI Blog"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor="add-source-url"
							className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
						>
							URL
						</label>
						<div className="mt-1">
							<Input
								id="add-source-url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && canSubmit) {
										e.preventDefault();
										submit();
									}
								}}
								placeholder="https://openai.com/blog/rss.xml"
								icon="link"
							/>
						</div>
					</div>
					<div>
						<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
							Method
						</span>
						<div className="mt-1 flex flex-wrap gap-2">
							{TYPES.map((t) => (
								<button
									key={t}
									type="button"
									onClick={() => setType(t)}
									aria-pressed={type === t}
									className={`rounded border px-3 py-1 font-label text-label-sm uppercase tracking-wide transition-colors ${
										type === t
											? "border-primary bg-primary text-on-primary"
											: "border-outline-variant text-on-surface-variant hover:border-primary"
									}`}
								>
									{t}
								</button>
							))}
						</div>
						{/* Deep link to the selected method's docs section (R-D06). */}
						<Link
							to={`/docs#sources-method-${type}`}
							className="mt-1.5 inline-flex items-center gap-1 font-label text-label-sm text-secondary transition-colors hover:text-primary hover:underline"
						>
							<Icon name="school" className="text-[14px]" />
							How does {type.toUpperCase()} work?
						</Link>
					</div>
					<div>
						<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
							Category
						</span>
						<p className="mb-1 font-body text-body-sm text-on-tertiary-container">
							What kind of source is this? Used for ranking and filtering.
						</p>
						{useCustomCategory ? (
							<div className="flex gap-2">
								<Input
									value={customCategory}
									onChange={(e) => setCustomCategory(e.target.value)}
									placeholder="e.g. hardware, robotics, quantum"
									icon="label"
								/>
								<button
									type="button"
									onClick={() => {
										setUseCustomCategory(false);
										setCustomCategory("");
									}}
									className="shrink-0 rounded border border-outline-variant px-3 font-label text-label-sm text-on-surface-variant transition-colors hover:border-primary"
								>
									Use list
								</button>
							</div>
						) : (
							<div className="flex gap-2">
								<Select
									value={category}
									onChange={(v) => setCategory(v as SourceCategory)}
									aria-label="Source category"
									options={CATEGORIES.map((c) => ({
										value: c,
										label: c.replace(/-/g, " "),
									}))}
									className="min-w-0 flex-1"
								/>
								<button
									type="button"
									onClick={() => setUseCustomCategory(true)}
									className="shrink-0 inline-flex items-center gap-1 rounded border border-outline-variant px-3 font-label text-label-sm text-on-surface-variant transition-colors hover:border-primary"
								>
									<Icon name="add" className="text-[16px]" />
									Custom
								</button>
							</div>
						)}
					</div>

					{create.error ? (
						<p className="font-mono text-mono-technical text-error">
							{create.error.message}
						</p>
					) : null}

					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="ghost" size="sm" onClick={onDone}>
							Cancel
						</Button>
						<Button type="submit" size="sm" icon="check" disabled={!canSubmit}>
							{create.isPending ? "Saving…" : "Add"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

function typeIcon(type: SourceType): string {
	switch (type) {
		case "rss":
			return "rss_feed";
		case "api":
			return "api";
		case "html":
			return "html";
		case "sitemap":
			return "map";
		default:
			return "database";
	}
}
