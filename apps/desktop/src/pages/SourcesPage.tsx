import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import ISO6391 from "iso-639-1";
import type {
	BulkSourceEnableInput,
	ConfigField,
	CreateSourceInput,
	RefreshCatalogResult,
	Source,
	SourceAuthority,
	SourceCategory,
	SourceGroupDimension,
	SourceListInfo,
	SourceListOrigin,
	SourceRange,
	SourceScope,
	SourceType,
	VerifySourceResult,
} from "@vorynth/types";
import {
	SOURCE_AUTHORITIES,
	SOURCE_IMPACT_AREAS,
	SOURCE_SCOPES,
} from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PluginIcon } from "@/components/ui/PluginIcon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { FieldHelp } from "@/components/ui/FieldHelp";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { cn } from "@/lib/cn";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ApiException } from "@/lib/api/config";
import { useTextDirection } from "@/i18n";
import { fetchSettings } from "@/features/history/history-api.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { fetchPlugins } from "@/features/plugins/plugins-api.js";
import {
	createSource,
	deleteSource,
	disableSourceList,
	enableSourceGroup,
	enableSourceList,
	fetchSourceArticles,
	fetchSourceLists,
	fetchSources,
	importSourceList,
	refreshSourceLists,
	toggleSource,
	updateSource,
	verifySource,
} from "@/features/sources/sources-api.js";
import {
	buildTagVocabulary,
	suggestTags,
} from "@/features/sources/tag-vocab.js";
import {
	buildSourceListFile,
	downloadSourceListFile,
} from "@/features/sources/source-list-export.js";

/** ISO region/language → display name via the built-in Intl catalog. */
function regionName(code: string): string {
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
	} catch {
		return code;
	}
}
function languageName(code: string): string {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

/** Human label for a group-by value (country code → "United States", etc.). */
function dimensionValueLabel(
	dimension: SourceGroupDimension,
	value: string,
): string {
	if (dimension === "country") return regionName(value);
	if (dimension === "language") return languageName(value);
	return value;
}

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

// v1.8.0 — every source type the engine knows. arXiv is an official connector:
// picking it auto-provisions the connector (if not already registered) when
// the source is created or tested.
const TYPES: SourceType[] = [
	"rss",
	"api",
	"html",
	"sitemap",
	"github",
	"reddit",
	"arxiv",
];

/** Semantic metadata options (v1.8.0) — derived from the shared enums so the
 *  form can never offer a value the engine rejects. Labels are translated via
 *  the `scope.*` / `authority.*` namespaces (computed in SourceFormDialog,
 *  where the `t` function is in scope). */

/** Human label for an authority code ("official" → "Official source"). */
function authorityLabel(authority: SourceAuthority | null): string {
	if (!authority) return "";
	return authority.charAt(0).toUpperCase() + authority.slice(1);
}

/**
 * ISO 3166-1 alpha-2 country codes for the source form's Country select.
 * Curated (no dependency) — the engine validates any 2-letter code, so a
 * country missing here can still be set via the API/community lists.
 */
const COUNTRIES: { code: string; name: string }[] = [
	{ code: "AE", name: "United Arab Emirates" },
	{ code: "AR", name: "Argentina" },
	{ code: "AT", name: "Austria" },
	{ code: "AU", name: "Australia" },
	{ code: "BE", name: "Belgium" },
	{ code: "BG", name: "Bulgaria" },
	{ code: "BR", name: "Brazil" },
	{ code: "CA", name: "Canada" },
	{ code: "CH", name: "Switzerland" },
	{ code: "CL", name: "Chile" },
	{ code: "CN", name: "China" },
	{ code: "CO", name: "Colombia" },
	{ code: "CZ", name: "Czechia" },
	{ code: "DE", name: "Germany" },
	{ code: "DK", name: "Denmark" },
	{ code: "EE", name: "Estonia" },
	{ code: "EG", name: "Egypt" },
	{ code: "ES", name: "Spain" },
	{ code: "FI", name: "Finland" },
	{ code: "FR", name: "France" },
	{ code: "GB", name: "United Kingdom" },
	{ code: "GR", name: "Greece" },
	{ code: "HK", name: "Hong Kong" },
	{ code: "HU", name: "Hungary" },
	{ code: "ID", name: "Indonesia" },
	{ code: "IE", name: "Ireland" },
	{ code: "IL", name: "Israel" },
	{ code: "IN", name: "India" },
	{ code: "IR", name: "Iran" },
	{ code: "IS", name: "Iceland" },
	{ code: "IT", name: "Italy" },
	{ code: "JP", name: "Japan" },
	{ code: "KR", name: "South Korea" },
	{ code: "LT", name: "Lithuania" },
	{ code: "LU", name: "Luxembourg" },
	{ code: "LV", name: "Latvia" },
	{ code: "MA", name: "Morocco" },
	{ code: "MX", name: "Mexico" },
	{ code: "MY", name: "Malaysia" },
	{ code: "NG", name: "Nigeria" },
	{ code: "NL", name: "Netherlands" },
	{ code: "NO", name: "Norway" },
	{ code: "NZ", name: "New Zealand" },
	{ code: "PH", name: "Philippines" },
	{ code: "PK", name: "Pakistan" },
	{ code: "PL", name: "Poland" },
	{ code: "PT", name: "Portugal" },
	{ code: "RO", name: "Romania" },
	{ code: "RU", name: "Russia" },
	{ code: "SA", name: "Saudi Arabia" },
	{ code: "SE", name: "Sweden" },
	{ code: "SG", name: "Singapore" },
	{ code: "TH", name: "Thailand" },
	{ code: "TR", name: "Turkey" },
	{ code: "TW", name: "Taiwan" },
	{ code: "UA", name: "Ukraine" },
	{ code: "US", name: "United States" },
	{ code: "VN", name: "Vietnam" },
	{ code: "ZA", name: "South Africa" },
].sort((a, b) => a.name.localeCompare(b.name));

/** ISO 639-1 languages for the source form's Language select (iso-639-1 dep). */
const SOURCE_LANGUAGES: { code: string; name: string }[] = ISO6391.getLanguages(
	ISO6391.getAllCodes(),
)
	.map((l) => ({ code: l.code, name: l.name }))
	.sort((a, b) => a.name.localeCompare(b.name));

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
 * v1.8.0 — source lists. The page is organised around curated lists:
 *   • Enabled lists — a group per list with a master on/off switch; a list's
 *     sources are shown inside it (each toggleable / editable individually).
 *   • My sources — user-created sources (not part of any list).
 *   • Browse community lists — downloaded-but-disabled lists to opt into
 *     (18+ lists are hidden by default and confirm before enabling).
 * A search box filters sources and list cards. Sources in a list can't be
 * deleted individually — hiding the whole list is the control (R-A10).
 */
export function SourcesPage() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: sources = [], isLoading } = useQuery({
		queryKey: ["sources"],
		queryFn: fetchSources,
	});
	const { data: lists = [] } = useQuery({
		queryKey: ["source-lists"],
		queryFn: fetchSourceLists,
	});
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	/** 18+ lists are hidden from browsing unless the setting is off. */
	const hideAdult =
		(settings?.["sourceLists.hideAdult"] as boolean | undefined) ?? true;

	const [search, setSearch] = useState("");
	/** Ephemeral per-view reveal of 18+ lists (the setting stays untouched). */
	const [showAdult, setShowAdult] = useState(false);
	/**
	 * Group-by dimension (v1.8.0): how the page organizes sources. "list" keeps
	 * the curated-list structure; category/country/city/language group sources
	 * into collapsible cards with a bulk master switch + per-source toggles.
	 * Defaults to category so the official 24 aren't one flat block.
	 */
	const [groupBy, setGroupBy] = useState<SourceGroupDimension | "list">(
		"category",
	);
	const [expandedList, setExpandedList] = useState<string | null>(null);
	const [expandedSource, setExpandedSource] = useState<string | null>(null);
	/** Source whose Custom time-range dialog is open, else null. */
	const [customRangeFor, setCustomRangeFor] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<{
		id: string;
		count: number;
	} | null>(null);
	/** Source form dialog state: closed, create, or edit an existing source. */
	const [formState, setFormState] = useState<
		{ mode: "create" } | { mode: "edit"; source: Source } | null
	>(null);
	/** List id awaiting the 18+ confirm before enabling. */
	const [confirmAdultId, setConfirmAdultId] = useState<string | null>(null);
	const [refreshResult, setRefreshResult] =
		useState<RefreshCatalogResult | null>(null);

	// ── my-sources.json export/import (v1.8.0) ─────────────────────────────
	const [selecting, setSelecting] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [exportOpen, setExportOpen] = useState(false);
	const [exportMeta, setExportMeta] = useState<{
		name: string;
		description: string;
		curator: string;
		nsfw: boolean;
	}>({ name: "", description: "", curator: "", nsfw: false });
	const [importError, setImportError] = useState<string | null>(null);
	const importFileInput = useRef<HTMLInputElement>(null);

	const selectedSources = sources.filter((s) => selected.has(s.id));

	const allTags = useMemo(
		() => [...new Set(sources.flatMap((s) => s.tags ?? []))].sort(),
		[sources],
	);

	const toggleSelected = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const cancelSelect = () => {
		setSelecting(false);
		setSelected(new Set());
	};

	const confirmExport = () => {
		const json = buildSourceListFile(
			{
				name: exportMeta.name.trim() || "My sources",
				description: exportMeta.description.trim(),
				nsfw: exportMeta.nsfw,
				curator: exportMeta.curator.trim() || undefined,
			},
			selectedSources,
		);
		downloadSourceListFile(json);
		setExportOpen(false);
		cancelSelect();
	};

	const doImport = async (file: File | undefined) => {
		if (!file) return;
		setImportError(null);
		try {
			const list = await importSourceList(await file.text());
			await enableSourceList(list.id);
			invalidate();
		} catch (err) {
			setImportError(
				err instanceof ApiException &&
					err.code === "sourceList.importInvalidJson"
					? t("sources.importInvalidJson")
					: err instanceof ApiException &&
						  err.code === "sourceList.importInvalid"
						? t("sources.importInvalid")
						: t("sources.importFailed"),
			);
		} finally {
			if (importFileInput.current) importFileInput.current.value = "";
		}
	};

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["sources"] });
		queryClient.invalidateQueries({ queryKey: ["source-lists"] });
	};
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
	/** Master switch on a list — on materializes its sources, off hides them. */
	const listToggle = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			enabled ? enableSourceList(id) : disableSourceList(id),
		onSuccess: invalidate,
	});
	/** Master switch on a category/country/city/language group (v1.8.0). */
	const groupToggle = useMutation({
		mutationFn: (input: BulkSourceEnableInput) => enableSourceGroup(input),
		onSuccess: invalidate,
	});
	const refresh = useMutation({
		mutationFn: refreshSourceLists,
		onSuccess: (res) => {
			setRefreshResult(res);
			invalidate();
		},
	});

	const enabledCount = sources.filter((s) => s.enabled).length;
	const customRangeSource =
		sources.find((s) => s.id === customRangeFor) ?? null;
	const sourceToDelete = sources.find((s) => s.id === confirmDeleteId) ?? null;

	// ── search + grouping ───────────────────────────────────────────────────
	const q = search.trim().toLowerCase();
	const srcMatches = (s: Source) =>
		!q ||
		s.name.toLowerCase().includes(q) ||
		s.url.toLowerCase().includes(q) ||
		s.category.toLowerCase().includes(q);
	const listMatches = (l: SourceListInfo) =>
		!q ||
		l.name.toLowerCase().includes(q) ||
		l.description.toLowerCase().includes(q);

	const filteredSources = sources.filter(srcMatches);
	const mySources = filteredSources.filter((s) => !s.listId);
	const sourcesForList = (listId: string) =>
		filteredSources.filter((s) => s.listId === listId);

	// Group-by (v1.8.0): bucket every source by the chosen dimension; untagged
	// sources land in an "Untagged" group at the end. Groups sort by size, then
	// name — the biggest categories/countries/cities surface first.
	const groupedSources = useMemo(() => {
		if (groupBy === "list") return [];
		const untaggedLabel = t("sources.groupUntagged");
		const map = new Map<string, Source[]>();
		for (const s of filteredSources) {
			const key = s[groupBy]?.trim() || untaggedLabel;
			const list = map.get(key) ?? [];
			list.push(s);
			map.set(key, list);
		}
		return [...map.entries()]
			.map(([value, groupSources]) => ({ value, sources: groupSources }))
			.sort(
				(a, b) =>
					b.sources.length - a.sources.length || a.value.localeCompare(b.value),
			);
	}, [groupBy, filteredSources, t]);

	// Enabled lists show when the list name/description matches OR it still has
	// matching sources. Disabled lists go to the browse section.
	const enabledLists = lists.filter(
		(l) => l.enabled && (listMatches(l) || sourcesForList(l.id).length > 0),
	);
	const allBrowse = lists.filter(
		(l) => !l.enabled && (listMatches(l) || sourcesForList(l.id).length > 0),
	);
	const hiddenAdultCount = allBrowse.filter((l) => l.nsfw).length;
	const browseLists = allBrowse.filter(
		(l) => showAdult || !l.nsfw || !hideAdult,
	);

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						{t("nav.sources")}
					</h2>
					<div className="flex items-center gap-4 font-label text-label-md text-on-tertiary-container">
						<span>{sources.length} total</span>
						<span className="h-1 w-1 rounded-full bg-outline-variant" />
						<span className="text-secondary">{enabledCount} enabled</span>
					</div>
				</div>
				<div className="flex flex-col items-end gap-2">
					<DocsHelpButton sectionId="sources" />
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={groupBy}
							onChange={(v) => setGroupBy(v as SourceGroupDimension | "list")}
							aria-label={t("sources.groupByAria")}
							options={[
								{
									value: "category",
									label: t("sources.groupCategory"),
									icon: "sell",
								},
								{
									value: "country",
									label: t("sources.groupCountry"),
									icon: "public",
								},
								{
									value: "city",
									label: t("sources.groupCity"),
									icon: "location_on",
								},
								{
									value: "language",
									label: t("sources.groupLanguage"),
									icon: "translate",
								},
								{
									value: "list",
									label: t("sources.groupList"),
									icon: "view_list",
								},
							]}
							className="w-48"
						/>
						<Input
							icon="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("sources.searchPlaceholder")}
							aria-label={t("sources.searchAria")}
							className="w-64"
						/>
						<Button
							variant="secondary"
							icon="cloud_sync"
							disabled={refresh.isPending}
							onClick={() => refresh.mutate()}
						>
							{refresh.isPending
								? t("sourceLists.checkingGithub")
								: t("sourceLists.checkGithub")}
						</Button>
						<Button
							variant="ghost"
							icon="upload_file"
							onClick={() => importFileInput.current?.click()}
						>
							{t("sources.importList")}
						</Button>
						<input
							ref={importFileInput}
							type="file"
							accept=".json,application/json"
							className="hidden"
							onChange={(e) => void doImport(e.target.files?.[0])}
						/>
						<Button icon="add" onClick={() => setFormState({ mode: "create" })}>
							{t("sources.addSource")}
						</Button>
					</div>
				</div>
			</header>

			{/* Refresh outcome — a failed check never clears the cached catalog. */}
			{refreshResult ? (
				<p className="mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-mono-technical text-on-tertiary-container">
					<span className="text-primary">
						{t("sourceLists.refreshAdded", {
							added: refreshResult.added.length,
						})}
					</span>
					{refreshResult.updated.length > 0 ? (
						<span>
							{t("sourceLists.refreshUpdated", {
								updated: refreshResult.updated.length,
							})}
						</span>
					) : null}
					{refreshResult.removed.length > 0 ? (
						<span>
							{t("sourceLists.refreshRemoved", {
								removed: refreshResult.removed.length,
							})}
						</span>
					) : null}
					{refreshResult.skipped.length > 0 ? (
						<span>
							{t("sourceLists.refreshSkipped", {
								skipped: refreshResult.skipped.length,
							})}
						</span>
					) : null}
				</p>
			) : null}
			{refresh.isError ? (
				<p className="mb-6 font-body text-body-sm text-error">
					{t("sourceLists.checkFail")}
				</p>
			) : null}
			{importError ? (
				<p className="mb-6 font-body text-body-sm text-error">{importError}</p>
			) : null}

			{isLoading ? (
				<p className="font-body text-body-md text-on-surface-variant">
					Loading sources…
				</p>
			) : (
				<div className="space-y-10">
					{groupBy === "list" ? (
						<>
							{/* ── Enabled lists ─────────────────────────────────────── */}
							{enabledLists.length > 0 ? (
								<section aria-labelledby="source-lists-heading">
									<h3
										id="source-lists-heading"
										className="mb-1 font-headline text-headline-sm text-on-surface"
									>
										{t("sourceLists.enabledTitle")}
									</h3>
									<p className="mb-4 font-body text-body-md text-on-surface-variant">
										{t("sourceLists.enabledSubtitle")}
									</p>
									<div className="space-y-4">
										{enabledLists.map((l) => (
											<SourceListGroup
												key={l.id}
												list={l}
												sources={sourcesForList(l.id)}
												expanded={expandedList === l.id}
												expandedSourceId={expandedSource}
												onToggleExpand={() =>
													setExpandedList((cur) => (cur === l.id ? null : l.id))
												}
												onToggleList={(enabled) =>
													listToggle.mutate({ id: l.id, enabled })
												}
												onToggleSource={(s) => toggle.mutate(s)}
												onSetWindow={(id, days, fetchFrom, fetchTo) =>
													setWindow.mutate({
														id,
														days,
														...(fetchFrom !== undefined ? { fetchFrom } : {}),
														...(fetchTo !== undefined ? { fetchTo } : {}),
													})
												}
												onCustomRange={(id) => setCustomRangeFor(id)}
												onToggleSourceExpand={(id) =>
													setExpandedSource((cur) => (cur === id ? null : id))
												}
												onEditSource={(s) =>
													setFormState({ mode: "edit", source: s })
												}
											/>
										))}
									</div>
								</section>
							) : null}

							{/* ── My sources ──────────────────────────────────────────── */}
							<section aria-labelledby="my-sources-heading">
								<div className="mb-1 flex flex-wrap items-center justify-between gap-3">
									<h3
										id="my-sources-heading"
										className="font-headline text-headline-sm text-on-surface"
									>
										{t("sourceLists.mySources")}
									</h3>
									{mySources.length > 0 ? (
										<Button
											variant="secondary"
											size="sm"
											icon="file_download"
											disabled={selecting}
											onClick={() => {
												setSelecting(true);
												setSelected(new Set());
											}}
										>
											{t("sources.exportList")}
										</Button>
									) : null}
								</div>
								<p className="mb-4 font-body text-body-md text-on-surface-variant">
									{t("sourceLists.mySourcesHint")}
								</p>
								{mySources.length === 0 ? (
									<p className="font-body text-body-sm text-on-surface-variant">
										{q ? `No sources match “${search}”.` : "No sources yet."}
									</p>
								) : (
									<div className="space-y-4">
										{mySources.map((s) => (
											<Fragment key={s.id}>
												<GhostCard className="flex items-center gap-4 py-4">
													{selecting ? (
														<input
															type="checkbox"
															aria-label={t("sources.selectSourceAria", {
																name: s.name,
															})}
															checked={selected.has(s.id)}
															onChange={() => toggleSelected(s.id)}
															className="h-4 w-4 shrink-0 accent-primary"
														/>
													) : null}
													<SourceRowContent
														source={s}
														expanded={expandedSource === s.id}
														onToggleExpand={() =>
															setExpandedSource((cur) =>
																cur === s.id ? null : s.id,
															)
														}
														onCustomRange={() => setCustomRangeFor(s.id)}
														onSetWindow={(days, fetchFrom, fetchTo) =>
															setWindow.mutate({
																id: s.id,
																days,
																...(fetchFrom !== undefined
																	? { fetchFrom }
																	: {}),
																...(fetchTo !== undefined ? { fetchTo } : {}),
															})
														}
														onToggle={() => toggle.mutate(s)}
														onEdit={() =>
															setFormState({ mode: "edit", source: s })
														}
														onDelete={() => setConfirmDeleteId(s.id)}
													/>
												</GhostCard>

												{expandedSource === s.id ? (
													<SourceArticles source={s} />
												) : null}

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
																onClick={() =>
																	remove.mutate({ id: s.id, force: true })
																}
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
							</section>
						</>
					) : (
						/* ── Grouped by category / country / city / language (v1.8.0) ── */
						<section aria-labelledby="source-groups-heading">
							<h3
								id="source-groups-heading"
								className="mb-1 font-headline text-headline-sm text-on-surface"
							>
								{t("sources.groupedBy", {
									dimension: t(
										`sources.group${groupBy.charAt(0).toUpperCase()}${groupBy.slice(1)}`,
									),
								})}
							</h3>
							<p className="mb-4 font-body text-body-md text-on-surface-variant">
								{t("sources.groupHint")}
							</p>
							{groupedSources.length === 0 ? (
								<p className="font-body text-body-sm text-on-surface-variant">
									{q
										? `No sources match “${search}”.`
										: t("sources.groupEmpty")}
								</p>
							) : (
								<div className="space-y-4">
									{groupedSources.map((g) => {
										const groupKey = `group:${groupBy}:${g.value}`;
										return (
											<SourceGroupCard
												key={groupKey}
												dimension={groupBy}
												value={g.value}
												sources={g.sources}
												expanded={expandedList === groupKey}
												expandedSourceId={expandedSource}
												onToggleExpand={() =>
													setExpandedList((cur) =>
														cur === groupKey ? null : groupKey,
													)
												}
												onToggleGroup={(enabled) =>
													groupToggle.mutate({
														dimension: groupBy,
														value: g.value,
														enabled,
													})
												}
												onToggleSource={(s) => toggle.mutate(s)}
												onSetWindow={(id, days, fetchFrom, fetchTo) =>
													setWindow.mutate({
														id,
														days,
														...(fetchFrom !== undefined ? { fetchFrom } : {}),
														...(fetchTo !== undefined ? { fetchTo } : {}),
													})
												}
												onCustomRange={(id) => setCustomRangeFor(id)}
												onToggleSourceExpand={(id) =>
													setExpandedSource((cur) => (cur === id ? null : id))
												}
												onEditSource={(s) =>
													setFormState({ mode: "edit", source: s })
												}
											/>
										);
									})}
								</div>
							)}
						</section>
					)}

					{/* ── Browse community / hidden lists ─────────────────────── */}
					<section aria-labelledby="browse-lists-heading">
						<h3
							id="browse-lists-heading"
							className="mb-1 font-headline text-headline-sm text-on-surface"
						>
							{t("sourceLists.browseTitle")}
						</h3>
						<p className="mb-4 font-body text-body-md text-on-surface-variant">
							{t("sourceLists.browseHint")}
						</p>

						{hideAdult && hiddenAdultCount > 0 ? (
							showAdult ? (
								<button
									type="button"
									onClick={() => setShowAdult(false)}
									className="mb-4 inline-flex items-center gap-1.5 rounded border border-outline-variant px-3 py-1 font-label text-label-sm text-on-surface-variant transition-colors hover:border-primary"
								>
									<Icon name="visibility_off" className="text-[16px]" />
									{t("sourceLists.hideAdult")}
								</button>
							) : (
								<button
									type="button"
									onClick={() => setShowAdult(true)}
									className="mb-4 inline-flex items-center gap-1.5 rounded border border-warning/40 px-3 py-1 font-label text-label-sm text-warning transition-colors hover:border-warning"
								>
									<Icon name="visibility" className="text-[16px]" />
									{t("sourceLists.showAdult")} ({hiddenAdultCount})
								</button>
							)
						) : null}

						{browseLists.length === 0 ? (
							<GhostCard className="flex flex-col items-start gap-3">
								<p className="font-body text-body-md text-on-surface">
									{q ? `No lists match “${search}”.` : t("sourceLists.noLists")}
								</p>
								{!q ? (
									<>
										<p className="font-body text-body-sm text-on-surface-variant">
											{t("sourceLists.noListsHint")}
										</p>
										<Button
											variant="secondary"
											icon="cloud_sync"
											disabled={refresh.isPending}
											onClick={() => refresh.mutate()}
										>
											{refresh.isPending
												? t("sourceLists.checkingGithub")
												: t("sourceLists.checkGithub")}
										</Button>
									</>
								) : null}
							</GhostCard>
						) : (
							<div className="space-y-4">
								{browseLists.map((l) => (
									<BrowseListCard
										key={l.id}
										list={l}
										onAdd={() => {
											if (l.nsfw) setConfirmAdultId(l.id);
											else listToggle.mutate({ id: l.id, enabled: true });
										}}
									/>
								))}
							</div>
						)}
					</section>
				</div>
			)}

			{/* ── dialogs ───────────────────────────────────────────────────── */}
			{formState !== null ? (
				<SourceFormDialog
					source={formState.mode === "edit" ? formState.source : null}
					onClose={() => setFormState(null)}
					existingTags={allTags}
				/>
			) : null}

			{/* 18+ list — explicit confirmation before enabling (age unknown). */}
			<ConfirmDialog
				open={Boolean(confirmAdultId)}
				title={t("sourceLists.adultConfirmTitle")}
				message={t("sourceLists.adultConfirmBody", {
					name: lists.find((l) => l.id === confirmAdultId)?.name ?? "",
				})}
				confirmLabel={t("sourceLists.addList")}
				icon="18_up_rating"
				danger={false}
				onConfirm={() => {
					if (!confirmAdultId) return;
					listToggle.mutate({ id: confirmAdultId, enabled: true });
					setConfirmAdultId(null);
				}}
				onCancel={() => setConfirmAdultId(null)}
			/>

			{/* Delete confirmation — always show before removing a source. */}
			<ConfirmDialog
				open={Boolean(confirmDeleteId)}
				title={t("sources.deleteTitle")}
				message={
					sourceToDelete ? (
						<Trans
							t={t}
							i18nKey="sources.deleteMessage"
							values={{ name: sourceToDelete.name }}
						>
							The source{" "}
							<strong className="text-on-surface">
								&quot;{sourceToDelete.name}&quot;
							</strong>{" "}
							and all its collected stories will be permanently removed. This
							cannot be undone.
						</Trans>
					) : (
						t("sources.deleteMessageNoName")
					)
				}
				confirmLabel={t("sources.deleteConfirm")}
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

			{/* my-sources.json — selection footer (v1.8.0) */}
			{selecting ? (
				<div className="fixed bottom-0 start-sidebar-width end-0 z-40 border-t border-outline-variant bg-surface-container-high px-6 py-3">
					<div className="mx-auto flex w-full max-w-max-content-width flex-wrap items-center justify-between gap-3">
						<p className="font-label text-label-md text-on-surface">
							{t("sources.selectedCount", { count: selected.size })}
						</p>
						<div className="flex items-center gap-2">
							<Button variant="ghost" size="sm" onClick={cancelSelect}>
								{t("common.cancel")}
							</Button>
							<Button
								size="sm"
								icon="file_download"
								disabled={selected.size === 0}
								onClick={() => setExportOpen(true)}
							>
								{t("sources.exportSelected")}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			{/* my-sources.json — export modal (v1.8.0) */}
			{exportOpen ? (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
					role="dialog"
					aria-modal="true"
					onClick={(e) => {
						if (e.target === e.currentTarget) setExportOpen(false);
					}}
				>
					<div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
						<h2 className="font-headline text-headline-sm text-on-surface">
							{t("sources.exportDialogTitle")}
						</h2>
						<p className="font-body text-body-md text-on-surface-variant">
							{t("sources.exportDialogBody", { count: selected.size })}
						</p>
						<div>
							<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
								{t("sources.exportName")}
							</label>
							<Input
								value={exportMeta.name}
								onChange={(e) =>
									setExportMeta((m) => ({ ...m, name: e.target.value }))
								}
								placeholder={t("sources.exportNamePlaceholder")}
								className="mt-1"
							/>
						</div>
						<div>
							<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
								{t("sources.exportDescription")}
							</label>
							<textarea
								dir="auto"
								value={exportMeta.description}
								onChange={(e) =>
									setExportMeta((m) => ({ ...m, description: e.target.value }))
								}
								placeholder={t("sources.exportDescriptionPlaceholder")}
								className="mt-1 h-20 w-full border border-outline-variant bg-transparent px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
							/>
						</div>
						<div>
							<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
								{t("sources.exportCurator")}
							</label>
							<Input
								value={exportMeta.curator}
								onChange={(e) =>
									setExportMeta((m) => ({ ...m, curator: e.target.value }))
								}
								placeholder={t("sources.exportCuratorPlaceholder")}
								className="mt-1"
							/>
						</div>
						<label className="flex cursor-pointer items-center gap-2 font-body text-body-md text-on-surface-variant">
							<input
								type="checkbox"
								checked={exportMeta.nsfw}
								onChange={(e) =>
									setExportMeta((m) => ({ ...m, nsfw: e.target.checked }))
								}
								className="h-4 w-4 accent-primary"
							/>
							{t("sources.exportNsfw")}
						</label>
						<p className="font-body text-body-sm text-on-tertiary-container">
							{t("sources.exportPublishHint")}
						</p>
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setExportOpen(false)}
							>
								{t("common.cancel")}
							</Button>
							<Button size="sm" icon="file_download" onClick={confirmExport}>
								{t("sources.exportDownload")}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}

/** One enabled list as a group: header (badges, counts, master switch) + its
 * sources when expanded. List sources are toggled/edited but never deleted —
 * the list owns them (hide the whole list instead). */
function SourceListGroup({
	list,
	sources,
	expanded,
	expandedSourceId,
	onToggleExpand,
	onToggleList,
	onToggleSource,
	onSetWindow,
	onCustomRange,
	onToggleSourceExpand,
	onEditSource,
}: {
	list: SourceListInfo;
	sources: Source[];
	expanded: boolean;
	/** The one source (across lists + My sources) whose articles panel is open. */
	expandedSourceId: string | null;
	onToggleExpand: () => void;
	onToggleList: (enabled: boolean) => void;
	onToggleSource: (s: Source) => void;
	onSetWindow: (
		id: string,
		days: number,
		fetchFrom?: Date | null,
		fetchTo?: Date | null,
	) => void;
	onCustomRange: (id: string) => void;
	onToggleSourceExpand: (id: string) => void;
	onEditSource: (s: Source) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="rounded border border-outline-variant bg-surface-container-low">
			<div className="flex items-start gap-4 p-6 pb-4">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-container-high">
					<Icon
						name={list.origin === "official" ? "verified" : "groups"}
						className="text-primary"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="font-label text-label-md text-on-surface">
							{list.name}
						</h4>
						<OriginBadge origin={list.origin} />
						{list.nsfw ? <AdultBadge /> : null}
					</div>
					{list.description ? (
						<p className="mt-1 font-body text-body-sm text-on-surface-variant">
							{list.description}
						</p>
					) : null}
					<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-mono-technical text-on-tertiary-container">
						<span>
							{t("sourceLists.sourceCount", { count: list.sourceCount })}
						</span>
						<span aria-hidden="true">·</span>
						<span>
							{t("sourceLists.onOfTotal", {
								on: list.enabledCount,
								total: list.sourceCount,
							})}
						</span>
						{list.origin === "community" ? (
							<>
								<span aria-hidden="true">·</span>
								<span className="inline-flex items-center gap-1">
									<Icon name="offline_pin" className="text-[13px]" />
									{t("sourceLists.offline")}
								</span>
							</>
						) : null}
						{list.curator ? (
							<>
								<span aria-hidden="true">·</span>
								<span>
									{t("sourceLists.curatorBy", { curator: list.curator })}
								</span>
							</>
						) : null}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Tooltip
						label={t("sourceLists.listToggleAria", { name: list.name })}
						position="bottom"
					>
						<button
							type="button"
							role="switch"
							aria-checked={list.enabled}
							aria-label={t("sourceLists.listToggleAria", { name: list.name })}
							onClick={() => onToggleList(!list.enabled)}
							className={cn(
								"relative h-6 w-11 rounded-full transition-colors",
								list.enabled ? "bg-primary" : "bg-outline-variant",
							)}
						>
							<span
								className={cn(
									"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-all",
									list.enabled ? "start-[22px]" : "start-0.5",
								)}
							/>
						</button>
					</Tooltip>
					<Tooltip
						label={
							expanded
								? t("sourceLists.collapseAria", { name: list.name })
								: t("sourceLists.expandAria", { name: list.name })
						}
						position="bottom"
					>
						<button
							type="button"
							onClick={onToggleExpand}
							aria-expanded={expanded}
							aria-label={
								expanded
									? t("sourceLists.collapseAria", { name: list.name })
									: t("sourceLists.expandAria", { name: list.name })
							}
							className="ms-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
						>
							<Icon
								name="expand_more"
								className={cn(
									"text-[18px] transition-transform",
									expanded && "rotate-180",
								)}
							/>
						</button>
					</Tooltip>
				</div>
			</div>

			{expanded ? (
				<div className="divide-y divide-outline-variant border-t border-outline-variant">
					{sources.length === 0 ? (
						<p className="px-6 py-4 font-body text-body-sm text-on-surface-variant">
							No sources in this list.
						</p>
					) : (
						sources.map((s) => (
							<div key={s.id} className="px-6 py-4">
								<SourceRowContent
									source={s}
									expanded={expandedSourceId === s.id}
									onToggleExpand={() => onToggleSourceExpand(s.id)}
									onCustomRange={() => onCustomRange(s.id)}
									onSetWindow={(days, fetchFrom, fetchTo) =>
										onSetWindow(s.id, days, fetchFrom, fetchTo)
									}
									onToggle={() => onToggleSource(s)}
									onEdit={() => onEditSource(s)}
								/>
								{/* Articles panel sits under the row inside the group. */}
								<div>
									<SourceArticlesInline
										source={s}
										expanded={expandedSourceId === s.id}
									/>
								</div>
							</div>
						))
					)}
				</div>
			) : null}
		</div>
	);
}

/**
 * A group of sources by category/country/city/language (v1.8.0). The header
 * shows the group label + counts + a master switch that bulk-enables every
 * source in the group (or disables them all); individual sources expand below
 * with their own toggles, time ranges, and edit — the same row UI as lists.
 */
function SourceGroupCard({
	dimension,
	value,
	sources,
	expanded,
	expandedSourceId,
	onToggleExpand,
	onToggleGroup,
	onToggleSource,
	onSetWindow,
	onCustomRange,
	onToggleSourceExpand,
	onEditSource,
}: {
	dimension: SourceGroupDimension;
	value: string;
	sources: Source[];
	expanded: boolean;
	/** The one source (across groups + My sources) whose articles panel is open. */
	expandedSourceId: string | null;
	onToggleExpand: () => void;
	onToggleGroup: (enabled: boolean) => void;
	onToggleSource: (s: Source) => void;
	onSetWindow: (
		id: string,
		days: number,
		fetchFrom?: Date | null,
		fetchTo?: Date | null,
	) => void;
	onCustomRange: (id: string) => void;
	onToggleSourceExpand: (id: string) => void;
	onEditSource: (s: Source) => void;
}) {
	const { t } = useTranslation();
	const allEnabled = sources.length > 0 && sources.every((s) => s.enabled);
	const enabledCount = sources.filter((s) => s.enabled).length;
	const label = dimensionValueLabel(dimension, value);
	const icon =
		dimension === "category"
			? "sell"
			: dimension === "country"
				? "public"
				: dimension === "city"
					? "location_on"
					: "translate";
	const stateLabel = allEnabled
		? t("sources.groupToggleOff", { label })
		: t("sources.groupToggleOn", { label });
	return (
		<div className="rounded border border-outline-variant bg-surface-container-low">
			<div className="flex items-start gap-4 p-6 pb-4">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-container-high">
					<Icon name={icon} className="text-primary" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="font-label text-label-md text-on-surface">
							{label}
						</h4>
						{dimension === "country" || dimension === "language" ? (
							<DomainTag>{value}</DomainTag>
						) : null}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-mono-technical text-on-tertiary-container">
						<span>
							{t("sources.groupSourceCount", { count: sources.length })}
						</span>
						<span aria-hidden="true">·</span>
						<span>
							{t("sourceLists.onOfTotal", {
								on: enabledCount,
								total: sources.length,
							})}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Tooltip label={stateLabel} position="bottom">
						<button
							type="button"
							role="switch"
							aria-checked={allEnabled}
							aria-label={stateLabel}
							onClick={() => onToggleGroup(!allEnabled)}
							className={cn(
								"relative h-6 w-11 rounded-full transition-colors",
								allEnabled ? "bg-primary" : "bg-outline-variant",
							)}
						>
							<span
								className={cn(
									"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-all",
									allEnabled ? "start-[22px]" : "start-0.5",
								)}
							/>
						</button>
					</Tooltip>
					<Tooltip
						label={
							expanded
								? t("sourceLists.collapseAria", { name: label })
								: t("sourceLists.expandAria", { name: label })
						}
						position="bottom"
					>
						<button
							type="button"
							onClick={onToggleExpand}
							aria-expanded={expanded}
							aria-label={
								expanded
									? t("sourceLists.collapseAria", { name: label })
									: t("sourceLists.expandAria", { name: label })
							}
							className="ms-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
						>
							<Icon
								name="expand_more"
								className={cn(
									"text-[18px] transition-transform",
									expanded && "rotate-180",
								)}
							/>
						</button>
					</Tooltip>
				</div>
			</div>

			{expanded ? (
				<div className="divide-y divide-outline-variant border-t border-outline-variant">
					{sources.map((s) => (
						<div key={s.id} className="px-6 py-4">
							<SourceRowContent
								source={s}
								expanded={expandedSourceId === s.id}
								onToggleExpand={() => onToggleSourceExpand(s.id)}
								onCustomRange={() => onCustomRange(s.id)}
								onSetWindow={(days, fetchFrom, fetchTo) =>
									onSetWindow(s.id, days, fetchFrom, fetchTo)
								}
								onToggle={() => onToggleSource(s)}
								onEdit={() => onEditSource(s)}
							/>
							<div>
								<SourceArticlesInline
									source={s}
									expanded={expandedSourceId === s.id}
								/>
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

/** A downloaded-but-disabled list in the browse section. "Add list" enables it
 * (18+ lists confirm first). A list here was either newly downloaded or
 * previously hidden — nothing is deleted by hiding (R-A10).
 */
function BrowseListCard({
	list,
	onAdd,
}: {
	list: SourceListInfo;
	onAdd: () => void;
}) {
	const { t } = useTranslation();
	return (
		<GhostCard className="flex items-start gap-4">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-container-high">
				<Icon name="download" className="text-primary" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<h4 className="font-label text-label-md text-on-surface">
						{list.name}
					</h4>
					<OriginBadge origin={list.origin} />
					{list.nsfw ? <AdultBadge /> : null}
				</div>
				{list.description ? (
					<p className="mt-1 font-body text-body-sm text-on-surface-variant">
						{list.description}
					</p>
				) : null}
				<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-mono-technical text-on-tertiary-container">
					<span>
						{t("sourceLists.sourceCount", { count: list.sourceCount })}
					</span>
					<span aria-hidden="true">·</span>
					<span className="inline-flex items-center gap-1">
						<Icon name="offline_pin" className="text-[13px]" />
						{t("sourceLists.offline")}
					</span>
					{list.curator ? (
						<>
							<span aria-hidden="true">·</span>
							<span>
								{t("sourceLists.curatorBy", { curator: list.curator })}
							</span>
						</>
					) : null}
				</div>
			</div>
			<Button
				size="sm"
				icon="add"
				onClick={onAdd}
				aria-label={t("sourceLists.addListAria", { name: list.name })}
			>
				{t("sourceLists.addList")}
			</Button>
		</GhostCard>
	);
}

/** Origin badge — Official (trusted, ships in-app) vs Community (GitHub). */
function OriginBadge({ origin }: { origin: SourceListOrigin }) {
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-label text-label-sm",
				origin === "official"
					? "bg-primary-container text-on-primary-container"
					: "bg-secondary-container text-on-secondary-container",
			)}
		>
			<Icon
				name={origin === "official" ? "verified" : "public"}
				className="text-[13px]"
			/>
			{origin === "official"
				? t("sourceLists.official")
				: t("sourceLists.community")}
		</span>
	);
}

/** 18+ badge — the list may contain adult content (age unknown). */
function AdultBadge() {
	const { t } = useTranslation();
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-label text-label-sm text-warning">
			<Icon name="18_up_rating" className="text-[13px]" />
			{t("sourceLists.adultBadge")}
		</span>
	);
}

/**
 * The controls of one source row: identity, category, URL, time range, on/off,
 * articles-in-range, edit, and (user sources only) delete.
 */
function SourceRowContent({
	source,
	expanded,
	onToggleExpand,
	onCustomRange,
	onSetWindow,
	onToggle,
	onEdit,
	onDelete,
}: {
	source: Source;
	expanded: boolean;
	onToggleExpand: () => void;
	onCustomRange: () => void;
	onSetWindow: (
		days: number,
		fetchFrom?: Date | null,
		fetchTo?: Date | null,
	) => void;
	onToggle: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { t } = useTranslation();
	return (
		<>
			<div
				className={cn(
					"flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-container-high",
					!source.enabled && "opacity-40",
				)}
			>
				<Icon name={typeIcon(source.type)} className="text-primary" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-3">
					<h4
						className={cn(
							"font-label text-label-md text-on-surface",
							!source.enabled && "line-through opacity-60",
						)}
					>
						{source.name}
					</h4>
					<DomainTag>{source.category}</DomainTag>
					{source.language ? (
						<Tooltip label={languageName(source.language)} position="bottom">
							<DomainTag className="text-secondary">
								{source.language}
							</DomainTag>
						</Tooltip>
					) : null}
					{source.authority ? (
						<Tooltip
							label={`${authorityLabel(source.authority)} — how credible this source is`}
							position="bottom"
						>
							<DomainTag className="text-warning">{source.authority}</DomainTag>
						</Tooltip>
					) : null}
					{/* v1.9.0 — free-form tags, shown as small chips. */}
					{(source.tags ?? []).slice(0, 6).map((tag) => (
						<DomainTag key={tag} className="text-primary">
							{tag}
						</DomainTag>
					))}
				</div>
				<p className="mt-1 truncate font-mono text-mono-technical text-on-tertiary-container dir-ltr-isolate">
					{source.url}
				</p>
				{/* Per-source time range = the advanced fetch window (default 7 days).
				Custom… opens a dialog instead of replacing the select inline. */}
				<div className="mt-2 flex items-center gap-2">
					<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
						Time range
					</span>
					<Select
						value={rangeValueFor(source)}
						onChange={(v) => {
							if (v === "custom") {
								onCustomRange();
							} else {
								onSetWindow(Number(v), null, null);
							}
						}}
						aria-label={t("sources.timeRangeAria", { name: source.name })}
						options={windowOptionsFor(source)}
						className="w-52"
					/>
				</div>
			</div>
			{source.lastCheckedAt ? (
				<span className="hidden font-mono text-mono-technical text-on-tertiary-container sm:block">
					{source.lastCheckedAt.toLocaleString()}
				</span>
			) : null}
			<div className="flex shrink-0 items-center gap-1">
				<Tooltip
					label={
						source.enabled
							? t("sources.disableTooltip")
							: t("sources.enableTooltip")
					}
					position="bottom"
				>
					<button
						onClick={onToggle}
						role="switch"
						aria-checked={source.enabled}
						aria-label={
							source.enabled
								? t("sources.disableAria", { name: source.name })
								: t("sources.enableAria", { name: source.name })
						}
						className={cn(
							"relative h-6 w-11 rounded-full transition-colors",
							source.enabled ? "bg-primary" : "bg-outline-variant",
						)}
					>
						<span
							className={cn(
								"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-all",
								source.enabled ? "start-[22px]" : "start-0.5",
							)}
						/>
					</button>
				</Tooltip>
				<Tooltip
					label={
						expanded
							? "Hide articles in this time range"
							: "Show articles in this time range"
					}
					position="bottom"
				>
					<button
						onClick={onToggleExpand}
						className="ms-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
						aria-label="Toggle articles in time range"
						aria-expanded={expanded}
					>
						<Icon name="article" className="text-[18px]" />
					</button>
				</Tooltip>
				{onEdit ? (
					<Tooltip
						label={t("sources.editAria", { name: source.name })}
						position="bottom"
					>
						<button
							onClick={onEdit}
							className="ms-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
							aria-label={t("sources.editAria", { name: source.name })}
						>
							<Icon name="edit" className="text-[18px]" />
						</button>
					</Tooltip>
				) : null}
				{onDelete ? (
					<Tooltip label={t("sources.deleteTooltip")} position="bottom">
						<button
							onClick={onDelete}
							className="ms-2 p-2 text-on-surface-variant transition-colors hover:text-error"
							aria-label={t("sources.deleteAria", { name: source.name })}
						>
							<Icon name="delete" className="text-[18px]" />
						</button>
					</Tooltip>
				) : null}
			</div>
		</>
	);
}

/**
 * Articles for one source within a time range — informational over surviving
 * data: retention pruning may have removed older stories, and `prunedNote`
 * explains when that happens instead of showing a silent empty list.
 */
function SourceArticles({ source }: { source: Source }) {
	return (
		<GhostCard className="space-y-3">
			<SourceArticlesInline source={source} expanded />
		</GhostCard>
	);
}

/** The article panel body — shared by the standalone row and list groups. */
function SourceArticlesInline({
	source,
	expanded,
}: {
	source: Source;
	expanded: boolean;
}) {
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
		enabled: expanded,
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

	if (!expanded) return null;
	return (
		<div className="space-y-3">
			{/* Panel header — what this list shows, and how many (R-D07). */}
			<div className="flex items-center justify-between gap-3">
				<span className="inline-flex items-center gap-1.5 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					<Icon name="article" className="text-[16px] text-primary" />
					Articles in this range
				</span>
				{data ? (
					<span className="rounded-full bg-secondary-container px-2 py-0.5 font-mono text-mono-technical text-on-secondary-container dir-ltr-isolate">
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
										className="hidden shrink-0 text-[16px] text-on-surface-variant transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 sm:block"
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
		</div>
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
	const { t } = useTranslation();
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

	// The overlay is inline — lock the page scroll while the dialog is open.
	useBodyScrollLock(Boolean(source));

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
								placeholder={t("sources.daysPlaceholder")}
								aria-label={t("sources.timeRangeDaysAria", {
									name: source.name,
								})}
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
								aria-label={t("sources.fromDateAria", {
									name: source.name,
								})}
								className="rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
							/>
							<span className="font-label text-label-sm text-on-tertiary-container">
								to
							</span>
							<input
								type="date"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								aria-label={t("sources.toDateAria", { name: source.name })}
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

/**
 * Source form dialog — create (source=null) or edit (source set).
 *
 * Create: the user picks a method (RSS/API/HTML/Sitemap) and the config
 * fields render from the plugin manifest (v1.8.0). Edit: the type is fixed and
 * the fields pre-fill from the source's configuration; saving calls PATCH
 * /sources/:id (name/category/configuration) — the URL and time range are
 * managed on the row itself.
 */
function SourceFormDialog({
	source,
	onClose,
	existingTags = [],
}: {
	source: Source | null;
	onClose: () => void;
	/** Tags already used on other sources — fed into the suggestion vocab. */
	existingTags?: string[];
}) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const isEdit = source !== null;
	const [name, setName] = useState("");
	const [type, setType] = useState<SourceType>("rss");
	const [category, setCategory] = useState<SourceCategory>("ai");
	const [useCustomCategory, setUseCustomCategory] = useState(false);
	const [customCategory, setCustomCategory] = useState("");
	/** Flat form values keyed by the manifest's dotted config key ("crawl.url"). */
	const [values, setValues] = useState<Record<string, string>>({});
	const [verifyResult, setVerifyResult] = useState<VerifySourceResult | null>(
		null,
	);
	// Geography/language tags (v1.8.0) — drive the group-by views on the page.
	// Blank = untagged until set.
	const [country, setCountry] = useState("");
	const [city, setCity] = useState("");
	const [language, setLanguage] = useState("");
	// Semantic metadata (v1.8.0) — the "source intelligence layer" data:
	// how broadly it matters (scope), how credible it is (authority), and the
	// fields it touches (impact areas, comma-separated lowercase slugs).
	const [scope, setScope] = useState("");
	const [authority, setAuthority] = useState("");
	const [impactAreasText, setImpactAreasText] = useState("");

	const [tags, setTags] = useState<string[]>([]);
	const tagVocab = useMemo(
		() => buildTagVocabulary(existingTags),
		[existingTags],
	);

	// Scope/authority dropdown labels come from the `scope.*` / `authority.*`
	// namespaces so the enum values stay stable while the UI translates.
	const scopeOptions = SOURCE_SCOPES.map((s) => ({
		value: s,
		label: t(`scope.${s}`),
	}));
	const authorityOptions = SOURCE_AUTHORITIES.map((a) => ({
		value: a,
		label: t(`authority.${a}`),
	}));

	// The overlay is inline — lock the page scroll so the page behind the
	// fixed dialog can't scroll (only the dialog's own scroll region moves).
	useBodyScrollLock();

	const finalCategory = useCustomCategory
		? customCategory.trim().toLowerCase().replace(/\s+/g, "-") || "other"
		: category;

	// The form's per-method config schema comes from the plugin manifests
	// (v1.8.0) — GET /plugins powers the data-driven fields below.
	const { data: plugins } = useQuery({
		queryKey: ["plugins"],
		queryFn: fetchPlugins,
	});
	const manifest = plugins?.find((p) => p.type === type);
	const configFields = manifest?.configFields ?? [];

	// Reset when opening in create mode.
	useEffect(() => {
		if (source) return;
		setName("");
		setType("rss");
		setCategory("ai");
		setUseCustomCategory(false);
		setCustomCategory("");
		setCountry("");
		setCity("");
		setLanguage("");
		setScope("");
		setAuthority("");
		setImpactAreasText("");
		setTags((prev) => (prev.length === 0 ? prev : []));
		setValues({});
		setVerifyResult(null);
	}, [source]);

	// Prefill when editing — after the manifest arrives (it decides which
	// config keys to prefill; the type itself is fixed in edit mode).
	useEffect(() => {
		if (!source) return;
		setName(source.name);
		setType(source.type);
		const known = CATEGORIES.includes(source.category as SourceCategory);
		if (known) {
			setCategory(source.category as SourceCategory);
			setUseCustomCategory(false);
			setCustomCategory("");
		} else {
			setUseCustomCategory(true);
			setCustomCategory(source.category);
		}
		setCountry(source.country ?? "");
		setCity(source.city ?? "");
		setLanguage(source.language ?? "");
		setScope(source.scope ?? "");
		setAuthority(source.authority ?? "");
		setImpactAreasText((source.impactAreas ?? []).join(", "));
		setTags((prev) => {
			const next = source.tags ?? [];
			return prev.length === next.length && prev.every((x, i) => x === next[i])
				? prev
				: next;
		});
		if (configFields.length === 0) return; // manifest not loaded yet
		const flat: Record<string, string> = {};
		for (const f of configFields) {
			const v = getDotted(source.configuration, f.key);
			if (typeof v === "string" || typeof v === "number") {
				flat[f.key] = String(v);
			}
		}
		setValues(flat);
		setVerifyResult(null);
	}, [source, configFields]);

	const primaryUrlKey =
		configFields.find((f) => f.type === "url")?.key ??
		configFields[0]?.key ??
		"";
	const primaryUrl = values[primaryUrlKey] ?? "";

	/** Build the nested `configuration` object from dotted keys ("crawl.url"). */
	const buildConfiguration = () => {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(values)) {
			const trimmed = value.trim();
			if (!trimmed) continue;
			setDotted(out, key, trimmed);
		}
		return out;
	};

	/**
	 * Impact areas from the comma-separated input (v1.8.0) — lowercase slugs,
	 * deduped, capped at 12. An empty list resolves to null (untagged); the
	 * engine re-normalizes (hyphenation) before storing.
	 */
	const parsedImpactAreas = [
		...new Set(
			impactAreasText
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean),
		),
	].slice(0, 12);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["sources"] });
		queryClient.invalidateQueries({ queryKey: ["source-lists"] });
	};
	const create = useMutation({
		mutationFn: (input: CreateSourceInput) => createSource(input),
		onSuccess: () => {
			invalidate();
			onClose();
		},
	});
	const save = useMutation({
		mutationFn: () =>
			updateSource(source!.id, {
				name,
				category: finalCategory,
				configuration: buildConfiguration(),
				country: country || null,
				city: city || null,
				language: language || null,
				scope: (scope || null) as SourceScope | null,
				authority: (authority || null) as SourceAuthority | null,
				impactAreas: parsedImpactAreas,
				tags: tags.length ? tags : null,
			}),
		onSuccess: () => {
			invalidate();
			onClose();
		},
	});

	const verify = useMutation({
		mutationFn: () =>
			verifySource({
				type,
				url: primaryUrl,
				configuration: buildConfiguration(),
			}),
		onSuccess: setVerifyResult,
		onError: (err) => {
			setVerifyResult({
				ok: false,
				error: err instanceof Error ? err.message : "verify failed",
				itemCount: 0,
				samples: [],
			});
		},
	});

	const pending = isEdit ? save.isPending : create.isPending;

	const submit = () => {
		if (!name.trim() || !primaryUrl.trim()) return;
		if (isEdit) {
			save.mutate();
		} else {
			create.mutate({
				name,
				url: primaryUrl,
				type,
				category: finalCategory,
				configuration: buildConfiguration(),
				country: country || null,
				city: city || null,
				language: language || null,
				scope: (scope || null) as SourceScope | null,
				authority: (authority || null) as SourceAuthority | null,
				impactAreas: parsedImpactAreas,
				tags: tags.length ? tags : null,
			});
		}
	};

	// Escape closes the dialog; Enter submits through the native form.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const canSubmit = Boolean(name.trim() && primaryUrl.trim()) && !pending;

	const setField = (key: string, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="source-form-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container shadow-2xl">
				<div className="flex items-start gap-4 p-6 pb-4">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="rss_feed" className="text-[20px]" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="source-form-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							{isEdit ? t("sources.editTitle") : t("sources.addTitle")}
						</h2>
						<p className="mt-1 font-body text-body-sm text-on-surface-variant">
							{t("sources.editSubtitle")}
						</p>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
					className="flex min-h-0 flex-1 flex-col"
				>
					{/* The per-method config fields can be long (html/api) — they live
					    in a scroll region so the modal never outgrows the screen; the
					    Test/Cancel/Add footer stays fixed below (v1.8.0). */}
					<ScrollArea
						fadeClassName="from-surface-container"
						role="group"
						aria-label="Source configuration"
						className="px-6 pb-2"
					>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="source-form-name"
									className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
								>
									{t("sources.nameLabel")}
								</label>
								<div className="mt-1">
									<Input
										id="source-form-name"
										autoFocus
										value={name}
										onChange={(e) => setName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && canSubmit) {
												e.preventDefault();
												submit();
											}
										}}
										placeholder={t("sources.namePlaceholder")}
									/>
								</div>
							</div>

							{/* Method: pickable when creating, fixed when editing. */}
							{isEdit ? (
								<div>
									<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
										Method
									</span>
									<div className="mt-1">
										<span className="inline-flex items-center gap-1.5 rounded border border-outline-variant px-3 py-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
											<PluginIcon
												icon={manifest?.icon}
												iconSrc={manifest?.iconSrc}
												className="h-[16px] w-[16px] text-[16px]"
											/>
											{type}
										</span>
									</div>
								</div>
							) : (
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
												{/* v1.8.0 — the method's own connector icon (custom image
														    or ligature) from its manifest, falling back to the
														    built-in type map. */}
												<PluginIcon
													icon={
														plugins?.find((p) => p.type === t)?.icon ??
														typeIcon(t)
													}
													iconSrc={plugins?.find((p) => p.type === t)?.iconSrc}
													className="h-[16px] w-[16px] text-[16px]"
												/>
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
							)}

							{/* Per-method config fields — driven by the plugin manifest (v1.8.0). */}
							{configFields.length > 0 ? (
								<div className="space-y-4 border-t border-outline-variant pt-4">
									{configFields.map((f) => (
										<ConfigFieldInput
											key={f.key}
											field={f}
											value={values[f.key] ?? ""}
											onChange={(v) => setField(f.key, v)}
											onEnter={
												canSubmit
													? () => {
															if (canSubmit) submit();
														}
													: undefined
											}
										/>
									))}
								</div>
							) : null}
							<div>
								<div className="mb-1 flex items-center gap-1">
									<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
										{t("sources.categoryLabel")}
									</span>
									<FieldHelp label={t("sources.categoryHint")} />
								</div>
								{useCustomCategory ? (
									<div>
										<div className="flex gap-2">
											<Input
												value={customCategory}
												onChange={(e) => setCustomCategory(e.target.value)}
												placeholder={t("sources.customCategoryPlaceholder")}
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
										{/* v1.9.0 — live category suggestions from the shared vocab
											    (tech-catalog + built-ins); click to adopt. */}
										{suggestTags(customCategory, tagVocab).length > 0 ? (
											<div className="mt-2 flex flex-wrap gap-1.5">
												{suggestTags(customCategory, tagVocab).map((sug) => (
													<button
														key={sug}
														type="button"
														onClick={() => {
															setUseCustomCategory(false);
															setCategory(sug as SourceCategory);
														}}
														className="rounded-full border border-outline-variant px-2.5 py-0.5 font-label text-label-sm text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
													>
														{sug}
													</button>
												))}
											</div>
										) : null}
									</div>
								) : (
									<div className="flex gap-2">
										<Select
											value={category}
											onChange={(v) => setCategory(v as SourceCategory)}
											aria-label={t("sources.categoryAria")}
											options={CATEGORIES.map((c) => ({
												value: c,
												label: c.replace(/-/g, " "),
											}))}
											searchable
											searchPlaceholder={t("sources.categorySearchPlaceholder")}
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

							{/* v1.9.0 — free-form tags: chips with live suggestions
								    (tech-catalog + categories + impact areas + existing
								    tags). Comma/Enter/+ commit; × removes. */}
							<div>
								<div className="mb-1 flex items-center gap-1">
									<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
										{t("sources.tags")}
									</span>
									<FieldHelp label={t("sources.tagsHint")} />
								</div>
								<TagInput
									value={tags}
									onChange={setTags}
									suggestions={tagVocab}
									placeholder={t("sources.tagsPlaceholder")}
									aria-label={t("sources.tagsAria")}
									addButtonLabel={t("sources.tagsAdd")}
								/>
							</div>

							{/* Geography/language tags (v1.8.0) — where the source is
								    based and what it publishes in; these power the group-by
								    views on the Sources page. Blank = untagged. */}
							<div className="space-y-3">
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<div className="mb-1 flex items-center gap-1">
											<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
												{t("sources.countryLabel")}
											</span>
											<FieldHelp label={t("sources.countryHint")} />
										</div>
										<Select
											value={country}
											onChange={setCountry}
											aria-label={t("sources.countryAria")}
											placeholder={t("sources.countryPlaceholder")}
											options={COUNTRIES.map((c) => ({
												value: c.code,
												label: c.name,
											}))}
										/>
									</div>
									<div>
										<div className="mb-1 flex items-center gap-1">
											<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
												{t("sources.languageLabel")}
											</span>
											<FieldHelp label={t("sources.languageHint")} />
										</div>
										<Select
											value={language}
											onChange={setLanguage}
											aria-label={t("sources.languageAria")}
											placeholder={t("sources.languagePlaceholder")}
											options={SOURCE_LANGUAGES.map((l) => ({
												value: l.code,
												label: l.name,
											}))}
										/>
									</div>
								</div>
								<div>
									<div className="mb-1 flex items-center gap-1">
										<label
											htmlFor="source-form-city"
											className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
										>
											{t("sources.cityLabel")}
										</label>
										<FieldHelp label={t("sources.cityHint")} />
									</div>
									<Input
										id="source-form-city"
										value={city}
										onChange={(e) => setCity(e.target.value)}
										placeholder={t("sources.cityPlaceholder")}
										icon="location_on"
									/>
								</div>
							</div>

							{/* Semantic metadata (v1.8.0) — the "source intelligence layer"
							    data: scope (how broadly it matters), authority (how credible
							    it is), and impact areas (what fields it touches). Optional;
							    power the intelligence layer later, stored + editable now. */}
							<div className="space-y-3">
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<div className="mb-1 flex items-center gap-1">
											<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
												{t("sources.scopeLabel")}
											</span>
											<FieldHelp label={t("sources.scopeHint")} />
										</div>
										<Select
											value={scope}
											onChange={setScope}
											aria-label={t("sources.scopeAria")}
											placeholder={t("sources.scopePlaceholder")}
											options={scopeOptions}
										/>
									</div>
									<div>
										<div className="mb-1 flex items-center gap-1">
											<span className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
												{t("sources.authorityLabel")}
											</span>
											<FieldHelp label={t("sources.authorityHint")} />
										</div>
										<Select
											value={authority}
											onChange={setAuthority}
											aria-label={t("sources.authorityAria")}
											placeholder={t("sources.authorityPlaceholder")}
											options={authorityOptions}
										/>
									</div>
								</div>
								<div>
									<div className="mb-1 flex items-center gap-1">
										<label
											htmlFor="source-form-impact-areas"
											className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
										>
											{t("sources.impactAreasLabel")}
										</label>
										<FieldHelp label={t("sources.impactAreasHint")} />
									</div>
									<Input
										id="source-form-impact-areas"
										value={impactAreasText}
										onChange={(e) => setImpactAreasText(e.target.value)}
										placeholder={t("sources.impactAreasPlaceholder")}
										icon="category"
									/>
									{/* Suggested vocabulary chips — clicking toggles a slug in the
									    comma list without wiping custom values. */}
									{(() => {
										const currentAreas = new Set(
											impactAreasText
												.split(",")
												.map((s) => s.trim().toLowerCase())
												.filter(Boolean),
										);
										return (
											<div className="mt-2 flex flex-wrap gap-1.5">
												{SOURCE_IMPACT_AREAS.map((area) => {
													const selected = currentAreas.has(area);
													return (
														<button
															key={area}
															type="button"
															aria-pressed={selected}
															onClick={() => {
																const parts = [...currentAreas];
																const next = selected
																	? parts.filter((p) => p !== area)
																	: [...parts, area];
																setImpactAreasText(next.join(", "));
															}}
															className={cn(
																"rounded-full border px-2 py-0.5 font-label text-label-sm transition-colors",
																selected
																	? "border-primary bg-primary text-on-primary"
																	: "border-outline-variant text-on-surface-variant hover:border-primary",
															)}
														>
															{area}
														</button>
													);
												})}
											</div>
										);
									})()}
								</div>
							</div>

							{(create.error ?? save.error) ? (
								<p className="font-mono text-mono-technical text-error">
									{(create.error ?? save.error)!.message}
								</p>
							) : null}

							{/* v1.8.0 — dry-run the config before saving (POST /sources/verify). */}
							{verifyResult ? (
								<div className="rounded border border-outline-variant bg-surface-container-low p-3">
									<p
										className={`font-body text-body-sm ${
											verifyResult.ok ? "text-on-surface" : "text-error"
										}`}
									>
										{verifyResult.ok
											? t("sources.testOk", { count: verifyResult.itemCount })
											: t("sources.testFail", {
													message: verifyResult.error ?? "",
												})}
									</p>
									{verifyResult.ok && verifyResult.samples.length > 0 ? (
										<ul className="mt-2 list-disc ps-5 font-body text-body-sm text-on-surface-variant">
											{verifyResult.samples.map((s) => (
												<li key={s}>{s}</li>
											))}
										</ul>
									) : null}
								</div>
							) : null}
						</div>
					</ScrollArea>

					<div className="flex justify-end gap-2 border-t border-outline-variant px-6 py-4">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							icon="wifi_tethering"
							disabled={!primaryUrl.trim() || verify.isPending}
							onClick={() => verify.mutate()}
						>
							{verify.isPending ? t("sources.testing") : t("sources.test")}
						</Button>
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							{t("sources.cancel")}
						</Button>
						<Button type="submit" size="sm" icon="check" disabled={!canSubmit}>
							{pending
								? isEdit
									? t("sources.saving")
									: t("sources.adding")
								: isEdit
									? t("sources.saveChanges")
									: t("sources.addSource")}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

/** One manifest config field rendered as a labeled input (v1.8.0). */
function ConfigFieldInput({
	field,
	value,
	onChange,
	onEnter,
}: {
	field: ConfigField;
	value: string;
	onChange: (v: string) => void;
	onEnter?: () => void;
}) {
	const id = `source-form-field-${field.key}`;
	return (
		<div>
			<div className="mb-1 flex items-center gap-1">
				<label
					htmlFor={id}
					className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
				>
					{field.label}
				</label>
				{field.hint ? <FieldHelp label={field.hint} /> : null}
			</div>
			<div className="mt-1">
				{field.type === "textarea" ? (
					<textarea
						id={id}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						rows={2}
						placeholder={field.placeholder}
						className="w-full border border-outline-variant bg-transparent px-4 py-3 font-mono text-mono-technical text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
					/>
				) : (
					<Input
						id={id}
						type={field.type === "number" ? "number" : "text"}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && onEnter) {
								e.preventDefault();
								onEnter();
							}
						}}
						placeholder={field.placeholder}
						icon={
							field.type === "url"
								? "link"
								: field.type === "number"
									? "pin"
									: undefined
						}
					/>
				)}
			</div>
		</div>
	);
}

/** Read a value at a dotted path ("crawl.url") inside a nested object. */
function getDotted(obj: unknown, dotted: string): unknown {
	const parts = dotted.split(".");
	let cur: unknown = obj;
	for (const part of parts) {
		if (typeof cur !== "object" || cur === null) return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

/** Set a value at a dotted path ("crawl.url") inside a nested object. */
function setDotted(
	target: Record<string, unknown>,
	dotted: string,
	value: string,
): void {
	const parts = dotted.split(".");
	let cur = target;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]!;
		const next = cur[part];
		if (typeof next !== "object" || next === null) {
			cur[part] = {};
		}
		cur = cur[part] as Record<string, unknown>;
	}
	cur[parts[parts.length - 1]!] = value;
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
		case "github":
			return "hub";
		case "reddit":
			return "forum";
		case "arxiv":
			return "science";
		default:
			return "storage";
	}
}
