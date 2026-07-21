import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchProfile,
	patchProfile,
	generateSummary,
	improveInstruction,
} from "@/features/profile/profile-api";
import {
	fetchSettings,
	patchSettings,
	fetchSearchHistory,
	fetchBriefHistory,
} from "@/features/history/history-api";
import { LanguageSection } from "@/components/shell/LanguageSection";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { useTranslation } from "react-i18next";
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
	const { data: profile, isLoading } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});

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
		<section className="mx-auto w-full max-w-max-content-width space-y-8 px-gutter py-12">
			<header className="mb-2">
				<h1 className="mb-2 flex items-center gap-3 font-headline text-display-md text-primary dark:text-primary-fixed">
					<Icon name="account_circle" className="text-[32px]" />
					{t("profile.title")}
				</h1>
				<p className="max-w-prose font-body text-body-md text-on-surface-variant">
					{t("profile.subtitle")}
				</p>
			</header>

			<IdentitySection />
			<CustomInstructionSection customInstruction={profile.customInstruction} />
			<BehaviorSummarySection
				summary={profile.behaviorSummary}
				generatedAt={profile.summaryGeneratedAt}
			/>
			<InterestsSection />
			<LanguageSection
				onLocaleChange={(code) => patchProfile({ preferredUiLanguage: code })}
			/>
			<AiLanguageSection />
			<ReaderSettingsSection />
		</section>
	);
}

// ── Identity ────────────────────────────────────────────────────────────────

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

	// Sync local form state when the profile loads (only for initial load, not
	// after every save — the mutation onSuccess handles the UI feedback).
	useEffect(() => {
		if (profile) {
			setFirstName(profile.firstName ?? "");
			setLastName(profile.lastName ?? "");
			setAlias(profile.alias ?? "");
		}
	}, [profile?.firstName, profile?.lastName, profile?.alias]);

	const save = useMutation({
		mutationFn: () =>
			patchProfile({
				firstName: firstName.trim() || null,
				lastName: lastName.trim() || null,
				alias: alias.trim() || null,
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
						dir="auto"
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
							{(improve.error as Error)?.message?.includes("provider")
								? t("profile.needProvider")
								: t("profile.improveFailed")}
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
					{(generate.error as Error)?.message?.includes("provider")
						? t("profile.needProvider")
						: t("profile.generateFailed")}
				</p>
			) : null}

			{summary ? (
				<>
					<p
						className="border-l-2 border-primary pl-6 font-body text-body-lg italic leading-relaxed text-on-surface"
						dir="auto"
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
				<select
					value={currentLang}
					onChange={(e) => update.mutate(e.target.value)}
					className="w-full rounded border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
				>
					{ALL_LANGUAGES.map((lang) => (
						<option key={lang.code} value={lang.code}>
							{lang.nativeName} — {lang.name} ({lang.code})
						</option>
					))}
				</select>

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

// ── Reader settings ─────────────────────────────────────────────────────────

function ReaderSettingsSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const reminderOn = settings?.["reader.supportAuthorReminder"] ?? true;
	const keepLocal = settings?.["reader.defaultKeepMediaLocal"] ?? false;

	const patch = useMutation({
		mutationFn: (p: Record<string, unknown>) => patchSettings(p),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	return (
		<GhostCard>
			<h2 className="mb-4 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="menu_book" className="text-[24px]" />
				{t("profile.readerSettings")}
			</h2>

			<Toggle
				label={t("profile.supportReminder")}
				description={t("profile.supportReminderHint")}
				checked={reminderOn}
				onChange={(v) => patch.mutate({ "reader.supportAuthorReminder": v })}
			/>
			<div className="my-4 h-px bg-outline-variant" />
			<Toggle
				label={t("profile.keepMediaLocal")}
				description={t("profile.keepMediaLocalHint")}
				checked={keepLocal}
				onChange={(v) => patch.mutate({ "reader.defaultKeepMediaLocal": v })}
			/>
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

function Toggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-start justify-between gap-4">
			<div>
				<p className="font-label text-label-md text-on-surface">{label}</p>
				<p className="font-body text-body-sm text-on-surface-variant">
					{description}
				</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
					checked ? "bg-primary" : "bg-outline-variant"
				}`}
			>
				<span
					className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-transform ${
						checked ? "left-[22px]" : "left-0.5"
					}`}
				/>
			</button>
		</label>
	);
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).slice(0, 2);
	if (parts.length === 0) return "?";
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
