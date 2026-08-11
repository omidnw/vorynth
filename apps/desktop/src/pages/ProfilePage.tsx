import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchProfile,
	patchProfile,
	generateSummary,
	improveInstruction,
} from "@/features/profile/profile-api";
import {
	fetchSearchHistory,
	fetchBriefHistory,
} from "@/features/history/history-api";
import { LanguageSection } from "@/components/shell/LanguageSection";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { SettingsCategory } from "@/components/settings/SettingsCategory.js";
import {
	CategoryRail,
	CategoryChips,
} from "@/components/settings/CategoryRail.js";
import { SettingsSearch } from "@/components/settings/SettingsSearch.js";
import { useCategorySearch } from "@/components/settings/useCategorySearch.js";
import { CrossPageHint } from "@/features/settings/CrossPageHint.js";
import { findCrossPageTopic } from "@/features/settings/cross-page-search.js";
import { useSectionHighlight } from "@/features/settings/use-section-highlight.js";
import { useTranslation } from "react-i18next";
import { useTextDirection } from "@/i18n";
import { aiErrorMessage } from "@/features/llm/ai-error.js";
import ISO6391 from "iso-639-1";

/**
 * Profile page (v1.1.0).
 *
 * The user's identity, custom instruction, AI-generated behavior summary,
 * read-only derived interests, language settings (moved here from Settings),
 * and reader preferences (the toggles the support-author modal points at).
 *
 * Composed of self-contained sections — mirrors the SettingsPage pattern.
 */
export function ProfilePage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: profile, isLoading } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});

	const categories = useMemo(
		() => [
			{
				id: "profile-identity",
				label: t("profile.categoryIdentity"),
				icon: "person",
				// v1.8.0 — the keyword blob is localized: it follows the selected
				// UI language, so typing in Persian/French/… matches too.
				search: t("profile.searchIdentity"),
			},
			{
				id: "profile-ai",
				label: t("profile.categoryAi"),
				icon: "auto_awesome",
				search: t("profile.searchAi"),
			},
			{
				id: "profile-languages",
				label: t("profile.categoryLanguages"),
				icon: "translate",
				search: t("profile.searchLanguages"),
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
		focusFirstMatch,
	} = useCategorySearch(categories);
	/** v1.8.0 — deep-linked `?section=` from the cross-page search hint. */
	const highlightFromLink = useSectionHighlight();
	const crossTopic = findCrossPageTopic(query, "/profile", t);
	const isHighlighted = (id: string) =>
		highlightedIds.includes(id) || highlightFromLink === id;

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

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
				<p className="font-body text-body-md text-on-surface-variant">
					{t("profile.loading")}
				</p>
			</section>
		);
	}
	if (!profile) return null;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-2">
				<div className="flex flex-wrap items-start justify-between gap-4">
					{/* v1.8.1 — same title size as the Settings page header. */}
					<h1 className="mb-2 flex items-center gap-3 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						<Icon name="account_circle" className="text-[28px]" />
						{t("profile.title")}
					</h1>
					<DocsHelpButton sectionId="profile" />
				</div>
				<p className="max-w-prose font-body text-body-md text-on-surface-variant">
					{t("profile.subtitle")}
				</p>
			</header>

			<div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
				{/* Category rail — sticky navigation, shown on lg+ screens */}
				<CategoryRail
					className="hidden lg:block"
					items={navItems}
					activeId={activeId}
					onSelect={select}
					dimmedIds={dimmedIds}
					ariaLabel={t("profile.title")}
				/>
				{/* Category chips — narrow screens, below lg */}
				<CategoryChips
					className="lg:hidden"
					items={navItems}
					activeId={activeId}
					onSelect={select}
					dimmedIds={dimmedIds}
					ariaLabel={t("profile.title")}
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

					{/* v1.8.0 — "this setting lives in Settings" hint */}
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

					{/* ── Who you are ─────────────────────────────────────────── */}
					<SettingsCategory
						id="profile-identity"
						title={cat("profile-identity")?.label ?? ""}
						icon={cat("profile-identity")?.icon}
						search={cat("profile-identity")?.search}
						highlighted={isHighlighted("profile-identity")}
						className={matches("profile-identity") ? undefined : "hidden"}
					>
						<IdentitySection />
						<BehaviorSummarySection
							summary={profile.behaviorSummary}
							generatedAt={profile.summaryGeneratedAt}
						/>
						<InterestsSection />
					</SettingsCategory>

					{/* ── How the AI writes ───────────────────────────────────── */}
					<SettingsCategory
						id="profile-ai"
						title={cat("profile-ai")?.label ?? ""}
						icon={cat("profile-ai")?.icon}
						search={cat("profile-ai")?.search}
						highlighted={isHighlighted("profile-ai")}
						className={matches("profile-ai") ? undefined : "hidden"}
					>
						<CustomInstructionSection
							customInstruction={profile.customInstruction}
						/>
						<AiLanguageSection />
					</SettingsCategory>

					{/* ── Languages ───────────────────────────────────────────── */}
					<SettingsCategory
						id="profile-languages"
						title={cat("profile-languages")?.label ?? ""}
						icon={cat("profile-languages")?.icon}
						search={cat("profile-languages")?.search}
						highlighted={isHighlighted("profile-languages")}
						className={matches("profile-languages") ? undefined : "hidden"}
					>
						<LanguageSection
							onLocaleChange={(code) =>
								patchProfile({ preferredUiLanguage: code })
							}
						/>
					</SettingsCategory>

					{/* v1.8.1 — Reading preferences (reader settings, card click,
					    confirmation dialogs) moved to Settings → General so Profile
					    stays purely about the person. */}
					{/* Tip: app settings live on the Settings page */}
					<GhostCard className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<Icon
								name="settings"
								className="text-[24px] text-on-surface-variant"
							/>
							<div>
								<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
									{t("profile.settingsTipTitle")}
								</h3>
								<p className="font-body text-body-sm text-on-tertiary-container">
									{t("profile.settingsTipBody")}
								</p>
							</div>
						</div>
						<Button
							variant="secondary"
							size="sm"
							icon="settings"
							onClick={() => navigate("/settings")}
						>
							{t("nav.settings")}
						</Button>
					</GhostCard>
				</div>
			</div>
		</section>
	);
}

// ── Identity ────────────────────────────────────────────────────────────────

/** Degree-level slugs (v1.9.0) — stable values, localized labels. */
const DEGREE_LEVELS = [
	"high-school",
	"associate",
	"bachelor",
	"master",
	"phd",
	"other",
] as const;

/** Experience-level slugs (v1.9.0) — stable values, localized labels. */
const EXPERIENCE_LEVELS = [
	"beginner",
	"intermediate",
	"advanced",
	"expert",
] as const;

function IdentitySection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [alias, setAlias] = useState("");

	// Education + experience (v1.9.0) — collected for the future
	// source/category/tag suggestion feature.
	const [fieldOfStudy, setFieldOfStudy] = useState("");
	const [degreeLevel, setDegreeLevel] = useState("");
	const [experienceLevel, setExperienceLevel] = useState("");

	// Sync local form state when the profile loads (only for initial load, not
	// after every save — the mutation onSuccess handles the UI feedback).
	useEffect(() => {
		if (profile) {
			setFirstName(profile.firstName ?? "");
			setLastName(profile.lastName ?? "");
			setAlias(profile.alias ?? "");
			setFieldOfStudy(profile.fieldOfStudy ?? "");
			setDegreeLevel(profile.degreeLevel ?? "");
			setExperienceLevel(profile.experienceLevel ?? "");
		}
	}, [
		profile?.firstName,
		profile?.lastName,
		profile?.alias,
		profile?.fieldOfStudy,
		profile?.degreeLevel,
		profile?.experienceLevel,
	]);

	const save = useMutation({
		mutationFn: () =>
			patchProfile({
				firstName: firstName.trim() || null,
				lastName: lastName.trim() || null,
				alias: alias.trim() || null,
				fieldOfStudy: fieldOfStudy.trim() || null,
				degreeLevel: degreeLevel || null,
				experienceLevel: experienceLevel || null,
			}),
		onSuccess: () => {
			// Wait for the refetch before clearing the pending state so the
			// user sees the updated form immediately.
			queryClient.invalidateQueries({ queryKey: ["profile"] });
		},
	});

	const displayName =
		alias?.trim() ||
		[firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
		t("profile.localUser");

	return (
		<GhostCard>
			<h2 className="mb-6 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="person" className="text-[24px]" />
				{t("profile.identity")}
			</h2>

			<div className="mb-6 flex items-center gap-4">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container font-headline text-headline-md text-on-primary-container">
					{initials(displayName)}
				</div>
				<div>
					<p className="font-headline text-headline-sm text-on-surface">
						{displayName}
					</p>
					<p className="font-label text-label-sm text-on-surface-variant">
						{t("profile.localEngine")}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Field label={t("profile.firstName")}>
					<Input
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
						placeholder={t("profile.firstNamePlaceholder")}
					/>
				</Field>
				<Field label={t("profile.lastName")}>
					<Input
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
						placeholder={t("profile.lastNamePlaceholder")}
					/>
				</Field>
				<Field label={t("profile.alias")}>
					<Input
						value={alias}
						onChange={(e) => setAlias(e.target.value)}
						placeholder={t("profile.aliasPlaceholder")}
						icon="alternate_email"
					/>
				</Field>
			</div>

			{/* Education & experience (v1.9.0) — collected today; a future
			    feature will suggest sources, categories, and tags matched to
			    them. Everything stays accessible. */}
			<div className="mt-6 rounded border border-outline-variant bg-surface-container-low p-4">
				<p className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
					<Icon name="school" className="text-base" />
					{t("profile.educationTitle")}
				</p>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Field label={t("profile.fieldOfStudy")}>
						<Input
							value={fieldOfStudy}
							onChange={(e) => setFieldOfStudy(e.target.value)}
							placeholder={t("profile.fieldOfStudyPlaceholder")}
							icon="school"
						/>
					</Field>
					<Field label={t("profile.degreeLevel")}>
						<Select
							value={degreeLevel}
							onChange={setDegreeLevel}
							aria-label={t("profile.degreeLevel")}
							options={[
								{ value: "", label: t("profile.degreeNone") },
								...DEGREE_LEVELS.map((d) => ({
									value: d,
									label: t(`profile.degree.${d}`),
								})),
							]}
						/>
					</Field>
					<Field label={t("profile.experienceLevel")}>
						<Select
							value={experienceLevel}
							onChange={setExperienceLevel}
							aria-label={t("profile.experienceLevel")}
							options={[
								{ value: "", label: t("profile.experienceNone") },
								...EXPERIENCE_LEVELS.map((e) => ({
									value: e,
									label: t(`profile.experience.${e}`),
								})),
							]}
						/>
					</Field>
				</div>
				<p className="mt-3 flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
					<Icon
						name="tips_and_updates"
						className="mt-0.5 shrink-0 text-[14px]"
					/>
					<span>{t("profile.educationTip")}</span>
				</p>
			</div>

			<div className="mt-6 flex items-center gap-3">
				<Button
					icon="save"
					onClick={() => save.mutate()}
					disabled={save.isPending}
				>
					{save.isPending ? t("profile.saving") : t("profile.saveIdentity")}
				</Button>
				{save.isSuccess ? (
					<span className="flex items-center gap-1 font-label text-label-sm text-secondary">
						<Icon name="check" className="text-[16px]" />
						{t("profile.saved")}
					</span>
				) : null}
				{save.isError ? (
					<span className="flex items-center gap-1 font-label text-label-sm text-error">
						<Icon name="error_outline" className="text-[16px]" />
						{save.error?.message?.length
							? save.error.message
							: t("profile.saveFailed")}
					</span>
				) : null}
			</div>
		</GhostCard>
	);
}

// ── Custom instruction ──────────────────────────────────────────────────────

function CustomInstructionSection({
	customInstruction,
}: {
	customInstruction: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const textDir = useTextDirection();
	const [text, setText] = useState(customInstruction);
	const [improved, setImproved] = useState<string | null>(null);
	const [originalDraft, setOriginalDraft] = useState<string | null>(null);

	useEffect(() => {
		setText(customInstruction);
	}, [customInstruction]);

	const save = useMutation({
		mutationFn: () => patchProfile({ customInstruction: text }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["profile"] });
			setImproved(null);
			setOriginalDraft(null);
		},
	});

	const improve = useMutation({
		mutationFn: () => improveInstruction(text),
		onSuccess: (res) => {
			setImproved(res.improved);
			setOriginalDraft(res.original);
		},
	});

	const applyImproved = () => {
		if (improved) {
			setText(improved);
			setImproved(null);
		}
	};

	return (
		<GhostCard>
			<h2 className="mb-2 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="tune" className="text-[24px]" />
				{t("profile.customInstruction")}
			</h2>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("profile.customInstructionHint")}
			</p>

			<textarea
				value={improved ?? text}
				onChange={(e) => {
					setText(e.target.value);
					setImproved(null);
				}}
				rows={5}
				placeholder={t("profile.customInstructionPlaceholder")}
				className="w-full resize-y border border-outline-variant bg-transparent p-4 font-body text-body-md text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
			/>

			{improved ? (
				<div className="mt-4 rounded border border-secondary/40 bg-secondary-container/30 p-4">
					<div className="mb-2 flex items-center justify-between">
						<span className="flex items-center gap-2 font-label text-label-sm uppercase tracking-widest text-secondary">
							<Icon name="auto_fix_high" className="text-[16px]" />
							{t("profile.improvedPreview")}
						</span>
						{originalDraft ? (
							<button
								onClick={() => setText(originalDraft)}
								className="font-label text-label-sm text-on-surface-variant hover:text-primary"
							>
								{t("profile.restoreOriginal")}
							</button>
						) : null}
					</div>
					<p
						className="mb-3 whitespace-pre-wrap font-body text-body-md text-on-surface"
						dir={textDir(improved ?? "")}
					>
						{improved}
					</p>
					<div className="flex gap-2">
						<Button size="sm" icon="check" onClick={applyImproved}>
							{t("profile.apply")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							icon="close"
							onClick={() => setImproved(null)}
						>
							{t("profile.discard")}
						</Button>
					</div>
				</div>
			) : null}

			<div className="mt-4 space-y-2">
				<div className="flex flex-wrap items-center gap-3">
					<Button
						variant="secondary"
						icon="auto_fix_high"
						onClick={() => improve.mutate()}
						disabled={improve.isPending || text.trim().length < 3}
					>
						{improve.isPending ? t("profile.improving") : t("profile.improve")}
					</Button>
					<Button
						icon="save"
						onClick={() => save.mutate()}
						disabled={save.isPending}
					>
						{save.isPending ? t("profile.saving") : t("profile.save")}
					</Button>
					{save.isSuccess ? (
						<span className="flex items-center gap-1 font-label text-label-sm text-secondary">
							<Icon name="check" className="text-[16px]" />
							{t("profile.saved")}
						</span>
					) : null}
					{save.isError ? (
						<span className="flex items-center gap-1 font-label text-label-sm text-error">
							<Icon name="error_outline" className="text-[16px]" />
							{save.error?.message?.length
								? save.error.message
								: t("profile.saveFailed")}
						</span>
					) : null}
					{improve.isError ? (
						<span className="flex items-center gap-1 font-label text-label-sm text-error">
							<Icon name="error_outline" className="text-[16px]" />
							{aiErrorMessage(t, improve.error, "profile.improveFailed")}
						</span>
					) : null}
				</div>
			</div>
		</GhostCard>
	);
}

// ── Behavior summary ────────────────────────────────────────────────────────

function BehaviorSummarySection({
	summary,
	generatedAt,
}: {
	summary: string;
	generatedAt: Date | null;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const textDir = useTextDirection();
	const generate = useMutation({
		mutationFn: () => generateSummary(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
	});

	return (
		<GhostCard>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h2 className="flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
					<Icon name="insights" className="text-[24px]" />
					{t("profile.behaviorSummary")}
				</h2>
				<Button
					variant="secondary"
					icon="auto_awesome"
					onClick={() => generate.mutate()}
					disabled={generate.isPending}
				>
					{generate.isPending
						? t("profile.generating")
						: summary
							? t("profile.regenerate")
							: t("profile.generate")}
				</Button>
			</div>

			{generate.isError ? (
				<p className="flex items-center gap-2 font-body text-body-md text-error">
					<Icon name="error_outline" className="text-[18px]" />
					{aiErrorMessage(t, generate.error, "profile.generateFailed")}
				</p>
			) : null}

			{summary ? (
				<>
					<p
						className="border-s-2 border-s-primary ps-6 font-body text-body-lg italic leading-relaxed text-on-surface"
						dir={textDir(summary)}
					>
						{summary}
					</p>
					{generatedAt ? (
						<p className="mt-4 font-mono text-[11px] text-on-tertiary-container">
							{t("profile.generatedAt")}{" "}
							{new Date(generatedAt).toLocaleString()}
						</p>
					) : null}
				</>
			) : (
				<p className="font-body text-body-md text-on-surface-variant">
					{t("profile.noSummary")}
				</p>
			)}
		</GhostCard>
	);
}

// ── Interests & topics (derived from history) ───────────────────────────────

function InterestsSection() {
	const { t } = useTranslation();
	const { data: searches } = useQuery({
		queryKey: ["history", "search"],
		queryFn: () => fetchSearchHistory(true),
	});
	const { data: briefs } = useQuery({
		queryKey: ["history", "brief"],
		queryFn: () => fetchBriefHistory(true),
	});

	const categories = new Map<string, number>();
	for (const b of briefs?.items ?? []) {
		for (const theme of b.result.themes ?? []) {
			categories.set(
				theme.name,
				(categories.get(theme.name) ?? 0) + (theme.count || 1),
			);
		}
	}
	const topQueries = [
		...new Set((searches?.items ?? []).map((s) => s.query)),
	].slice(0, 10);
	const topCats = [...categories.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	return (
		<GhostCard>
			<h2 className="mb-4 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="interests" className="text-[24px]" />
				{t("profile.interests")}
			</h2>
			<p className="mb-6 font-body text-body-md text-on-surface-variant">
				{t("profile.interestsHint")}
			</p>

			{topCats.length > 0 ? (
				<div className="mb-6">
					<h3 className="mb-3 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("profile.topCategories")}
					</h3>
					<div className="flex flex-wrap gap-2">
						{topCats.map(([name, count]) => (
							<DomainTag key={name}>
								{name} · {count}
							</DomainTag>
						))}
					</div>
				</div>
			) : null}

			{topQueries.length > 0 ? (
				<div>
					<h3 className="mb-3 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("profile.recentSearches")}
					</h3>
					<div className="flex flex-wrap gap-2">
						{topQueries.map((q) => (
							<DomainTag key={q}>{q}</DomainTag>
						))}
					</div>
				</div>
			) : null}

			{topCats.length === 0 && topQueries.length === 0 ? (
				<p className="font-body text-body-md text-on-tertiary-container">
					{t("profile.noActivity")}
				</p>
			) : null}
		</GhostCard>
	);
}

// ── AI Output Language ─────────────────────────────────────────────────────────

const ALL_LANGUAGES = ISO6391.getLanguages(ISO6391.getAllCodes()).map((l) => ({
	code: l.code,
	name: l.name,
	nativeName: l.nativeName,
}));

function AiLanguageSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});
	const currentLang = profile?.preferredIntelligenceLanguage ?? "en";

	const update = useMutation({
		mutationFn: (code: string) =>
			patchProfile({ preferredIntelligenceLanguage: code }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
	});

	const current = ALL_LANGUAGES.find((l) => l.code === currentLang);

	return (
		<GhostCard>
			<h2 className="mb-4 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="translate" className="text-[24px]" />
				{t("profile.aiLanguage")}
			</h2>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("profile.aiLanguageHint")}
			</p>

			<div className="space-y-3">
				<Select
					value={currentLang}
					onChange={(v) => update.mutate(v)}
					aria-label={t("profile.aiLanguageAria")}
					searchable
					searchPlaceholder={t("settings.languageSearchPlaceholder")}
					noResultsLabel={t("common.noResults")}
					options={ALL_LANGUAGES.map((lang) => ({
						value: lang.code,
						label: `${lang.nativeName} — ${lang.name} (${lang.code})`,
						icon: "translate",
					}))}
				/>

				{current ? (
					<p className="font-mono text-[11px] text-secondary">
						{t("settings.active")} — {current.nativeName} ({current.name})
					</p>
				) : (
					<p className="font-mono text-[11px] text-on-tertiary-container">
						{currentLang.toUpperCase()}
					</p>
				)}
			</div>
		</GhostCard>
	);
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<label className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				{label}
			</label>
			{children}
		</div>
	);
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).slice(0, 2);
	if (parts.length === 0) return "?";
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
