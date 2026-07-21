import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LlmProviderKind } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { ThemeToggle } from "@/components/shell/ThemeToggle.js";
import { UsageSection } from "@/features/llm/UsageSection.js";
import { DataOwnershipSection } from "@/features/backup/DataOwnershipSection.js";
import { HistorySection } from "@/features/history/HistorySection.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { fetchEngineStatus, verifyLlm } from "@/features/brief/brief-api.js";
import {
	deleteProvider,
	fetchProviders,
	saveProvider,
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

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10">
				<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
					{t("settings.title")}
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					{t("settings.subtitle")}
				</p>
			</header>

			<div className="space-y-8">
				{/* Engine status */}
				<GhostCard>
					<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon name="memory" className="text-base" />
						Engine Status
					</h3>
					{status ? (
						<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
							<Stat label="Version" value={status.version} />
							<Stat
								label="Sources"
								value={`${status.sources.enabled}/${status.sources.total} on`}
							/>
							<Stat label="Articles" value={String(status.articles.total)} />
							<Stat
								label="LLM"
								value={
									status.llm.configured
										? (status.llm.providerKind ?? "on")
										: "news mode"
								}
								tone={status.llm.configured ? "primary" : "muted"}
							/>
						</div>
					) : (
						<p className="font-body text-body-md text-on-surface-variant">
							Loading…
						</p>
					)}
				</GhostCard>

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

				{/* LLM provider */}
				<LlmProviderSection
					configured={status?.llm.configured ?? false}
					providerKind={status?.llm.providerKind ?? null}
				/>

				{/* Usage — tokens + requests + rate-limit state */}
				<UsageSection
					rateLimit={{
						capacity: Number(import.meta.env.VITE_LLM_RPM ?? 5),
						inFlight: 0,
					}}
				/>

				{/* Language now lives on the Profile page. */}
				<GhostCard className="flex items-center justify-between gap-4">
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

				{/* History — what gets recorded into the History drawer */}
				<HistorySection />

				{/* Appearance */}
				<GhostCard>
					<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						<Icon name="palette" className="text-base" />
						{t("settings.appearance")}
					</h3>
					<div className="flex items-center justify-between">
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
				</GhostCard>

				{/* Data ownership — backup / restore / delete-all */}
				<DataOwnershipSection />
			</div>
		</section>
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
		<div className="border-l-2 border-outline-variant pl-3">
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
}[] = [
	{
		kind: "gemini",
		icon: "auto_awesome",
		label: "Gemini",
		modelHint: "gemini-2.0-flash",
		needsKey: true,
	},
	{
		kind: "openai",
		icon: "cyclone",
		label: "OpenAI",
		modelHint: "gpt-4o-mini",
		needsKey: true,
	},
	{
		kind: "anthropic",
		icon: "neurology",
		label: "Anthropic",
		modelHint: "claude-3-5-sonnet-latest",
		needsKey: true,
	},
	{
		kind: "ollama",
		icon: "terminal",
		label: "Ollama (local)",
		modelHint: "llama3.2",
		needsKey: false,
	},
];

function LlmProviderSection({
	configured,
	providerKind,
}: {
	configured: boolean;
	providerKind: string | null;
}) {
	const queryClient = useQueryClient();
	const { data: providers = [] } = useQuery({
		queryKey: ["llm-providers"],
		queryFn: fetchProviders,
	});
	const [showForm, setShowForm] = useState(false);
	const [kind, setKind] = useState<LlmProviderKind>("gemini");
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState("");
	const [baseUrl, setBaseUrl] = useState("");

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["llm-providers"] });
		queryClient.invalidateQueries({ queryKey: ["engine-status"] });
		queryClient.invalidateQueries({ queryKey: ["reports", "today"] });
	};

	const save = useMutation({
		mutationFn: () =>
			saveProvider({
				kind,
				label:
					label ||
					(PROVIDER_OPTIONS.find((p) => p.kind === kind)?.label ?? kind),
				apiKey: apiKey || undefined,
				defaultModel: model || undefined,
				baseUrl: baseUrl || undefined,
				enabled: true,
			}),
		onSuccess: () => {
			invalidate();
			setShowForm(false);
			setApiKey("");
			setLabel("");
		},
	});
	const remove = useMutation({
		mutationFn: (id: string) => deleteProvider(id),
		onSuccess: invalidate,
	});
	const verify = useMutation({
		mutationFn: verifyLlm,
		onSuccess: () => invalidate(),
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

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="neurology" className="text-base" />
				Intelligence Provider
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				Optional. Without a provider, Vorynth stays in news mode — collected
				stories ranked by freshness and source reliability. Add a key to
				generate the intelligence triad.
			</p>

			{configured ? (
				<div className="mb-4 flex flex-wrap items-center gap-3 border-l-2 border-secondary bg-surface-container-low px-4 py-3 rounded">
					<Icon name="check_circle" className="text-secondary" />
					<span className="font-label text-label-md text-on-surface">
						Active: {providerKind}
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
			) : (
				<div className="mb-4 flex flex-wrap items-center gap-3 border-l-2 border-outline-variant bg-surface-container-low px-4 py-3 rounded">
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

			{/* Configured providers list */}
			{providers.length > 0 ? (
				<div className="mb-4 space-y-2">
					{providers.map((p: ProviderRow) => (
						<div
							key={p.id}
							className="flex items-center gap-3 border border-outline-variant px-4 py-3 rounded"
						>
							<Icon
								name={
									PROVIDER_OPTIONS.find((o) => o.kind === p.kind)?.icon ?? "api"
								}
								className="text-on-surface-variant"
							/>
							<div className="flex-1">
								<p className="font-label text-label-md text-on-surface">
									{p.label}
								</p>
								<p className="font-mono text-[11px] text-on-tertiary-container">
									{p.kind} · {p.apiKeyStored ? "key stored" : "no key"} ·{" "}
									{p.defaultModel ?? "default model"}
								</p>
							</div>
							<DomainTag>{p.enabled ? "on" : "off"}</DomainTag>
							<button
								onClick={() => remove.mutate(p.id)}
								className="p-2 text-on-surface-variant hover:text-error"
								aria-label="Remove"
							>
								<Icon name="delete" className="text-[18px]" />
							</button>
						</div>
					))}
				</div>
			) : null}

			{/* Inline form */}
			{showForm ? (
				<div className="space-y-4 border-l-2 border-l-primary bg-surface-container-low p-4 rounded">
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
								Label
							</label>
							<Input
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="My Gemini key"
							/>
						</div>
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								Model
							</label>
							<Input
								value={model}
								onChange={(e) => setModel(e.target.value)}
								placeholder={activeOption?.modelHint ?? ""}
							/>
						</div>
					</div>

					{activeOption?.needsKey ? (
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								API Key
							</label>
							<Input
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="paste key…"
								icon="lock"
							/>
						</div>
					) : (
						<div>
							<label className="font-label text-label-sm uppercase text-on-surface-variant">
								Base URL
							</label>
							<Input
								value={baseUrl}
								onChange={(e) => setBaseUrl(e.target.value)}
								placeholder="http://localhost:11434/v1"
								icon="link"
							/>
						</div>
					)}

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
							Cancel
						</Button>
						<Button
							size="sm"
							icon="check"
							onClick={() => save.mutate()}
							disabled={save.isPending}
						>
							{save.isPending ? "Saving…" : "Save Provider"}
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
					Add Provider
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

	const handleClick = () => {
		if (!window.confirm(t("settings.recollectConfirm"))) return;
		void startForceCollect();
	};

	if (isActive) {
		return (
			<div className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
				<Icon name="sync" className="animate-spin text-[16px]" />
				{t("settings.recollectBusy")}
			</div>
		);
	}

	return (
		<Button variant="secondary" icon="sync_problem" onClick={handleClick}>
			{t("settings.recollectButton")}
		</Button>
	);
}
