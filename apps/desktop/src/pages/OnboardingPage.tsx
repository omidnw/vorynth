import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import ISO6391 from "iso-639-1";
import type { LlmProviderKind, SourceCategory } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { GhostCard } from "@/components/ui/GhostCard";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { saveProvider } from "@/features/llm/llm-api.js";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import { fetchProfile, patchProfile } from "@/features/profile/profile-api.js";
import {
	disableSourceList,
	fetchSourceListSources,
} from "@/features/sources/sources-api.js";
import { SourceListPreviewDialog } from "@/features/sources/SourceListPreviewDialog.js";
import { BUNDLED_LANGUAGES } from "@/i18n/locales.js";
import { useLocaleStore } from "@/i18n/locale-store.js";
import {
	markOnboardingDone,
	markOnboardingSkipped,
} from "@/features/onboarding/onboarding-store.js";

// ── Reload-safe draft (v1.8.1) ──────────────────────────────────────────────
// The flow keeps its place across a page reload: step + every non-secret
// choice are mirrored to sessionStorage. The API key is NEVER persisted.

const DRAFT_KEY = "vorynth.onboarding.draft";

interface OnboardingDraft {
	step?: 1 | 2 | 3 | 4;
	topics?: SourceCategory[];
	keepOfficial?: boolean;
	provider?: LlmProviderKind | "skip";
	model?: string;
	ollamaMode?: "local" | "cloud";
	baseUrl?: string;
}

function readDraft(): OnboardingDraft {
	try {
		return JSON.parse(
			sessionStorage.getItem(DRAFT_KEY) ?? "{}",
		) as OnboardingDraft;
	} catch {
		return {};
	}
}

function writeDraft(patch: Partial<OnboardingDraft>): void {
	try {
		sessionStorage.setItem(
			DRAFT_KEY,
			JSON.stringify({ ...readDraft(), ...patch }),
		);
	} catch {
		// private mode / storage full — onboarding still works, just not restorable
	}
}

function clearDraft(): void {
	try {
		sessionStorage.removeItem(DRAFT_KEY);
	} catch {
		// ignore
	}
}

/**
 * Onboarding flow (examples/welcome.html).
 *
 * Step 1: Welcome / privacy framing + application & AI-output language picks.
 * Step 2: What matters to you — category tastes saved to the profile, plus
 *         whether Vorynth's official sources stay enabled by default.
 * Step 3: Optional AI service — first explains News vs. Intelligence mode and
 *         why a key is asked (with a local-vs-cloud recommendation), THEN the
 *         provider grid + key, which are SAVED (v1.8.0, they used to be
 *         collected and then dropped), or SKIP to stay in news mode.
 * Step 4: Full recap of the choices and the first collection + enter the app.
 *
 * The whole flow is skippable from any step: Skip applies the default
 * settings (news mode, no AI provider) and enters the app. Completing step 4
 * marks the flow done. Both paths are remembered, so the welcome only shows
 * until the user has made that choice.
 *
 * Copy is plain language for non-technical users (doctors, investors,
 * professors), and every string runs through i18n so the flow translates
 * like the rest of the app.
 */
export function OnboardingPage() {
	// v1.8.1 — the flow survives a reload: step + every non-secret choice are
	// kept in sessionStorage so a refresh doesn't reset a half-done setup (the
	// API key is deliberately NOT persisted).
	const [step, setStep] = useState<1 | 2 | 3 | 4>(() => readDraft().step ?? 1);
	// v1.8.1 — lifted to the page so the final recap can reflect whether the
	// official sources are actually on (StepTopics toggles it; StepFinish reads
	// it) instead of always assuming "on".
	const [keepOfficial, setKeepOfficial] = useState(
		() => readDraft().keepOfficial ?? true,
	);
	const navigate = useNavigate();
	const progress = (step / 4) * 100;

	// Persist step + official-sources choice as they change.
	useEffect(() => {
		writeDraft({ step, keepOfficial });
	}, [step, keepOfficial]);

	const skip = () => {
		clearDraft();
		markOnboardingSkipped();
		navigate("/brief");
	};

	const finish = () => {
		clearDraft();
		markOnboardingDone();
		navigate("/brief");
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
			<header className="mb-12 text-center">
				<h1 className="mb-1 font-headline text-headline-lg tracking-tight text-primary dark:text-primary-fixed">
					Vorynth
				</h1>
				<p className="font-body text-body-md italic text-on-surface-variant">
					Less reading. More understanding.
				</p>
			</header>

			{/* pb-32 keeps step buttons clear of the fixed progress footer (v1.8.0). */}
			<div className="flex w-full max-w-[540px] min-h-[460px] flex-col pb-32 animate-fade-in">
				{step === 1 ? <StepWelcome onNext={() => setStep(2)} /> : null}
				{step === 2 ? (
					<StepTopics
						onBack={() => setStep(1)}
						onNext={() => setStep(3)}
						keepOfficial={keepOfficial}
						onKeepOfficialChange={setKeepOfficial}
					/>
				) : null}
				{step === 3 ? (
					<StepProvider onBack={() => setStep(2)} onNext={() => setStep(4)} />
				) : null}
				{step === 4 ? (
					<StepFinish onFinish={finish} officialSourcesOn={keepOfficial} />
				) : null}
			</div>

			<footer className="fixed bottom-12 w-full max-w-[540px] px-6">
				<div className="relative h-1 overflow-hidden rounded-full bg-surface-variant/30">
					<div
						className="absolute start-0 top-0 h-full bg-primary transition-all duration-700 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<div className="mt-4 flex justify-end">
					<SkipButton onSkip={skip} />
				</div>
			</footer>
		</div>
	);
}

/** "Skip setup" — always available, never blocks reaching the app. */
function SkipButton({ onSkip }: { onSkip: () => void }) {
	const { t } = useTranslation();
	return (
		<Button
			variant="ghost"
			size="sm"
			icon="close"
			onClick={onSkip}
			title={t("onboarding.skipHint")}
		>
			{t("onboarding.skip")}
		</Button>
	);
}

function StepWelcome({ onNext }: { onNext: () => void }) {
	const { t } = useTranslation();
	const setActive = useLocaleStore((s) => s.setActive);

	// v1.8.0 — the language picks live on the FIRST step, where they belong.
	const appLangOptions = BUNDLED_LANGUAGES.map((l) => ({
		value: l.code,
		label: l.label,
	}));
	const aiLangOptions = ISO6391.getAllCodes().map((code) => ({
		value: code,
		label: `${ISO6391.getNativeName(code) || code} — ${ISO6391.getName(code)}`,
	}));

	// Seed both selects from the persisted profile, with local state taking
	// over the moment the user picks. The AI output language used to have a
	// hardcoded `value="en"` and no state, so it never reflected a new choice
	// (v1.8.0) — the app language only worked because changing it re-renders
	// the tree via i18n. Both now update in place.
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});
	const [uiLang, setUiLang] = useState<string | null>(null);
	const [aiLang, setAiLang] = useState<string | null>(null);
	const uiValue =
		uiLang ??
		profile?.preferredUiLanguage ??
		useLocaleStore.getState().active ??
		"en";
	const aiValue = aiLang ?? profile?.preferredIntelligenceLanguage ?? "en";

	return (
		<div className="flex flex-col space-y-8">
			<div className="space-y-3 text-center">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					{t("onboarding.welcome")}
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					{t("onboarding.welcomeBody")}
				</p>
			</div>
			<GhostCard className="flex items-start gap-4">
				<Icon name="shield" className="mt-1 text-primary" />
				<div>
					<p className="font-label text-label-md text-primary">
						{t("onboarding.privacy")}
					</p>
					<p className="mt-1 font-body text-body-md leading-relaxed text-on-surface-variant">
						{t("onboarding.privacyBody")}
					</p>
				</div>
			</GhostCard>

			{/* v1.8.0 — application + AI output language, right on the first step */}
			<div className="space-y-4">
				<div>
					<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("onboarding.appLanguage")}
					</p>
					<Select
						aria-label={t("onboarding.appLanguage")}
						value={uiValue}
						options={appLangOptions}
						searchable
						searchPlaceholder={t("onboarding.languageSearch")}
						onChange={(code) => {
							setUiLang(code);
							void patchProfile({ preferredUiLanguage: code });
							setActive(code);
						}}
						className="mt-1"
					/>
				</div>
				<div>
					<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
						{t("onboarding.aiLanguage")}
					</p>
					<Select
						aria-label={t("onboarding.aiLanguage")}
						value={aiValue}
						options={aiLangOptions}
						searchable
						searchPlaceholder={t("onboarding.languageSearch")}
						onChange={(code) => {
							setAiLang(code);
							void patchProfile({ preferredIntelligenceLanguage: code });
						}}
						className="mt-1"
					/>
				</div>
			</div>

			<div className="flex justify-center pt-8">
				<Button onClick={onNext}>{t("onboarding.begin")}</Button>
			</div>
		</div>
	);
}

const ONBOARDING_PROVIDERS: {
	kind: LlmProviderKind;
	icon: string;
	label: string;
	/** Optional i18n key for the display label (brand names stay literal). */
	labelKey?: string;
	needsKey: boolean;
	/** v1.8.1 — placeholder for the optional model input. */
	modelHint: string;
}[] = [
	{
		kind: "openai",
		icon: "cyclone",
		label: "OpenAI",
		needsKey: true,
		modelHint: "gpt-4o-mini",
	},
	{
		kind: "gemini",
		icon: "auto_awesome",
		label: "Gemini",
		needsKey: true,
		modelHint: "gemini-2.0-flash",
	},
	{
		kind: "anthropic",
		icon: "psychology",
		label: "Anthropic",
		needsKey: true,
		modelHint: "claude-3-5-sonnet-latest",
	},
	{
		// v1.8.1 — the card is "Ollama"; Local vs Cloud is chosen below the
		// grid (local = no key, cloud = API key).
		kind: "ollama",
		icon: "terminal",
		label: "Ollama",
		needsKey: false,
		modelHint: "llama3.2",
	},
];

/** v1.9.0 — per-provider model docs link (same keys as the Settings form). */
const ONBOARDING_PROVIDER_DOCS: Record<
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

function StepProvider({
	onBack,
	onNext,
}: {
	onBack: () => void;
	onNext: () => void;
}) {
	const { t } = useTranslation();
	// v1.8.1 — provider step choices are restored after a reload (apiKey never).
	const draft = readDraft();
	const [provider, setProvider] = useState<LlmProviderKind | "skip">(
		draft.provider ?? "openai",
	);
	const [apiKey, setApiKey] = useState("");
	// v1.8.1 — Ollama runs locally (no key) or on Ollama Cloud (bearer key).
	const [ollamaMode, setOllamaMode] = useState<"local" | "cloud">(
		draft.ollamaMode ?? "local",
	);
	// v1.8.1 — the model name is REQUIRED (no preselected default — the user
	// types it, the placeholder only shows an example).
	const [model, setModel] = useState(draft.model ?? "");
	// v1.8.1 — editable base URL (OpenAI-compatible endpoints / Ollama hosts),
	// matching the Settings form.
	const [baseUrl, setBaseUrl] = useState(draft.baseUrl ?? "");
	// v1.9.0 — the model name is REQUIRED for a real provider; an empty-model
	// Continue shows this under the field and does not advance.
	const [modelError, setModelError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Persist the non-secret choices as they change.
	useEffect(() => {
		writeDraft({ provider, model, ollamaMode, baseUrl });
	}, [provider, model, ollamaMode, baseUrl]);

	/**
	 * v1.8.0 — the provider choice actually takes effect: it is saved to the
	 * engine (it used to be collected here and then silently dropped). A
	 * keyed provider is only switched to Intelligence mode when a key is
	 * present (or the provider is local, e.g. Ollama) — otherwise the choice
	 * is kept and the user finishes the key in Settings.
	 *
	 * Returns true when the step may advance; false blocks Continue (an empty
	 * model name on a real provider).
	 */
	const save = async (): Promise<boolean> => {
		if (provider === "skip") return true;
		const meta = ONBOARDING_PROVIDERS.find((p) => p.kind === provider);
		if (!meta) return true;
		if (!model.trim()) {
			setModelError(t("onboarding.modelRequired"));
			return false;
		}
		setModelError(null);
		const keyed = apiKey.trim();
		// v1.8.1 — Ollama cloud carries the key and defaults to ollama.com;
		// local stores no key and defaults to the local server.
		const isOllama = provider === "ollama";
		const isCloud = isOllama && ollamaMode === "cloud";
		await saveProvider({
			kind: provider,
			label: meta.label,
			apiKey: isOllama
				? isCloud
					? keyed || undefined
					: undefined
				: keyed || undefined,
			// v1.8.1 — the editable Base URL (OpenAI-compatible endpoints /
			// Ollama hosts); defaults per provider when left empty.
			baseUrl: isOllama
				? baseUrl.trim() ||
					(isCloud ? "https://ollama.com" : "http://localhost:11434")
				: baseUrl.trim() || undefined,
			defaultModel: model.trim(),
			enabled: true,
		});
		// Intelligence mode needs a usable provider: a key for keyed providers,
		// anything for local Ollama, and its key for Ollama Cloud.
		const usable = isOllama ? (isCloud ? !!keyed : true) : !!keyed;
		if (usable) {
			await patchSettings({ "engine.mode": "intelligence" });
		}
		return true;
	};

	const handleNext = async () => {
		setSaving(true);
		try {
			// save() returns false when the model name is missing — the step
			// stays put and the inline error explains why.
			if (await save()) onNext();
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex flex-col space-y-6">
			<div className="space-y-2">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					{t("onboarding.config")}
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					{t("onboarding.configBody")}
				</p>
			</div>

			{/* v1.8.0 — explain News vs. Intelligence BEFORE asking for a key, so
			    the ask never feels like a demand out of nowhere. */}
			<div className="rounded border border-outline-variant bg-surface-container-low p-4">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
					{t("onboarding.modesTitle")}
				</p>
				<div className="mt-2 flex items-start gap-2">
					<Icon
						name="article"
						className="mt-0.5 text-[18px] text-on-surface-variant"
					/>
					<p className="font-body text-body-sm text-on-surface-variant">
						{t("onboarding.newsModeBody")}
					</p>
				</div>
				<div className="mt-2 flex items-start gap-2">
					<Icon
						name="auto_awesome"
						className="mt-0.5 text-[18px] text-primary"
					/>
					<p className="font-body text-body-sm text-on-surface-variant">
						{t("onboarding.intelModeBody")}
					</p>
				</div>
			</div>

			{/* Why the key is asked — privacy framing, not a sales pitch. */}
			<div className="flex items-start gap-3 rounded border-s-2 border-s-secondary bg-surface-container-low p-4">
				<Icon
					name="key"
					className="mt-0.5 text-[18px] text-on-surface-variant"
				/>
				<div>
					<p className="font-label text-label-md text-on-surface">
						{t("onboarding.whyKeyTitle")}
					</p>
					<p className="font-body text-body-sm text-on-surface-variant">
						{t("onboarding.whyKeyBody")}
					</p>
				</div>
			</div>

			{/* Local vs. cloud recommendation — which fits whom. */}
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="rounded border border-outline-variant bg-surface-container-low p-4">
					<p className="flex items-center gap-2 font-label text-label-md text-on-surface">
						<Icon name="memory" className="text-[18px] text-secondary" />
						{t("onboarding.localTitle")}
					</p>
					<p className="mt-1 font-body text-body-sm text-on-surface-variant">
						{t("onboarding.localBody")}
					</p>
				</div>
				<div className="rounded border border-outline-variant bg-surface-container-low p-4">
					<p className="flex items-center gap-2 font-label text-label-md text-on-surface">
						<Icon name="cloud" className="text-[18px] text-primary" />
						{t("onboarding.cloudTitle")}
					</p>
					<p className="mt-1 font-body text-body-sm text-on-surface-variant">
						{t("onboarding.cloudBody")}
					</p>
				</div>
			</div>

			<div className="space-y-2">
				<label className="font-label text-label-sm uppercase text-on-tertiary-container">
					{t("onboarding.selectProvider")}
				</label>
				<div className="grid grid-cols-2 gap-3">
					{ONBOARDING_PROVIDERS.map((p) => (
						<button
							key={p.kind}
							type="button"
							onClick={() => {
								setProvider(p.kind);
								setModelError(null);
							}}
							aria-pressed={provider === p.kind}
							className={`flex flex-col items-center gap-2 border p-4 transition-all ${
								provider === p.kind
									? "border-primary bg-surface-container-low"
									: "border-outline-variant hover:border-primary"
							}`}
						>
							<Icon
								name={p.icon}
								className={
									provider === p.kind
										? "text-primary"
										: "text-on-tertiary-container"
								}
							/>
							<span className="font-label text-label-md">
								{p.labelKey ? t(p.labelKey) : p.label}
							</span>
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => {
						setProvider("skip");
						setModelError(null);
					}}
					aria-pressed={provider === "skip"}
					className={`flex w-full items-center justify-center gap-2 border p-3 font-label text-label-sm uppercase tracking-wide transition-all ${
						provider === "skip"
							? "border-primary bg-surface-container-low text-primary"
							: "border-outline-variant text-on-surface-variant hover:border-primary"
					}`}
				>
					<Icon name="block" className="text-[16px]" />
					{t("onboarding.newsOnly")}
				</button>
			</div>

			{provider !== "skip" ? (
				<div className="space-y-2">
					{/* v1.8.1 — Ollama local vs cloud (docs.ollama.com/cloud). */}
					{provider === "ollama" ? (
						<div>
							<label className="font-label text-label-sm uppercase text-on-tertiary-container">
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

					{provider !== "ollama" || ollamaMode === "cloud" ? (
						<div className="space-y-2">
							<label className="font-label text-label-sm uppercase text-on-tertiary-container">
								{t("onboarding.apiKey")}
							</label>
							<Input
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder={t("onboarding.apiKeyPlaceholder")}
								icon="lock"
							/>
							<p className="flex items-center gap-2 font-mono text-[11px] text-on-tertiary-container">
								<Icon name="lock" className="text-[14px]" />
								{t("onboarding.apiKeyHint")}
							</p>
						</div>
					) : null}

					{/* v1.9.0 — the model name is REQUIRED for a real provider. The
					    placeholder shows an EXAMPLE (e.g. …) so it's never mistaken
					    for a preselected value — the user types the model. */}
					<div className="space-y-2">
						<label className="font-label text-label-sm uppercase text-on-tertiary-container">
							{t("provider.model")}
						</label>
						<Input
							value={model}
							onChange={(e) => {
								setModel(e.target.value);
								setModelError(null);
							}}
							placeholder={`e.g. ${
								ONBOARDING_PROVIDERS.find((p) => p.kind === provider)
									?.modelHint ?? ""
							}`}
							icon="memory"
							aria-invalid={modelError !== null}
						/>
						{modelError ? (
							<p className="font-body text-body-sm text-error">{modelError}</p>
						) : null}
						<p className="font-body text-body-sm text-on-surface-variant">
							{t("onboarding.modelHint")}
						</p>
						{/* v1.8.1 — editable Base URL, matching the Settings form
						    (OpenAI-compatible endpoints; Ollama hosts). Hidden for
						    Gemini/Anthropic which only use their official endpoint. */}
						{provider === "openai" || provider === "ollama" ? (
							<div className="space-y-2">
								<label className="font-label text-label-sm uppercase text-on-tertiary-container">
									{t("provider.baseUrl")}
								</label>
								<Input
									value={baseUrl}
									onChange={(e) => setBaseUrl(e.target.value)}
									placeholder={
										provider === "ollama"
											? ollamaMode === "cloud"
												? "https://ollama.com"
												: "http://localhost:11434"
											: "https://api.openai.com/v1"
									}
									icon="link"
								/>
								{provider === "openai" ? (
									<p className="font-body text-body-sm text-on-surface-variant">
										{t("provider.openaiBaseUrlHint")}
									</p>
								) : null}
							</div>
						) : null}
						{/* v1.9.0 — per-provider model docs link (same keys as Settings). */}
						<p className="flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
							<Icon
								name="tips_and_updates"
								className="mt-0.5 shrink-0 text-[14px]"
							/>
							<span>
								{t(
									ONBOARDING_PROVIDER_DOCS[provider as LlmProviderKind].docKey,
								)}{" "}
								<a
									href={
										ONBOARDING_PROVIDER_DOCS[provider as LlmProviderKind].href
									}
									target="_blank"
									rel="noreferrer"
									className="text-secondary transition-colors hover:text-primary hover:underline"
								>
									{
										ONBOARDING_PROVIDER_DOCS[provider as LlmProviderKind]
											.linkText
									}
								</a>
							</span>
						</p>
					</div>
				</div>
			) : (
				<div className="rounded border-s-2 border-s-secondary bg-surface-container-low p-4">
					<p className="font-body text-body-md text-on-surface-variant">
						{t("onboarding.newsOnlyBody")}
					</p>
				</div>
			)}

			{/* v1.8.0 — future providers will land here; point at the changelog. */}
			<p className="flex items-start gap-2 font-body text-body-sm text-on-tertiary-container">
				<Icon name="tips_and_updates" className="mt-0.5 text-[16px]" />
				<span>{t("onboarding.futureProvidersTip")}</span>
			</p>

			<div className="flex items-center justify-between pt-6">
				<Button variant="ghost" size="sm" icon="arrow_back" onClick={onBack}>
					{t("onboarding.back")}
				</Button>
				<Button onClick={() => void handleNext()} disabled={saving}>
					{saving ? t("onboarding.savingProvider") : t("onboarding.continue")}
				</Button>
			</div>
		</div>
	);
}

const ONBOARDING_TOPICS: SourceCategory[] = [
	"ai",
	"security",
	"cloud",
	"backend",
	"devops",
	"software-engineering",
	"programming-languages",
	"web-development",
	"open-source",
];

function StepTopics({
	onBack,
	onNext,
	keepOfficial,
	onKeepOfficialChange,
}: {
	onBack: () => void;
	onNext: () => void;
	/** v1.8.1 — official-sources choice lifted to the page (recap reads it). */
	keepOfficial: boolean;
	onKeepOfficialChange: (on: boolean) => void;
}) {
	const { t } = useTranslation();
	// v1.8.1 — selected topics survive a reload.
	const [selected, setSelected] = useState<SourceCategory[]>(
		() => readDraft().topics ?? [],
	);
	/** v1.8.0 — shown when Continue is pressed with nothing selected. */
	const [showEmptyTip, setShowEmptyTip] = useState(false);
	/** v1.8.1 — "View official sources" preview modal (the developer list). */
	const [previewOpen, setPreviewOpen] = useState(false);

	useEffect(() => {
		writeDraft({ topics: selected });
	}, [selected]);
	const { data: previewSources = [], isLoading: previewLoading } = useQuery({
		queryKey: ["source-list-sources", "developer"],
		queryFn: () => fetchSourceListSources("developer"),
		enabled: previewOpen,
	});

	const toggle = (c: SourceCategory) =>
		setSelected((prev) =>
			prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
		);

	const proceed = async (disableOfficial: boolean) => {
		if (disableOfficial) {
			// The seeded official "developer" list stays, but off — the user can
			// re-enable it anytime on the Sources page.
			try {
				await disableSourceList("developer");
			} catch {
				// Never block onboarding over a list toggle.
			}
		}
		await patchProfile({ topics: selected });
		onNext();
	};

	/**
	 * v1.8.1 — the tip is only a guard for the one genuinely ambiguous case:
	 * nothing selected AND official sources are still on. It is asked ONCE.
	 * - tick off + no topics → proceed (the user chose to disable them; maybe
	 *   they'll add their own RSS — never re-ask).
	 * - tick on + no topics + first Continue → show the tip.
	 * - tick on + no topics + Continue again → the default stands: keep
	 *   official sources, proceed (a repeated Continue means "I want to go on").
	 * - topics selected → proceed (no tip at all).
	 */
	const save = async () => {
		if (selected.length === 0 && keepOfficial && !showEmptyTip) {
			setShowEmptyTip(true);
			return;
		}
		await proceed(!keepOfficial);
	};

	return (
		<div className="flex flex-col space-y-6">
			<div className="space-y-2">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					{t("onboarding.topics")}
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					{t("onboarding.topicsBody")}
				</p>
			</div>

			<div className="flex flex-wrap gap-2">
				{ONBOARDING_TOPICS.map((c) => {
					const on = selected.includes(c);
					return (
						<button
							key={c}
							type="button"
							onClick={() => toggle(c)}
							aria-pressed={on}
							className={`rounded-full border px-4 py-2 font-label text-label-sm transition-all ${
								on
									? "border-primary bg-primary text-on-primary"
									: "border-outline-variant text-on-surface-variant hover:border-primary"
							}`}
						>
							{c.replace(/-/g, " ")}
						</button>
					);
				})}
			</div>

			<p className="font-body text-body-sm text-on-surface-variant">
				{t("onboarding.topicsHint")}
			</p>

			{/* v1.8.0 — explicit official-sources default, visible before Continue.
			    Unchecking flips `disableSourceList("developer")` on Continue. */}
			<div className="space-y-2">
				<Toggle
					icon="rss_feed"
					label={t("onboarding.officialSources")}
					hint={t("onboarding.officialSourcesHint")}
					checked={keepOfficial}
					onChange={onKeepOfficialChange}
				/>
				{/* v1.8.1 — see exactly which sites come with the default list
				    before deciding to keep or disable them. */}
				<button
					type="button"
					onClick={() => setPreviewOpen(true)}
					className="flex items-center gap-1.5 font-label text-label-sm text-secondary transition-colors hover:text-primary"
				>
					<Icon name="visibility" className="text-[16px]" />
					{t("onboarding.previewOfficialSources")}
				</button>
			</div>

			{/* v1.8.0 — empty selection: tell the user what happens instead of
			    silently ending up with nothing. v1.8.1 — only reachable while the
			    official-sources tick is ON; turning it off never re-asks. */}
			{showEmptyTip ? (
				<div className="rounded border-s-2 border-s-primary bg-surface-container-low p-4">
					<p className="mb-3 font-body text-body-md text-on-surface-variant">
						{t("onboarding.emptyTopicsBody")}
					</p>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" icon="check" onClick={() => void proceed(false)}>
							{t("onboarding.emptyTopicsKeep")}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							icon="block"
							onClick={() => {
								// Keep the toggle in sync with the actual state, so a
								// Back to this step shows official sources as off.
								onKeepOfficialChange(false);
								void proceed(true);
							}}
						>
							{t("onboarding.emptyTopicsDisable")}
						</Button>
					</div>
				</div>
			) : null}

			<div className="flex items-center justify-between pt-6">
				<Button variant="ghost" size="sm" icon="arrow_back" onClick={onBack}>
					{t("onboarding.back")}
				</Button>
				<Button onClick={() => void save()}>{t("onboarding.continue")}</Button>
			</div>

			{/* v1.8.1 — preview the official developer list's sites. */}
			<SourceListPreviewDialog
				open={previewOpen}
				listName={t("onboarding.officialSourcesListName")}
				sources={previewSources}
				loading={previewLoading}
				onClose={() => setPreviewOpen(false)}
			/>
		</div>
	);
}

function StepFinish({
	onFinish,
	officialSourcesOn,
}: {
	onFinish: () => void;
	/** v1.8.1 — whether official sources stay on, so the recap doesn't lie
	 *  when the user just turned them off (bug-1 flow). */
	officialSourcesOn: boolean;
}) {
	const { t } = useTranslation();
	const [collecting, setCollecting] = useState(false);
	const { startCollect } = useJobsStore();
	// v1.8.0 — recap the choices made across the flow (provider/mode, topics,
	// languages), so the last step is an overview, not a bare ready screen.
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const mode = (settings?.["engine.mode"] as string | undefined) ?? "news";
	const topics = profile?.topics ?? [];
	const uiLang = profile?.preferredUiLanguage;
	const aiLang = profile?.preferredIntelligenceLanguage;

	const initialize = async () => {
		setCollecting(true);
		// Kick off collect as a background job so it survives navigation.
		await startCollect();
		onFinish();
	};

	const recap: { icon: string; label: string; value: string }[] = [
		{
			icon: "psychology",
			label: t("onboarding.recapMode"),
			value:
				mode === "intelligence"
					? t("onboarding.recapIntelligence")
					: t("onboarding.recapNews"),
		},
		{
			icon: "sell",
			label: t("onboarding.recapTopics"),
			value:
				topics.length > 0
					? topics.map((x: string) => x.replace(/-/g, " ")).join(", ")
					: officialSourcesOn
						? t("onboarding.recapNoTopics")
						: t("onboarding.recapNoTopicsOff"),
		},
		{
			icon: "translate",
			label: t("onboarding.recapUiLanguage"),
			value: uiLang ?? "en",
		},
		{
			icon: "auto_awesome",
			label: t("onboarding.recapAiLanguage"),
			value: aiLang ?? "en",
		},
	];

	return (
		<div className="flex flex-col gap-4 pt-8">
			<div className="space-y-3 text-center">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					{t("onboarding.ready")}
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					{t("onboarding.readyBody")}
				</p>
			</div>

			{/* v1.8.0 — the overview */}
			<div className="space-y-2">
				{recap.map((row) => (
					<div key={row.label} className="flex items-center gap-3">
						<Icon
							name={row.icon}
							className="w-5 shrink-0 text-on-surface-variant"
						/>
						<span className="w-32 shrink-0 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
							{row.label}
						</span>
						<span className="min-w-0 flex-1 truncate font-body text-body-md text-on-surface">
							{row.value}
						</span>
					</div>
				))}
				<p className="pt-2 font-body text-body-sm text-on-surface-variant">
					{t("onboarding.recapNote")}
				</p>
			</div>

			<Button
				block
				size="lg"
				icon="bolt"
				iconFill
				onClick={initialize}
				disabled={collecting}
			>
				{collecting ? t("onboarding.initializing") : t("onboarding.initialize")}
			</Button>
			<p className="text-center font-body text-body-sm text-on-surface-variant">
				{t("onboarding.systemReady")}
			</p>
		</div>
	);
}
