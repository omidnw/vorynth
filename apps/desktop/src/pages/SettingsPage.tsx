import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LlmProviderKind } from "@vorynth/types";
import { aiErrorMessage } from "@/features/llm/ai-error.js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemeToggle } from "@/components/shell/ThemeToggle.js";
import { useThemeStore, availableThemes } from "@/lib/theme/theme-store.js";
import { WelcomeSection } from "@/features/onboarding/WelcomeSection.js";
import { PluginSettingsSections } from "@/features/plugins/PluginSettingsSections.js";
import { UsageSection } from "@/features/llm/UsageSection.js";
import { DataOwnershipSection } from "@/features/backup/DataOwnershipSection.js";
import { RetentionSection } from "@/features/settings/RetentionSection.js";
import { TrashSection } from "@/features/settings/TrashSection.js";
import { SourceListsSection } from "@/features/settings/SourceListsSection.js";
import { SummaryLanguageSection } from "@/features/settings/SummaryLanguageSection.js";
import { MediaSettingsSection } from "@/features/settings/MediaSettingsSection.js";
import { LaunchSection } from "@/features/settings/LaunchSection.js";
import { AdvancedSection } from "@/features/settings/AdvancedSection.js";
import { DeveloperSection } from "@/features/settings/DeveloperSection.js";
import { DataHealthSection } from "@/features/settings/DataHealthSection.js";
import { StorageSection } from "@/features/settings/StorageSection.js";
import { UpdatesSection } from "@/features/updater/UpdatesSection.js";
import { ThemeManager } from "@/features/themes/ThemeManager.js";
import { NotificationsSection } from "@/features/settings/NotificationsSection.js";
import { FontSection } from "@/features/settings/FontSection.js";
import { BriefActionsSection } from "@/features/settings/BriefActionsSection.js";
import { ReaderActionsSection } from "@/features/settings/ReaderActionsSection.js";
import { ReaderSettingsSection } from "@/features/settings/ReaderSettingsSection.js";
import { CardClickSection } from "@/features/settings/CardClickSection.js";
import { ConfirmResetSection } from "@/features/settings/ConfirmResetSection.js";
import { CrossPageHint } from "@/features/settings/CrossPageHint.js";
import { findCrossPageTopic } from "@/features/settings/cross-page-search.js";
import { useSectionHighlight } from "@/features/settings/use-section-highlight.js";
import { HistorySection } from "@/features/history/HistorySection.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { SettingsCategory } from "@/components/settings/SettingsCategory.js";
import {
	CategoryRail,
	CategoryChips,
} from "@/components/settings/CategoryRail.js";
import { SettingsSearch } from "@/components/settings/SettingsSearch.js";
import { useCategorySearch } from "@/components/settings/useCategorySearch.js";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { useFinishedJobError } from "@/features/jobs/use-finished-job-error.js";
import { fetchEngineStatus, verifyLlm } from "@/features/brief/brief-api.js";
import {
	activateProvider,
	deleteProvider,
	fetchMode,
	fetchProviders,
	saveProvider,
	setMode,
	type ProviderRow,
} from "@/features/llm/llm-api.js";

/**
 * Settings page (examples/application-settings.html).
 *
 * Shows engine status, current LLM provider, theme toggle, and data controls.
 * For the slice the API key is read from the engine's env (set via .env or the
 * Tauri shell); the UI surfaces whether one is active. Key entry in-app lands
 * with the encrypted-vault work in Phase 6.
 */
export function SettingsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: status } = useQuery({
		queryKey: ["engine-status"],
		queryFn: fetchEngineStatus,
		refetchInterval: 30_000,
	});

	const categories = useMemo(
		() => [
			{
				id: "settings-general",
				label: t("settings.categoryGeneral"),
				icon: "settings",
				// v1.8.0 — the keyword blob is localized: it follows the selected
				// UI language, so typing in Persian/French/… matches too.
				search: t("settings.searchGeneral"),
				// v1.8.1 — per-card blobs: a query that matches an ITEM rings the
				// card, not the whole category (so "appearance" only rings the
				// Appearance card, and "translate" also suggests the Language
				// card). Appearance/theme were removed from the category blob.
				// v1.9.0 — every other General card gets its own blob (engine,
				// mode, welcome, launch, updates, notifications, advanced,
				// developer, navigation).
				items: [
					{
						id: "appearance",
						search:
							"appearance theme light dark colors font fonts text size custom theme",
					},
					{
						id: "language",
						search:
							"language translate translation languages app language ui language",
					},
					{
						id: "engine",
						search: "engine status version articles mode",
					},
					{
						id: "mode",
						search: "mode news intelligence",
					},
					{
						id: "welcome",
						search: "welcome setup onboarding",
					},
					{
						id: "launch",
						search: "launch startup login background hidden tray",
					},
					{
						id: "updates",
						search: "updates update upgrade auto-update",
					},
					{
						id: "notifications",
						search: "notifications bell",
					},
					{
						id: "advanced2",
						search: "advanced features developer plugins",
					},
					{
						id: "developer2",
						search: "developer network cors backend frontend",
					},
					{
						id: "navigation2",
						search: "navigation archive sidebar",
					},
					{
						id: "briefActions",
						search: "story card actions footer save bookmark order",
					},
					{
						id: "readerActions",
						search:
							"reader actions bar footer article insight more menu pinned",
					},
					{
						id: "readerSettings",
						search: "reader settings support author reminder media local keep",
					},
					{
						id: "cardClick",
						search: "card click drag selects text open story",
					},
					{
						id: "confirmDialogs",
						search: "confirmation dialogs reset don't ask again",
					},
				],
			},
			{
				id: "settings-intelligence",
				label: t("settings.categoryIntelligence"),
				icon: "psychology",
				search: t("settings.searchIntelligence"),
				items: [
					{
						id: "summaryLanguage",
						search: "summary original language",
					},
				],
			},
			{
				id: "settings-data",
				label: t("settings.categoryData"),
				icon: "data_usage",
				search: t("settings.searchData"),
				items: [
					{
						id: "dataHealth",
						search: "data health check repair",
					},
					{
						id: "retention",
						search: "retention delete auto-delete",
					},
					{
						id: "trash",
						search: "trash soft delete",
					},
					{
						id: "mediaWarn",
						search: "media download warning",
					},
				],
			},
			{
				id: "settings-sources",
				label: t("settings.categorySources"),
				icon: "view_list",
				search: t("settings.searchSources"),
				items: [
					{
						id: "sourceListsSettings",
						search: "source lists adult 18+",
					},
				],
			},
			{
				id: "settings-plugins",
				label: t("settings.categoryPlugins"),
				icon: "extension",
				search: t("settings.searchPlugins"),
			},
		],
		[t],
	);

	const {
		query,
		setQuery,
		activeId,
		select,
		dimmedIds,
		noResults,
		matches,
		highlightedIds,
		highlightedItemIds,
		focusFirstMatch,
	} = useCategorySearch(categories);
	/** v1.8.0 — deep-linked `?section=` from the cross-page search hint. */
	const highlightFromLink = useSectionHighlight();
	const crossTopic = findCrossPageTopic(query, "/settings", t);
	const isHighlighted = (id: string) =>
		highlightedIds.includes(id) || highlightFromLink === id;
	// v1.8.1 — per-card search ring (a matched card, not the whole category).
	// v1.9.0 — matches items in ANY category (General cards + the Data /
	// Intelligence / Sources cards), so "auto-delete" rings the Retention card
	// wherever it lives.
	const itemHit = (itemId: string) =>
		highlightedItemIds.some((h) => h.itemId === itemId);
	/** Ring class for a card that matches the current search (v1.9.0). */
	const hit = (itemId: string) =>
		itemHit(itemId) ? "ring-2 ring-primary/40" : undefined;

	// v1.8.0 — the jump-to-result happens on Enter / the search button, never
	// mid-keystroke. When the query matches a topic that lives on the OTHER
	// page, the cross-page hint takes focus priority (the thing isn't here).
	const hintRef = useRef<HTMLDivElement>(null);
	const [hintFocused, setHintFocused] = useState(false);
	const focusSearch = () => {
		if (crossTopic) {
			setHintFocused(true);
			hintRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		focusFirstMatch();
	};

	const navItems = useMemo(
		() => categories.map(({ id, label, icon }) => ({ id, label, icon })),
		[categories],
	);

	const cat = (id: string) => categories.find((c) => c.id === id);
	const railLabel = t("settings.title");

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">
						<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
							{t("settings.title")}
						</h2>
						<p className="font-body text-body-md text-on-surface-variant">
							{t("settings.subtitle")}
						</p>
					</div>
					<DocsHelpButton sectionId="settings" />
				</div>
			</header>

			<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
				{/* Category rail — sticky navigation, shown on lg+ screens */}
				<CategoryRail
					className="hidden lg:block"
					items={navItems}
					activeId={activeId}
					onSelect={select}
					dimmedIds={dimmedIds}
					ariaLabel={railLabel}
				/>
				{/* Category chips — narrow screens, below lg */}
				<CategoryChips
					className="lg:hidden"
					items={navItems}
					activeId={activeId}
					onSelect={select}
					dimmedIds={dimmedIds}
					ariaLabel={railLabel}
				/>

				<div className="min-w-0 flex-1 space-y-8">
					<SettingsSearch
						value={query}
						onChange={(v) => {
							setQuery(v);
							setHintFocused(false);
						}}
						onSearch={focusSearch}
					/>

					{/* v1.8.0 — "this setting lives on the Profile page" hint */}
					{crossTopic ? (
						<CrossPageHint
							topic={crossTopic}
							highlighted={hintFocused}
							hintRef={hintRef}
						/>
					) : null}

					{noResults ? (
						<p className="font-body text-body-md text-on-surface-variant">
							{t("common.noResults")}
						</p>
					) : null}

					{/* ── General ─────────────────────────────────────────────── */}
					<SettingsCategory
						id="settings-general"
						title={cat("settings-general")?.label ?? ""}
						icon={cat("settings-general")?.icon}
						search={cat("settings-general")?.search}
						highlighted={isHighlighted("settings-general")}
						className={matches("settings-general") ? undefined : "hidden"}
					>
						{/* Engine status */}
						<GhostCard
							data-search-id="engine"
							className={
								itemHit("engine") ? "ring-2 ring-primary/40" : undefined
							}
						>
							<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
								<Icon name="memory" className="text-base" />
								{t("settings.engine")}
							</h3>
							{status ? (
								<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
									<Stat label={t("settings.version")} value={status.version} />
									<Stat
										label={t("sourcesLabel")}
										value={t("settings.sourcesCount", {
											on: status.sources.enabled,
											total: status.sources.total,
										})}
									/>
									<Stat
										label={t("settings.articles")}
										value={String(status.articles.total)}
									/>
									<Stat
										label={t("settings.mode")}
										value={
											status.llm.mode === "intelligence"
												? t("settings.modeIntelligence")
												: t("settings.modeNews")
										}
										tone={
											status.llm.mode === "intelligence" ? "primary" : "muted"
										}
									/>
								</div>
							) : (
								<p className="font-body text-body-md text-on-surface-variant">
									Loading…
								</p>
							)}
						</GhostCard>

						{/* Mode toggle — separate from provider config */}
						<div data-search-id="mode" className={hit("mode")}>
							<ModeSection />
						</div>

						{/* Appearance — v1.8.1: per-card search ring (itemHit) so
						    "appearance"/"theme" ring THIS card, not the category. */}
						<GhostCard
							className={
								itemHit("appearance") ? "ring-2 ring-primary/40" : undefined
							}
						>
							<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
								<Icon name="palette" className="text-base" />
								{t("settings.appearance")}
							</h3>
							<div className="space-y-4">
								<div className="flex flex-wrap items-center justify-between gap-4">
									<div>
										<p className="font-label text-label-md text-on-surface">
											{t("settings.theme")}
										</p>
										<p className="font-body text-body-md text-on-surface-variant">
											{t("settings.themeHint")}
										</p>
									</div>
									<ThemeToggle />
								</div>
								<ThemePicker />
								{/* v1.8.0 — custom themes: import / export / edit / delete + AI flow */}
								<ThemeManager />
								<FontSection />
								{/* v1.8.1 — header icon labels (History / theme / bell). */}
								<HeaderLabelsToggle />
							</div>
						</GhostCard>

						{/* Welcome & Setup — re-open or skip the onboarding flow */}
						<div data-search-id="welcome" className={hit("welcome")}>
							<WelcomeSection />
						</div>

						{/* Launch behavior — start at login + hide to tray (v1.8.0) */}
						<div data-search-id="launch" className={hit("launch")}>
							<LaunchSection />
						</div>

						{/* v1.8.0 — auto-update: check GitHub releases, download & install */}
						<div data-search-id="updates" className={hit("updates")}>
							<UpdatesSection />
						</div>

						{/* v1.8.0 — notification center + OS notifications */}
						<div
							data-search-id="notifications"
							className={hit("notifications")}
						>
							<NotificationsSection />
						</div>

						{/* Language now lives on the Profile page. v1.8.1 — itemHit so
						    "translate"/"language" ring THIS card too. */}
						<GhostCard
							className={
								itemHit("language")
									? "flex items-center justify-between gap-4 ring-2 ring-primary/40"
									: "flex items-center justify-between gap-4"
							}
						>
							<div className="flex items-center gap-3">
								<Icon
									name="translate"
									className="text-[24px] text-on-surface-variant"
								/>
								<div>
									<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
										{t("settings.language")}
									</h3>
									<p className="font-body text-body-sm text-on-tertiary-container">
										{t("settings.languageMovedToProfile")}
									</p>
								</div>
							</div>
							<Button
								variant="secondary"
								size="sm"
								icon="account_circle"
								onClick={() => navigate("/profile")}
							>
								{t("nav.profile")}
							</Button>
						</GhostCard>

						{/* v1.8.1 — navigation: where the Archive sub-pages live. */}
						<div data-search-id="navigation2" className={hit("navigation2")}>
							<NavigationSection />
						</div>

						{/* v1.9.0 — story-card footer action order (drag to reorder).
						    v1.8.1 — Reader actions sits right below: the same
						    drag-reorder + in-More pattern for the Article/Insight
						    reader bar, so the related "actions" settings live together. */}
						<div data-search-id="briefActions" className={hit("briefActions")}>
							<BriefActionsSection />
						</div>
						<div
							data-search-id="readerActions"
							className={hit("readerActions")}
						>
							<ReaderActionsSection />
						</div>
						{/* v1.8.1 — the reading-experience settings moved here from the
						    Profile page so everything behavior-related lives in one
						    place: reader preferences, card click, and the confirmation
						    dialogs reset. */}
						<div
							data-search-id="readerSettings"
							className={hit("readerSettings")}
						>
							<ReaderSettingsSection />
						</div>
						<div data-search-id="cardClick" className={hit("cardClick")}>
							<CardClickSection />
						</div>
						<div
							data-search-id="confirmDialogs"
							className={hit("confirmDialogs")}
						>
							<ConfirmResetSection />
						</div>

						{/* Advanced — reveal the Plugins page (power-user gate, v1.8.0).
						    v1.8.1 — also the Developer section (network access), with a
						    separate "show the Plugins page" toggle next to it. */}
						<div data-search-id="advanced2" className={hit("advanced2")}>
							<AdvancedSection />
						</div>
						<div data-search-id="developer2" className={hit("developer2")}>
							<DeveloperSection />
						</div>
					</SettingsCategory>

					{/* ── Intelligence ─────────────────────────────────────────── */}
					<SettingsCategory
						id="settings-intelligence"
						title={cat("settings-intelligence")?.label ?? ""}
						icon={cat("settings-intelligence")?.icon}
						search={cat("settings-intelligence")?.search}
						highlighted={isHighlighted("settings-intelligence")}
						className={matches("settings-intelligence") ? undefined : "hidden"}
					>
						{/* LLM provider */}
						<LlmProviderSection
							configured={status?.llm.configured ?? false}
							providerKind={status?.llm.providerKind ?? null}
						/>

						{/* Usage — tokens + requests + live rate-limit state (from /llm/status) */}
						<UsageSection />

						{/* v1.8.0 — the brief summary's ORIGINAL version language */}
						<div
							data-search-id="summaryLanguage"
							className={hit("summaryLanguage")}
						>
							<SummaryLanguageSection />
						</div>

						{/* Regenerate all insights */}
						<GhostCard>
							<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-secondary">
								<Icon name="auto_awesome" className="text-base" />
								{t("settings.regenerateInsights")}
							</h3>
							<p className="mb-6 font-body text-body-md leading-relaxed text-on-surface-variant">
								{t("settings.regenerateInsightsHint")}
							</p>
							<RegenerateInsightsButton />
						</GhostCard>

						{/* Translate stories */}
						<GhostCard>
							<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-secondary">
								<Icon name="translate" className="text-base" />
								{t("settings.translateTitles")}
							</h3>
							<p className="mb-6 font-body text-body-md leading-relaxed text-on-surface-variant">
								{t("settings.translateTitlesHint")}
							</p>
							<TranslateStoriesButton />
						</GhostCard>
					</SettingsCategory>

					{/* ── Data & Health ────────────────────────────────────────── */}
					<SettingsCategory
						id="settings-data"
						title={cat("settings-data")?.label ?? ""}
						icon={cat("settings-data")?.icon}
						search={cat("settings-data")?.search}
						highlighted={isHighlighted("settings-data")}
						className={matches("settings-data") ? undefined : "hidden"}
					>
						{/* v1.6.0 — auto-delete retention */}
						<div data-search-id="retention" className={hit("retention")}>
							<RetentionSection />
						</div>

						{/* v1.7.0 — trash / soft-delete retention */}
						<div data-search-id="trash" className={hit("trash")}>
							<TrashSection />
						</div>

						{/* v1.8.0 — data health check: daily self-healing job */}
						<div data-search-id="dataHealth" className={hit("dataHealth")}>
							<DataHealthSection />
						</div>

						{/* Data ownership — backup / restore / delete-all */}
						<DataOwnershipSection />

						{/* Re-collect all sources (v1.1.0) */}
						<GhostCard>
							<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-warning">
								<Icon name="sync_problem" className="text-base" />
								{t("settings.recollect")}
							</h3>
							<p className="mb-6 font-body text-body-md leading-relaxed text-on-surface-variant">
								{t("settings.recollectHint")}
							</p>
							<ReCollectButton />
						</GhostCard>

						{/* History — what gets recorded into the History drawer */}
						<HistorySection />

						{/* Media — download disclaimer policy (v1.8.0) */}
						<div data-search-id="mediaWarn" className={hit("mediaWarn")}>
							<MediaSettingsSection />
						</div>

						{/* v1.8.0 — Storage & Usage: what's on disk + system usage */}
						<StorageSection />
					</SettingsCategory>

					{/* ── Sources ─────────────────────────────────────────────── */}
					<SettingsCategory
						id="settings-sources"
						title={cat("settings-sources")?.label ?? ""}
						icon={cat("settings-sources")?.icon}
						search={cat("settings-sources")?.search}
						highlighted={isHighlighted("settings-sources")}
						className={matches("settings-sources") ? undefined : "hidden"}
					>
						{/* v1.8.0 — source lists: hide 18+ lists from browsing */}
						<div
							data-search-id="sourceListsSettings"
							className={hit("sourceListsSettings")}
						>
							<SourceListsSection />
						</div>
					</SettingsCategory>

					{/* ── Plugins ─────────────────────────────────────────────── */}
					<SettingsCategory
						id="settings-plugins"
						title={cat("settings-plugins")?.label ?? ""}
						icon={cat("settings-plugins")?.icon}
						search={cat("settings-plugins")?.search}
						highlighted={isHighlighted("settings-plugins")}
						className={matches("settings-plugins") ? undefined : "hidden"}
					>
						{/* v1.9.0 — sections contributed by enabled runtime UI plugins */}
						<PluginSettingsSections />
					</SettingsCategory>

					{/* Tip: personalisation lives on the Profile page */}
					<GhostCard className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<Icon
								name="account_circle"
								className="text-[24px] text-on-surface-variant"
							/>
							<div>
								<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
									{t("settings.profileTipTitle")}
								</h3>
								<p className="font-body text-body-sm text-on-tertiary-container">
									{t("settings.profileTipBody")}
								</p>
							</div>
						</div>
						<Button
							variant="secondary"
							size="sm"
							icon="account_circle"
							onClick={() => navigate("/profile")}
						>
							{t("nav.profile")}
						</Button>
					</GhostCard>
				</div>
			</div>
		</section>
	);
}

function ModeSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: modeData } = useQuery({
		queryKey: ["llm-mode"],
		queryFn: fetchMode,
		staleTime: 15_000,
	});
	const mode = modeData?.mode ?? "news";

	const toggleMode = useMutation({
		mutationFn: (m: "intelligence" | "news") => setMode(m),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["engine-status"] });
			queryClient.invalidateQueries({ queryKey: ["llm-mode"] });
			queryClient.invalidateQueries({ queryKey: ["reports", "today"] });
		},
	});

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="psychology" className="text-base" />
				{t("settings.mode")}
			</h3>
			<Toggle
				icon={mode === "intelligence" ? "psychology" : "rss_feed"}
				label={
					mode === "intelligence"
						? t("settings.modeIntelligence")
						: t("settings.modeNews")
				}
				hint={
					mode === "intelligence"
						? t("settings.modeIntelligenceHint")
						: t("settings.modeHint")
				}
				checked={mode === "intelligence"}
				onChange={(v) => toggleMode.mutate(v ? "intelligence" : "news")}
			/>
		</GhostCard>
	);
}

function Stat({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: string;
	tone?: "default" | "primary" | "muted";
}) {
	return (
		<div className="border-s-2 border-s-outline-variant ps-3">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
				{label}
			</p>
			<p
				className={`mt-1 font-mono text-mono-technical ${
					tone === "primary"
						? "text-primary"
						: tone === "muted"
							? "text-on-tertiary-container"
							: "text-on-surface"
				}`}
			>
				{value}
			</p>
		</div>
	);
}

const PROVIDER_OPTIONS: {
	kind: LlmProviderKind;
	icon: string;
	label: string;
	modelHint: string;
	needsKey: boolean;
	/**
	 * Render the Base URL field. v1.8.1: OpenAI (self-hosted /
	 * OpenAI-compatible endpoints) and Ollama (local/cloud hosts) both let the
	 * user point at a different server; Gemini/Anthropic keep their official
	 * endpoint only.
	 */
	showBaseUrl: boolean;
	/** Placeholder for the Base URL field (falls back to `provider.baseUrlPlaceholder`). */
	baseUrlPlaceholder?: string;
}[] = [
	{
		kind: "gemini",
		icon: "auto_awesome",
		label: "Gemini",
		modelHint: "gemini-2.0-flash",
		needsKey: true,
		showBaseUrl: false,
	},
	{
		kind: "openai",
		icon: "cyclone",
		label: "OpenAI",
		modelHint: "gpt-4o-mini",
		needsKey: true,
		showBaseUrl: true,
		baseUrlPlaceholder: "https://api.openai.com/v1",
	},
	{
		kind: "anthropic",
		icon: "psychology",
		label: "Anthropic",
		modelHint: "claude-3-5-sonnet-latest",
		needsKey: true,
		showBaseUrl: false,
	},
	{
		// v1.8.1 — "Ollama (local)" became a Local/Cloud choice in the form.
		kind: "ollama",
		icon: "terminal",
		label: "Ollama",
		modelHint: "llama3.2",
		needsKey: false,
		showBaseUrl: true,
		baseUrlPlaceholder: "http://localhost:11434",
	},
];

/** v1.9.0 — per-provider model docs: the label prefix comes from i18n, the
 *  link text is the docs host/path (a URL — kept literal in all languages). */
const PROVIDER_DOCS: Record<
	LlmProviderKind,
	{ href: string; linkText: string; docKey: string }
> = {
	gemini: {
		href: "https://ai.google.dev/gemini-api/docs/models",
		linkText: "ai.google.dev/gemini-api/docs/models",
		docKey: "provider.geminiDocs",
	},
	openai: {
		href: "https://developers.openai.com/api/docs/models",
		linkText: "developers.openai.com/api/docs/models",
		docKey: "provider.openaiDocs",
	},
	anthropic: {
		href: "https://platform.claude.com/docs/en/home",
		linkText: "platform.claude.com/docs/en/home",
		docKey: "provider.anthropicDocs",
	},
	ollama: {
		href: "https://docs.ollama.com/index",
		linkText: "docs.ollama.com/index",
		docKey: "provider.ollamaDocs",
	},
};

function LlmProviderSection({
	configured,
	providerKind,
}: {
	configured: boolean;
	providerKind: string | null;
}) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: providers = [] } = useQuery({
		queryKey: ["llm-providers"],
		queryFn: fetchProviders,
	});
	const { data: modeData } = useQuery({
		queryKey: ["llm-mode"],
		queryFn: fetchMode,
	});
	const [showForm, setShowForm] = useState(false);
	const [kind, setKind] = useState<LlmProviderKind>("gemini");
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	// v1.9.0 — the model name is required; an empty-model Save shows this inline.
	const [modelError, setModelError] = useState<string | null>(null);
	// v1.8.1 — Ollama runs either locally (no key) or on Ollama Cloud (key).
	const [ollamaMode, setOllamaMode] = useState<"local" | "cloud">("local");

	// v1.8.1 — switching provider kind clears stale key/URL state so a key
	// typed for OpenAI never leaks into an Ollama (or vice-versa) row.
	useEffect(() => {
		setBaseUrl("");
		setApiKey("");
		setOllamaMode("local");
		setModelError(null);
	}, [kind]);

	const mode = modeData?.mode ?? "news";

	const { data: appSettings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		staleTime: 15_000,
	});
	const confirmDeleteEnabled =
		(appSettings?.["ui.confirmDeleteProvider"] as boolean | undefined) ?? true;

	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [dontShowAgain, setDontShowAgain] = useState(false);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["llm-providers"] });
		queryClient.invalidateQueries({ queryKey: ["engine-status"] });
		queryClient.invalidateQueries({ queryKey: ["reports", "today"] });
		queryClient.invalidateQueries({ queryKey: ["llm-mode"] });
	};

	const save = useMutation({
		mutationFn: () => {
			const isOllama = kind === "ollama";
			const isCloud = isOllama && ollamaMode === "cloud";
			// v1.8.1 — Ollama: local stores no key and defaults to the local
			// server; cloud carries a bearer key and defaults to ollama.com.
			const effectiveApiKey = isOllama
				? isCloud
					? apiKey.trim() || undefined
					: undefined
				: apiKey.trim() || undefined;
			const effectiveBaseUrl = isOllama
				? baseUrl.trim() ||
					(isCloud ? "https://ollama.com" : "http://localhost:11434")
				: baseUrl.trim() || undefined;
			return saveProvider({
				kind,
				label:
					label ||
					(PROVIDER_OPTIONS.find((p) => p.kind === kind)?.label ?? kind),
				apiKey: effectiveApiKey,
				defaultModel: model || undefined,
				baseUrl: effectiveBaseUrl,
				enabled: true,
			});
		},
		onSuccess: () => {
			invalidate();
			setShowForm(false);
			setApiKey("");
			setLabel("");
		},
	});
	const remove = useMutation({
		mutationFn: async (id: string) => {
			if (dontShowAgain) {
				await patchSettings({ "ui.confirmDeleteProvider": false });
			}
			return deleteProvider(id);
		},
		onSuccess: () => {
			invalidate();
			setConfirmDeleteId(null);
			setDontShowAgain(false);
		},
		onError: (err) => {
			console.error("delete provider error:", err);
		},
	});
	const verify = useMutation({
		mutationFn: verifyLlm,
		onSuccess: () => invalidate(),
	});
	const activate = useMutation({
		mutationFn: (id: string) => activateProvider(id),
		onSuccess: invalidate,
	});

	const activeOption = PROVIDER_OPTIONS.find((p) => p.kind === kind);

	// Surface the latest verify result so the user sees a real success/fail.
	const verifyState: "idle" | "verifying" | "ok" | "fail" = verify.isPending
		? "verifying"
		: verify.isSuccess
			? verify.data?.ok
				? "ok"
				: "fail"
			: verify.isError
				? "fail"
				: "idle";

	// Determine which provider is likely the active one (the one used by the engine).
	const activeProviderId: string | null =
		providers.length > 0
			? (providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? null)
			: null;

	// Human label for a provider's stored-key state (Settings provider list).
	const keyStatusLabel = (p: ProviderRow): string => {
		if (p.keyStatus === "undecryptable") return t("provider.keyUndecryptable");
		if (p.keyStatus === "missing") return t("provider.noKey");
		return t("provider.keyStored");
	};

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="psychology" className="text-base" />
				{t("settings.intelligence")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				Optional. Without a provider, Vorynth stays in news mode — collected
				stories ranked by freshness and source reliability. Add a key to
				generate the intelligence triad.
			</p>

			{/* Status banner + connection test */}
			{configured ? (
				<div className="mb-4 flex flex-wrap items-center gap-3 border-s-2 border-s-secondary bg-surface-container-low px-4 py-3 rounded">
					<Icon name="check_circle" className="text-secondary" />
					<span className="font-label text-label-md text-on-surface">
						{providerKind} active
					</span>
					<Button
						variant="ghost"
						size="sm"
						icon="sync"
						onClick={() => verify.mutate()}
						disabled={verify.isPending}
					>
						{verify.isPending ? "Verifying…" : "Verify"}
					</Button>
					{verifyState === "ok" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
							<Icon name="task_alt" className="text-[14px]" /> Reachable
						</span>
					) : null}
					{verifyState === "fail" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-error">
							<Icon name="error" className="text-[14px]" /> Unreachable — check
							key/network
						</span>
					) : null}
				</div>
			) : providers.length > 0 ? (
				// Providers exist but none is configured/decryptable — show verify option.
				<div className="mb-4 flex flex-wrap items-center gap-3 border-s-2 border-s-outline-variant bg-surface-container-low px-4 py-3 rounded">
					<Icon
						name="radio_button_unchecked"
						className="text-on-tertiary-container"
					/>
					<span className="font-label text-label-md text-on-surface-variant">
						No provider reachable
					</span>
					<Button
						variant="ghost"
						size="sm"
						icon="sync"
						onClick={() => verify.mutate()}
						disabled={verify.isPending}
					>
						{verify.isPending ? "Verifying…" : "Test Connection"}
					</Button>
					{verifyState === "ok" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
							<Icon name="task_alt" className="text-[14px]" /> Reachable
						</span>
					) : null}
					{verifyState === "fail" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-error">
							<Icon name="error" className="text-[14px]" /> Unreachable — check
							key/network
						</span>
					) : null}
				</div>
			) : (
				<div className="mb-4 flex flex-wrap items-center gap-3 border-s-2 border-s-outline-variant bg-surface-container-low px-4 py-3 rounded">
					<Icon
						name="radio_button_unchecked"
						className="text-on-tertiary-container"
					/>
					<span className="font-label text-label-md text-on-surface-variant">
						News mode — no LLM reachable
					</span>
					<Button
						variant="ghost"
						size="sm"
						icon="sync"
						onClick={() => verify.mutate()}
						disabled={verify.isPending}
					>
						{verify.isPending ? "Verifying…" : "Test Connection"}
					</Button>
					{verifyState === "ok" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
							<Icon name="task_alt" className="text-[14px]" /> Reachable
						</span>
					) : null}
					{verifyState === "fail" ? (
						<span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-error">
							<Icon name="error" className="text-[14px]" /> Unreachable — check
							key/network
						</span>
					) : null}
				</div>
			)}

			{/* Tip: when mode is "intelligence" but no provider is configured */}
			{mode === "intelligence" && providers.length === 0 ? (
				<div className="mb-4 flex items-center gap-3 border-s-2 border-s-warning bg-surface-container-low px-4 py-3 rounded">
					<Icon name="warning" className="text-warning" />
					<p className="font-body text-body-sm text-on-surface-variant">
						<strong className="text-on-surface">
							Intelligence mode is on,
						</strong>{" "}
						but no provider is configured. Add a provider below or switch to
						News mode.
					</p>
				</div>
			) : null}

			{/* Configured providers list */}
			{providers.length > 0 ? (
				<div className="mb-4 space-y-2">
					{providers.map((p: ProviderRow) => {
						const isActive = activeProviderId === p.id;
						return (
							<div
								key={p.id}
								className={`flex items-center gap-3 border px-4 py-3 rounded ${
									isActive
										? "border-secondary bg-surface-container-low"
										: "border-outline-variant"
								}`}
							>
								<Icon
									name={
										PROVIDER_OPTIONS.find((o) => o.kind === p.kind)?.icon ??
										"api"
									}
									className={
										isActive ? "text-secondary" : "text-on-surface-variant"
									}
								/>
								<div className="flex-1">
									<p className="font-label text-label-md text-on-surface">
										{p.label}
									</p>
									<p
										className={`font-mono text-[11px] ${
											p.keyStatus === "undecryptable"
												? "text-error"
												: "text-on-tertiary-container"
										}`}
									>
										{p.kind} · {keyStatusLabel(p)} ·{" "}
										{p.defaultModel ?? "default model"}
									</p>
									{p.keyStatus === "undecryptable" ? (
										<p className="mt-1.5 flex items-start gap-1.5 font-body text-body-sm text-error">
											<Icon
												name="error_outline"
												className="mt-0.5 shrink-0 text-[14px]"
											/>
											{t("provider.undecryptableHint")}
										</p>
									) : null}
								</div>
								{isActive ? (
									<DomainTag>{t("provider.active")}</DomainTag>
								) : (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => activate.mutate(p.id)}
										disabled={activate.isPending}
									>
										{t("provider.setActive")}
									</Button>
								)}
								<button
									onClick={() => {
										if (confirmDeleteEnabled) {
											setConfirmDeleteId(p.id);
										} else {
											remove.mutate(p.id);
										}
									}}
									className="p-2 text-on-surface-variant hover:text-error"
									aria-label={t("provider.removeAria")}
								>
									<Icon name="delete" className="text-[18px]" />
								</button>
							</div>
						);
					})}
				</div>
			) : null}

			{/* Confirmation dialog before deleting a provider */}
			{confirmDeleteId ? (
				<div className="mb-4 border border-error/30 bg-error/5 px-5 py-4 rounded">
					<div className="flex items-start gap-3">
						<Icon name="warning" className="mt-0.5 text-[18px] text-error" />
						<div className="flex-1">
							<p className="font-label text-label-md text-on-surface mb-1">
								Remove provider?
							</p>
							<p className="font-body text-body-sm text-on-surface-variant mb-3">
								The provider configuration and encrypted key will be permanently
								deleted. This cannot be undone.
							</p>
							<label className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant mb-4 cursor-pointer">
								<input
									type="checkbox"
									checked={dontShowAgain}
									onChange={(e) => setDontShowAgain(e.target.checked)}
									className="h-4 w-4 accent-primary"
								/>
								Don't ask again
							</label>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setConfirmDeleteId(null);
										setDontShowAgain(false);
									}}
								>
									Cancel
								</Button>
								<Button
									variant="secondary"
									size="sm"
									icon="delete"
									onClick={() => remove.mutate(confirmDeleteId)}
									disabled={remove.isPending}
								>
									{remove.isPending ? "Deleting…" : "Delete"}
								</Button>
							</div>
						</div>
					</div>
				</div>
			) : null}

			{/* Inline form */}
			{showForm ? (
				<div className="space-y-4 border-s-2 border-s-primary bg-surface-container-low p-4 rounded">
					<div>
						<label className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
							Provider
						</label>
						<div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
							{PROVIDER_OPTIONS.map((p) => (
								<button
									key={p.kind}
									onClick={() => setKind(p.kind)}
									className={`flex flex-col items-center gap-1 border p-3 transition-all ${
										kind === p.kind
											? "border-primary bg-surface-container-lowest"
											: "border-outline-variant hover:border-primary"
									}`}
								>
									<Icon
										name={p.icon}
										className={
											kind === p.kind
												? "text-primary"
												: "text-on-tertiary-container"
										}
									/>
									<span className="font-label text-label-sm">{p.label}</span>
								</button>
							))}
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								{t("provider.label")}
							</label>
							<Input
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder={t("provider.labelPlaceholder")}
							/>
						</div>
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								{t("provider.model")}
							</label>
							<Input
								value={model}
								onChange={(e) => {
									setModel(e.target.value);
									setModelError(null);
								}}
								// v1.8.1 — an EXAMPLE, not a preselected value: the user
								// types the model name (required).
								placeholder={`e.g. ${activeOption?.modelHint ?? ""}`}
								aria-invalid={modelError !== null}
							/>
							{modelError ? (
								<p className="mt-1 font-body text-body-sm text-error">
									{modelError}
								</p>
							) : null}
						</div>
					</div>

					{/* v1.8.1 — Ollama has two modes (docs.ollama.com/cloud):
					    local (no key, your own server) and cloud (bearer key,
					    ollama.com). The key field appears only for cloud. */}
					{kind === "ollama" ? (
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								{t("provider.ollamaMode")}
							</label>
							<div className="mt-2 grid grid-cols-2 gap-2">
								<button
									type="button"
									aria-pressed={ollamaMode === "local"}
									onClick={() => setOllamaMode("local")}
									className={`flex items-center justify-center gap-2 border p-2.5 font-label text-label-sm transition-all ${
										ollamaMode === "local"
											? "border-primary bg-surface-container-lowest"
											: "border-outline-variant hover:border-primary"
									}`}
								>
									<Icon
										name="memory"
										className={
											ollamaMode === "local"
												? "text-primary"
												: "text-on-tertiary-container"
										}
									/>
									{t("provider.ollamaLocal")}
								</button>
								<button
									type="button"
									aria-pressed={ollamaMode === "cloud"}
									onClick={() => setOllamaMode("cloud")}
									className={`flex items-center justify-center gap-2 border p-2.5 font-label text-label-sm transition-all ${
										ollamaMode === "cloud"
											? "border-primary bg-surface-container-lowest"
											: "border-outline-variant hover:border-primary"
									}`}
								>
									<Icon
										name="cloud"
										className={
											ollamaMode === "cloud"
												? "text-primary"
												: "text-on-tertiary-container"
										}
									/>
									{t("provider.ollamaCloud")}
								</button>
							</div>
							<p className="mt-2 font-body text-body-sm text-on-surface-variant">
								{ollamaMode === "cloud"
									? t("provider.ollamaCloudHint")
									: t("provider.ollamaLocalHint")}
							</p>
						</div>
					) : null}

					{activeOption?.needsKey ||
					(kind === "ollama" && ollamaMode === "cloud") ? (
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								{t("provider.apiKey")}
							</label>
							<Input
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder={t("provider.apiKeyPlaceholder")}
								icon="lock"
							/>
						</div>
					) : null}

					{activeOption?.showBaseUrl ? (
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								{t("provider.baseUrl")}
							</label>
							<Input
								value={baseUrl}
								onChange={(e) => setBaseUrl(e.target.value)}
								placeholder={
									kind === "ollama" && ollamaMode === "cloud"
										? "https://ollama.com"
										: (activeOption?.baseUrlPlaceholder ??
											t("provider.baseUrlPlaceholder"))
								}
								icon="link"
							/>
							{/* v1.8.1 — official-API default is implicit, say so. */}
							{kind === "openai" ? (
								<p className="mt-1 font-body text-body-sm text-on-surface-variant">
									{t("provider.openaiBaseUrlHint")}
								</p>
							) : null}
						</div>
					) : null}

					{/* v1.9.0 — per-provider model docs + tips so the required model
						    id can be looked up. */}
					<div className="space-y-1 border-s-2 border-s-outline-variant ps-3">
						<p className="flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
							<Icon
								name="tips_and_updates"
								className="mt-0.5 shrink-0 text-[14px]"
							/>
							<span>
								{t(PROVIDER_DOCS[kind].docKey)}{" "}
								<a
									href={PROVIDER_DOCS[kind].href}
									target="_blank"
									rel="noreferrer"
									className="text-secondary transition-colors hover:text-primary hover:underline"
								>
									{PROVIDER_DOCS[kind].linkText}
								</a>
							</span>
						</p>
						{kind === "gemini" ? (
							<p className="flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
								<Icon
									name="tips_and_updates"
									className="mt-0.5 shrink-0 text-[14px]"
								/>
								<span>{t("provider.geminiFreeTip")}</span>
							</p>
						) : null}
						{kind === "ollama" ? (
							<p className="flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
								<Icon
									name="tips_and_updates"
									className="mt-0.5 shrink-0 text-[14px]"
								/>
								<span>{t("provider.ollamaHostTip")}</span>
							</p>
						) : null}
					</div>

					{save.error ? (
						<p className="font-mono text-mono-technical text-error">
							{save.error.message}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowForm(false)}
						>
							{t("provider.cancel")}
						</Button>
						<Button
							size="sm"
							icon="check"
							onClick={() => {
								// v1.9.0 — the model name is REQUIRED (the provider
								// default is no longer inferred). Block the save and
								// explain inline instead of silently saving a keyless
								// half-configuration.
								if (!model.trim()) {
									setModelError(t("provider.modelRequired"));
									return;
								}
								setModelError(null);
								save.mutate();
							}}
							disabled={save.isPending}
						>
							{save.isPending ? t("provider.saving") : t("provider.save")}
						</Button>
					</div>
				</div>
			) : (
				<Button
					variant="secondary"
					size="sm"
					icon="add"
					onClick={() => setShowForm(true)}
				>
					{t("settings.addProvider")}
				</Button>
			)}

			<p className="mt-4 font-mono text-[11px] text-on-tertiary-container">
				Keys are encrypted at rest (AES-256-GCM, machine-bound). The engine
				never logs or transmits them outside the provider's own API.
			</p>
		</GhostCard>
	);
}

// ── Re-collect button (v1.1.0) ─────────────────────────────────────────────

/**
 * Standalone button for the "Re-collect all sources" card. Disabled while any
 * collect job (including a normal collect) is already running. Shows a
 * confirmation dialog with the i18n warning before firing.
 */
function ReCollectButton() {
	const { t } = useTranslation();
	const isActive = useJobsStore((s) => s.isActive("collect"));
	const startForceCollect = useJobsStore((s) => s.startForceCollect);
	const [showConfirm, setShowConfirm] = useState(false);

	if (isActive) {
		return (
			<div className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
				<Icon name="sync" className="animate-spin-reverse text-[16px]" />
				{t("settings.recollectBusy")}
			</div>
		);
	}

	return (
		<>
			<Button
				variant="secondary"
				icon="sync_problem"
				onClick={() => setShowConfirm(true)}
			>
				{t("settings.recollectButton")}
			</Button>
			<ConfirmDialog
				open={showConfirm}
				title={t("settings.recollectButton")}
				message={t("settings.recollectConfirm")}
				confirmLabel={t("settings.recollectButton")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setShowConfirm(false);
					void startForceCollect();
				}}
				onCancel={() => setShowConfirm(false)}
				icon="sync_problem"
				danger={false}
			/>
		</>
	);
}

/** Button for the "Regenerate All Insights" card. */
function RegenerateInsightsButton() {
	const { t } = useTranslation();
	const isActive = useJobsStore((s) => s.isActive("regenerate"));
	const startJob = useJobsStore((s) => s.startRegenerateInsights);
	const [showConfirm, setShowConfirm] = useState(false);
	const jobError = useFinishedJobError();

	if (isActive) {
		return (
			<div className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
				<Icon name="sync" className="animate-spin-reverse text-[16px]" />
				{t("settings.regenerateInsightsBusy")}
			</div>
		);
	}

	return (
		<>
			<Button
				variant="secondary"
				icon="auto_awesome"
				onClick={() => setShowConfirm(true)}
			>
				{t("settings.regenerateInsightsButton")}
			</Button>
			<ConfirmDialog
				open={showConfirm}
				title={t("settings.regenerateInsightsButton")}
				message={t("settings.regenerateInsightsConfirm")}
				confirmLabel={t("settings.regenerateInsightsButton")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setShowConfirm(false);
					void startJob().then((job) => jobError.track(job?.id ?? null));
				}}
				onCancel={() => setShowConfirm(false)}
				icon="auto_awesome"
				danger={false}
			/>
			{jobError.error ? (
				<p className="mt-2 font-body text-body-sm text-error">
					{aiErrorMessage(t, jobError.error, "article.generateInsightFailed")}
				</p>
			) : null}
		</>
	);
}

/** Button for the "Translate Stories" card. */
function TranslateStoriesButton() {
	const { t } = useTranslation();
	const isActive = useJobsStore((s) => s.isActive("translate"));
	const startJob = useJobsStore((s) => s.startTranslateStories);
	const [showConfirm, setShowConfirm] = useState(false);
	const jobError = useFinishedJobError();

	if (isActive) {
		return (
			<div className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
				<Icon name="sync" className="animate-spin-reverse text-[16px]" />
				{t("settings.translateTitlesBusy")}
			</div>
		);
	}

	return (
		<>
			<Button
				variant="secondary"
				icon="translate"
				onClick={() => setShowConfirm(true)}
			>
				{t("settings.translateTitlesButton")}
			</Button>
			<ConfirmDialog
				open={showConfirm}
				title={t("settings.translateTitlesButton")}
				message={t("settings.translateTitlesConfirm")}
				confirmLabel={t("settings.translateTitlesButton")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setShowConfirm(false);
					// v1.8.0 — re-translate EVERYTHING into the current language:
					// stories already translated into an older language get
					// rewritten from their original (title + body + insight), not
					// just the never-translated backlog.
					void startJob({ retranslateAll: true }).then((job) =>
						jobError.track(job?.id ?? null),
					);
				}}
				onCancel={() => setShowConfirm(false)}
				icon="translate"
				danger={false}
			/>
			{jobError.error ? (
				<p className="mt-2 font-body text-body-sm text-error">
					{aiErrorMessage(t, jobError.error, "article.translateFailed")}
				</p>
			) : null}
		</>
	);
}

/**
 * Theme picker (v1.8.0) — lists built-in Light/Dark plus any plugin themes.
 * Selecting one applies it immediately and persists it. Subscribes to the
 * theme registry version so a theme registered after mount appears.
 */
function ThemePicker() {
	const { t } = useTranslation();
	const theme = useThemeStore((s) => s.theme);
	const setTheme = useThemeStore((s) => s.setTheme);
	// Re-render when a plugin theme registers (load happens at startup, but
	// Settings may be open before the bundle resolves).
	useThemeStore((s) => s.registryVersion);
	const themes = availableThemes();

	return (
		<div className="flex flex-wrap gap-2">
			{themes.map((th) => (
				<button
					key={th.id}
					type="button"
					aria-pressed={theme === th.id}
					aria-label={`${t("settings.theme")}: ${th.name}`}
					onClick={() => setTheme(th.id)}
					className={`inline-flex items-center gap-1.5 rounded border px-3 py-1 font-label text-label-sm uppercase tracking-wide transition-colors ${
						theme === th.id
							? "border-primary bg-primary text-on-primary"
							: "border-outline-variant text-on-surface-variant hover:border-primary"
					}`}
				>
					{th.icon ? <Icon name={th.icon} className="text-[16px]" /> : null}
					{th.name}
				</button>
			))}
		</div>
	);
}

/**
 * v1.8.1 — "Show icon labels in the header" (History / theme / bell text next
 * to the top-bar icons). Self-contained: reads + patches its own setting.
 */
function HeaderLabelsToggle() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const patch = useMutation({
		mutationFn: (on: boolean) => patchSettings({ "ui.showHeaderLabels": on }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});
	return (
		<Toggle
			icon="label"
			label={t("settings.showHeaderLabels")}
			hint={t("settings.showHeaderLabelsHint")}
			checked={settings?.["ui.showHeaderLabels"] !== false}
			onChange={(on) => patch.mutate(on)}
		/>
	);
}

/**
 * v1.8.1 — where the Archive sub-pages live: an expandable sidebar submenu
 * ("sidebar", default) or the in-page tab row on the Archive page ("inpage").
 */
function NavigationSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const patch = useMutation({
		mutationFn: (mode: "sidebar" | "inpage") =>
			patchSettings({ "ui.archiveNavMode": mode }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});
	const mode = settings?.["ui.archiveNavMode"] ?? "sidebar";
	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="navigation" className="text-base" />
				{t("settings.navigationTitle")}
			</h3>
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					aria-pressed={mode === "sidebar"}
					onClick={() => patch.mutate("sidebar")}
					className={`flex flex-col items-center gap-1 border p-3 transition-all ${
						mode === "sidebar"
							? "border-primary bg-surface-container-lowest"
							: "border-outline-variant hover:border-primary"
					}`}
				>
					<Icon
						name="menu"
						className={
							mode === "sidebar" ? "text-primary" : "text-on-tertiary-container"
						}
					/>
					<span className="font-label text-label-sm">
						{t("settings.navSidebar")}
					</span>
				</button>
				<button
					type="button"
					aria-pressed={mode === "inpage"}
					onClick={() => patch.mutate("inpage")}
					className={`flex flex-col items-center gap-1 border p-3 transition-all ${
						mode === "inpage"
							? "border-primary bg-surface-container-lowest"
							: "border-outline-variant hover:border-primary"
					}`}
				>
					<Icon
						name="view_list"
						className={
							mode === "inpage" ? "text-primary" : "text-on-tertiary-container"
						}
					/>
					<span className="font-label text-label-sm">
						{t("settings.navInpage")}
					</span>
				</button>
			</div>
			<p className="mt-2 font-body text-body-sm text-on-surface-variant">
				{t("settings.navigationHint")}
			</p>
		</GhostCard>
	);
}
