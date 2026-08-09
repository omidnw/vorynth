import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useHasHistory } from "@/lib/router/has-history.js";
import { Icon } from "@/components/ui/Icon";
import { PluginIcon } from "@/components/ui/PluginIcon";
import { GhostCard } from "@/components/ui/GhostCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import {
	fetchPlugins,
	fetchPluginsDir,
	installPlugin,
	refreshConnectors,
	scanPlugins,
	setPluginEnabled,
	uninstallPlugin,
} from "@/features/plugins/plugins-api";
import {
	isTauriShell,
	openPluginsFolderInFileManager,
	openPluginsFolderInTerminal,
} from "@/features/plugins/plugins-folder";
import type { PluginInfo } from "@vorynth/types";

/**
 * Plugins page (v1.8.0) — the adapter plugin registry + runtime UI plugins.
 *
 * Lists every plugin Vorynth uses, grouped into Core / Installed / Built-in
 * sections. Every plugin — core adapters included — can be toggled off:
 * disabling an adapter pauses its sources (each source keeps its own enabled
 * flag untouched), so re-enabling restores exactly the previous state.
 *
 * The one exception is the Icon Pack: it's locked (always on) — Vorynth's own
 * icons and fonts load from it — so its row shows an "Always on" badge instead
 * of a toggle switch.
 *
 * User-installed plugins (dropped into `data/plugins/`, picked up by the Scan
 * button or the startup scan) additionally get a Remove button — uninstalling
 * them deletes their row and bundle folder. Built-ins can never be removed.
 */

// ── Persisted UI state (survives navigation and app restarts) ────────

const PLUGINS_PREFIX = "plugins:";

function usePersistedState<T>(key: string, fallback: T) {
	const [value, setValue] = useState<T>(() => {
		try {
			const raw = localStorage.getItem(PLUGINS_PREFIX + key);
			return raw !== null ? (JSON.parse(raw) as T) : fallback;
		} catch {
			return fallback;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(PLUGINS_PREFIX + key, JSON.stringify(value));
		} catch {
			/* storage full or blocked — silently degrade */
		}
	}, [key, value]);

	return [value, setValue] as const;
}

// ── Security-scan acknowledgement (v1.8.0) ────────────────────────────────
// Enabling a HIGH-flagged plugin asks for confirmation once; "don't ask again"
// persists per plugin id so a later toggle-off→on doesn't re-ask for a bundle
// the user already decided to trust. Keyed the same way as showCore, so a user
// who clears Vorynth's persisted state resets these too.

function isHighAcknowledged(id: string): boolean {
	try {
		return localStorage.getItem(`${PLUGINS_PREFIX}ack:${id}`) === "1";
	} catch {
		return false;
	}
}

function acknowledgeHigh(id: string, persist: boolean): void {
	try {
		if (persist) localStorage.setItem(`${PLUGINS_PREFIX}ack:${id}`, "1");
	} catch {
		/* storage blocked — the dialog simply re-appears next time */
	}
}

/** Contribution badges — rendered from `PluginInfo.contributions` tags. */
const CONTRIBUTION_BADGES: Record<
	string,
	{ icon: string; labelKey: string; hintKey: string }
> = {
	theme: {
		icon: "palette",
		labelKey: "plugins.badgeTheme",
		hintKey: "plugins.badgeThemeHint",
	},
	icons: {
		icon: "category",
		labelKey: "plugins.badgeIcons",
		hintKey: "plugins.badgeIconsHint",
	},
	fonts: {
		icon: "font_download",
		labelKey: "plugins.badgeFonts",
		hintKey: "plugins.badgeFontsHint",
	},
	renderer: {
		icon: "description",
		labelKey: "plugins.badgeRenderer",
		hintKey: "plugins.badgeRendererHint",
	},
	copyright: {
		icon: "copyright",
		labelKey: "plugins.badgeCopyright",
		hintKey: "plugins.badgeCopyrightHint",
	},
};

/** i18n label keys for the security flag severity chips. */
const SEVERITY_LABEL_KEY: Record<string, string> = {
	high: "plugins.severityHigh",
	medium: "plugins.severityMedium",
	low: "plugins.severityLow",
};

export function PluginsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	// Back only makes sense when the user actually came from somewhere — an
	// in-app navigation pushes real history; a deep link / restored session
	// lands here with none, and the button disappears instead of going nowhere.
	// Uses the app's initial location key (not `"default"`, which is unreliable
	// across trailing-slash spellings on reload) — see lib/router/has-history.ts.
	const hasHistory = useHasHistory();

	const [query, setQuery] = useState("");
	const [showCore, setShowCore] = usePersistedState("showCore", true);
	const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
		null,
	);
	const [removeTarget, setRemoveTarget] = useState<PluginInfo | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	/** Which OS-open action is in flight ("folder" or "terminal") — used to
	 *  disable both buttons while one is running. */
	const [opening, setOpening] = useState<"folder" | "terminal" | null>(null);

	const { data: plugins, isLoading } = useQuery({
		queryKey: ["plugins"],
		queryFn: fetchPlugins,
	});
	const { data: dir } = useQuery({
		queryKey: ["plugins-dir"],
		queryFn: fetchPluginsDir,
	});

	const toggle = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			setPluginEnabled(id, { enabled }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plugins"] }),
	});

	const scan = useMutation({
		mutationFn: scanPlugins,
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["plugins"] });
			const parts: string[] = [];
			if (result.added.length > 0)
				parts.push(
					t("plugins.scanResultAdded", { count: result.added.length }),
				);
			if (result.removed.length > 0)
				parts.push(
					t("plugins.scanResultRemoved", { count: result.removed.length }),
				);
			setNotice(
				parts.length > 0 ? { ok: true, text: parts.join(" · ") } : null,
			);
		},
		onError: () => setNotice({ ok: false, text: t("plugins.scanError") }),
	});

	// v1.8.0 — fetch the official connector registry from GitHub. Provisions
	// official connectors (arXiv & future ones) so they resolve like built-ins.
	const connectors = useMutation({
		mutationFn: refreshConnectors,
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["plugins"] });
			const parts: string[] = [];
			if (result.added.length > 0)
				parts.push(
					t("plugins.connectorsAdded", { count: result.added.length }),
				);
			if (result.updated.length > 0)
				parts.push(
					t("plugins.connectorsUpdated", { count: result.updated.length }),
				);
			if (result.skipped.length > 0)
				parts.push(
					t("plugins.connectorsSkipped", { count: result.skipped.length }),
				);
			setNotice({
				ok: true,
				text:
					parts.length > 0
						? parts.join(" · ")
						: t("plugins.connectorsUpToDate"),
			});
		},
		onError: () => setNotice({ ok: false, text: t("plugins.connectorsError") }),
	});

	const install = useMutation({
		mutationFn: installPlugin,
		onSuccess: (info) => {
			queryClient.invalidateQueries({ queryKey: ["plugins"] });
			setNotice({
				ok: true,
				text: t("plugins.installResult", {
					name: info.name,
					version: info.version,
				}),
			});
		},
		onError: () => setNotice({ ok: false, text: t("plugins.installError") }),
	});

	const remove = useMutation({
		mutationFn: ({ id, force }: { id: string; force: boolean }) =>
			uninstallPlugin(id, force),
		onSuccess: () => {
			setRemoveTarget(null);
			queryClient.invalidateQueries({ queryKey: ["plugins"] });
		},
	});

	// OS-open actions — the Tauri shell launches the file manager / terminal
	// (no-op outside the desktop app); failures surface as a transient notice.
	const openFolder = async () => {
		if (!dir) return;
		setOpening("folder");
		try {
			await openPluginsFolderInFileManager(dir.dir);
		} catch {
			setNotice({ ok: false, text: t("plugins.openFolderError") });
		} finally {
			setOpening(null);
		}
	};

	const openTerminal = async () => {
		if (!dir) return;
		setOpening("terminal");
		try {
			await openPluginsFolderInTerminal(dir.dir);
		} catch {
			setNotice({ ok: false, text: t("plugins.openTerminalError") });
		} finally {
			setOpening(null);
		}
	};

	// Scan/install feedback is transient — clear it after a few seconds.
	useEffect(() => {
		if (!notice) return;
		const timer = window.setTimeout(() => setNotice(null), 6000);
		return () => window.clearTimeout(timer);
	}, [notice]);

	const q = query.trim().toLowerCase();
	const matches = (p: PluginInfo) =>
		!q ||
		p.name.toLowerCase().includes(q) ||
		p.description.toLowerCase().includes(q) ||
		p.id.toLowerCase().includes(q);

	const coreCount = (plugins ?? []).filter((p) => p.core).length;
	const corePlugins = (plugins ?? []).filter((p) => p.core && matches(p));
	const officialPlugins = (plugins ?? []).filter(
		(p) => p.tier === "official" && matches(p),
	);
	const installedPlugins = (plugins ?? []).filter(
		(p) => p.installed && matches(p),
	);
	const builtInPlugins = (plugins ?? []).filter(
		(p) => !p.core && p.tier !== "official" && !p.installed && matches(p),
	);
	const visibleSections =
		(showCore ? corePlugins.length : 0) +
		officialPlugins.length +
		installedPlugins.length +
		builtInPlugins.length;

	const anyBusy = toggle.isPending || remove.isPending;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10">
				{hasHistory ? (
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="mb-4 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon name="arrow_back" className="text-[18px]" />
						{t("plugins.back")}
					</button>
				) : null}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="flex items-center gap-3 font-headline text-display-md text-primary dark:text-primary-fixed">
						<Icon name="extension" className="text-[32px]" />
						{t("plugins.title")}
					</h1>
					<DocsHelpButton sectionId="plugins" />
				</div>
				<p className="mt-2 max-w-prose font-body text-body-md text-on-surface-variant">
					{t("plugins.subtitle")}
				</p>
			</header>

			<div className="mb-8 space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative min-w-[220px] flex-1">
						<Icon
							name="search"
							className="absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
						/>
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t("plugins.searchPlaceholder")}
							aria-label={t("plugins.searchLabel")}
							className="w-full rounded border border-outline-variant bg-surface-container-low py-2.5 ps-10 pe-3 font-body text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
						/>
					</div>
					<label className="flex cursor-pointer items-center gap-2 font-label text-label-md text-on-surface-variant">
						<button
							type="button"
							role="switch"
							aria-checked={showCore}
							onClick={() => setShowCore(!showCore)}
							title={t("plugins.showCoreHint")}
							className={cn(
								"relative h-6 w-11 flex-none rounded-full transition-colors",
								showCore ? "bg-primary" : "bg-surface-variant",
							)}
						>
							<span
								className={cn(
									"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest transition-all",
									showCore ? "start-[22px]" : "start-0.5",
								)}
							/>
						</button>
						<span className="whitespace-nowrap">
							{showCore ? t("plugins.hideCore") : t("plugins.showCore")}
						</span>
					</label>
					<Button
						variant="primary"
						icon="download"
						disabled={install.isPending}
						title={t("plugins.installHint")}
						onClick={() => fileInputRef.current?.click()}
					>
						{install.isPending ? t("plugins.installing") : t("plugins.install")}
					</Button>
					<Button
						variant="secondary"
						icon="folder_open"
						disabled={scan.isPending}
						onClick={() => scan.mutate()}
					>
						{scan.isPending ? t("plugins.scanning") : t("plugins.scan")}
					</Button>
					<Button
						variant="secondary"
						icon="cloud_download"
						disabled={connectors.isPending}
						title={t("plugins.checkConnectorsHint")}
						onClick={() => connectors.mutate()}
					>
						{connectors.isPending
							? t("plugins.connectorsChecking")
							: t("plugins.checkConnectors")}
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".vorynth-plugin,application/zip,application/octet-stream"
						className="hidden"
						aria-label={t("plugins.install")}
						onChange={(e) => {
							const file = e.target.files?.[0];
							e.target.value = ""; // allow re-picking the same file
							if (!file) return;
							const reader = new FileReader();
							reader.onload = () => {
								if (reader.result instanceof ArrayBuffer)
									install.mutate(reader.result);
							};
							reader.onerror = () =>
								setNotice({ ok: false, text: t("plugins.installError") });
							reader.readAsArrayBuffer(file);
						}}
					/>
				</div>

				{dir ? (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<p className="flex flex-wrap items-center gap-2 font-label text-label-sm text-on-surface-variant">
							<Icon name="folder" className="text-[14px]" />
							{t("plugins.pluginsDirLabel")}:{" "}
							<code className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-mono-technical dir-ltr-isolate">
								{dir.dir}
							</code>
							<span className="hidden sm:inline">
								— {t("plugins.scanHint")}
							</span>
						</p>
						<div className="flex items-center gap-2">
							<Button
								variant="secondary"
								size="sm"
								icon="folder_open"
								disabled={!isTauriShell() || opening !== null}
								title={
									isTauriShell()
										? t("plugins.openFolderHint")
										: t("plugins.desktopOnly")
								}
								onClick={openFolder}
							>
								{t("plugins.openFolder")}
							</Button>
							<Button
								variant="secondary"
								size="sm"
								icon="terminal"
								disabled={!isTauriShell() || opening !== null}
								title={
									isTauriShell()
										? t("plugins.openTerminalHint")
										: t("plugins.desktopOnly")
								}
								onClick={openTerminal}
							>
								{t("plugins.openInTerminal")}
							</Button>
						</div>
					</div>
				) : null}

				{notice ? (
					<p
						className={cn(
							"font-body text-body-md",
							notice.ok ? "text-primary" : "text-error",
						)}
						role="status"
					>
						{notice.text}
					</p>
				) : null}
			</div>

			{isLoading ? (
				<p className="font-body text-body-md text-on-surface-variant">
					{t("plugins.loading")}
				</p>
			) : plugins === undefined ? (
				<p className="font-body text-body-md text-on-surface-variant">
					{t("plugins.empty")}
				</p>
			) : (
				<div className="space-y-6">
					{!showCore && coreCount > 0 ? (
						<p className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
							<Icon name="visibility_off" className="text-[14px]" />
							{t("plugins.coreHidden", { count: coreCount })}
						</p>
					) : null}

					{visibleSections === 0 ? (
						query.trim() ? (
							<p className="font-body text-body-md text-on-surface-variant">
								{t("plugins.noSearchResults", { q: query.trim() })}
							</p>
						) : !showCore && coreCount > 0 ? null : (
							<p className="font-body text-body-md text-on-surface-variant">
								{t("plugins.empty")}
							</p>
						)
					) : (
						<div className="space-y-10">
							{showCore && corePlugins.length > 0 ? (
								<PluginSection title={t("plugins.sectionCore")}>
									{corePlugins.map((plugin) => (
										<PluginRow
											key={plugin.id}
											plugin={plugin}
											busy={anyBusy}
											onToggle={(enabled) =>
												toggle.mutate({ id: plugin.id, enabled })
											}
										/>
									))}
								</PluginSection>
							) : null}
							{officialPlugins.length > 0 ? (
								<PluginSection title={t("plugins.sectionOfficial")}>
									{officialPlugins.map((plugin) => (
										<PluginRow
											key={plugin.id}
											plugin={plugin}
											busy={anyBusy}
											onToggle={(enabled) =>
												toggle.mutate({ id: plugin.id, enabled })
											}
										/>
									))}
								</PluginSection>
							) : null}
							{installedPlugins.length > 0 ? (
								<PluginSection title={t("plugins.sectionInstalled")}>
									{installedPlugins.map((plugin) => (
										<PluginRow
											key={plugin.id}
											plugin={plugin}
											busy={anyBusy}
											onToggle={(enabled) =>
												toggle.mutate({ id: plugin.id, enabled })
											}
											onRemove={() => setRemoveTarget(plugin)}
										/>
									))}
								</PluginSection>
							) : null}
							{builtInPlugins.length > 0 ? (
								<PluginSection title={t("plugins.sectionBuiltIn")}>
									{builtInPlugins.map((plugin) => (
										<PluginRow
											key={plugin.id}
											plugin={plugin}
											busy={anyBusy}
											onToggle={(enabled) =>
												toggle.mutate({ id: plugin.id, enabled })
											}
										/>
									))}
								</PluginSection>
							) : null}
						</div>
					)}
				</div>
			)}

			{toggle.error ? (
				<p className="mt-4 font-mono text-mono-technical text-error">
					{t("plugins.toggleError")}
				</p>
			) : null}
			{remove.error ? (
				<p className="mt-4 font-mono text-mono-technical text-error">
					{t("plugins.removeError")}
				</p>
			) : null}

			<ConfirmDialog
				open={removeTarget !== null}
				title={
					removeTarget
						? t("plugins.removeTitle", { name: removeTarget.name })
						: ""
				}
				message={t("plugins.removeBody")}
				confirmLabel={t("plugins.remove")}
				confirming={remove.isPending}
				confirmingLabel={t("plugins.removing")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					if (removeTarget)
						remove.mutate({ id: removeTarget.id, force: false });
				}}
				onCancel={() => {
					if (!remove.isPending) setRemoveTarget(null);
				}}
				icon="delete"
			/>
		</section>
	);
}

function PluginSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section aria-label={title}>
			<h2 className="mb-3 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				{title}
			</h2>
			<div className="space-y-4">{children}</div>
		</section>
	);
}

function PluginRow({
	plugin,
	busy,
	onToggle,
	onRemove,
}: {
	plugin: PluginInfo;
	busy: boolean;
	onToggle: (enabled: boolean) => void;
	onRemove?: () => void;
}) {
	const { t } = useTranslation();
	const [showSecurity, setShowSecurity] = useState(false);
	const [confirmEnable, setConfirmEnable] = useState(false);
	const dependencyNames = plugin.dependencies.join(", ");

	// Security-scan surface (installed plugins only — built-ins are trusted).
	const risk = plugin.security?.severity;
	const isHighRisk = risk === "high";
	const showBadge = risk === "high" || risk === "medium";
	const flags = plugin.security?.flags ?? [];

	return (
		<GhostCard>
			<div className="flex items-start justify-between gap-6">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						{/* v1.8.0 — each connector's own icon: a custom image (iconSrc)
								    or a Material Symbols ligature from its manifest. */}
						<span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-container-high text-primary">
							<PluginIcon
								icon={plugin.icon}
								iconSrc={plugin.iconSrc}
								className="h-[18px] w-[18px] text-[18px]"
							/>
						</span>
						<h3 className="font-headline text-headline-sm text-on-surface">
							{plugin.name}
						</h3>
						<span className="font-mono text-mono-technical text-on-surface-variant dir-ltr-isolate">
							{t("plugins.version", { version: plugin.version })}
						</span>
						{plugin.core ? (
							<span className="inline-flex items-center gap-1 rounded bg-secondary-container px-2 py-0.5 font-label text-label-sm text-on-secondary-container">
								<Icon name="shield" className="text-[12px]" />
								{t("plugins.core")}
							</span>
						) : null}
						{plugin.tier === "official" ? (
							<span
								className="inline-flex items-center gap-1 rounded bg-primary-container px-2 py-0.5 font-label text-label-sm text-on-primary-container"
								title={t("plugins.officialHint")}
							>
								<Icon name="verified" className="text-[12px]" />
								{t("plugins.official")}
							</span>
						) : null}
						{plugin.installed ? (
							<span
								className="inline-flex items-center gap-1 rounded border border-primary px-2 py-0.5 font-label text-label-sm text-primary"
								title={t("plugins.installedHint")}
							>
								<Icon name="check_circle" className="text-[12px]" />
								{t("plugins.installed")}
							</span>
						) : null}
						{plugin.kind === "ui" ? (
							<span
								className="inline-flex items-center gap-1 rounded bg-tertiary-container px-2 py-0.5 font-label text-label-sm text-on-tertiary-container"
								title={t("plugins.uiHint")}
							>
								<Icon name="extension" className="text-[12px]" />
								{t("plugins.ui")}
							</span>
						) : null}
						{/* v1.8.0 — derived state: at least one enabled source collects
						    through this connector ("in use") or none does ("idle"). */}
						{plugin.kind === "adapter" ? (
							plugin.active ? (
								<span
									className="inline-flex items-center gap-1 rounded bg-secondary-container px-2 py-0.5 font-label text-label-sm text-on-secondary-container"
									title={t("plugins.activeHint")}
								>
									<Icon name="play_arrow" className="text-[12px]" />
									{t("plugins.active")}
								</span>
							) : (
								<span
									className="inline-flex items-center gap-1 rounded bg-surface-variant px-2 py-0.5 font-label text-label-sm text-on-surface-variant"
									title={t("plugins.idleHint")}
								>
									<Icon name="pause" className="text-[12px]" />
									{t("plugins.idle")}
								</span>
							)
						) : null}
						{plugin.contributions?.map((c) => {
							const badge = CONTRIBUTION_BADGES[c];
							if (!badge) return null;
							return (
								<span
									key={c}
									className="inline-flex items-center gap-1 rounded bg-primary-container px-2 py-0.5 font-label text-label-sm text-on-primary-container"
									title={t(badge.hintKey)}
								>
									<Icon name={badge.icon} className="text-[12px]" />
									{t(badge.labelKey)}
								</span>
							);
						})}
						{showBadge ? (
							<button
								type="button"
								onClick={() => setShowSecurity((s) => !s)}
								aria-expanded={showSecurity}
								title={t("plugins.securityBadgeHint")}
								className={cn(
									"inline-flex items-center gap-1 rounded px-2 py-0.5 font-label text-label-sm transition-colors",
									isHighRisk
										? "bg-error/10 text-error hover:bg-error/20"
										: "bg-gold/10 text-gold hover:bg-gold/20",
								)}
							>
								<Icon name="warning" className="text-[12px]" />
								{isHighRisk
									? t("plugins.securityHigh")
									: t("plugins.securityMedium")}
							</button>
						) : null}
					</div>
					<p className="mt-1 font-body text-body-md text-on-surface-variant">
						{plugin.description}
					</p>
					{plugin.core ? (
						<p className="mt-1 font-label text-label-sm text-on-surface-variant">
							{t("plugins.coreHint")}
						</p>
					) : null}
					{plugin.installed ? (
						<p className="mt-1 font-label text-label-sm text-on-surface-variant">
							{t("plugins.installedHint")}
						</p>
					) : null}
					{plugin.dependencies.length > 0 ? (
						<p className="mt-1 font-label text-label-sm text-on-surface-variant">
							{t("plugins.dependencies")}: {dependencyNames}
						</p>
					) : null}
					{plugin.enabled && !plugin.effectiveEnabled ? (
						<p className="mt-1 font-label text-label-sm text-error">
							{t("plugins.disabledDependency")}
						</p>
					) : null}
					{showSecurity && flags.length > 0 ? (
						<div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3">
							<p className="mb-2 font-label text-label-sm text-on-surface-variant">
								{t("plugins.securityDetailsTitle")}
							</p>
							<ul className="space-y-2">
								{flags.map((flag) => (
									<li key={flag.id} className="flex items-start gap-2">
										<span
											className={cn(
												"mt-0.5 inline-flex flex-none items-center gap-1 rounded px-1.5 py-0.5 font-label text-label-sm",
												flag.severity === "high"
													? "bg-error/10 text-error"
													: flag.severity === "medium"
														? "bg-gold/10 text-gold"
														: "bg-surface-variant text-on-surface-variant",
											)}
										>
											{t(
												SEVERITY_LABEL_KEY[flag.severity] ??
													"plugins.severityLow",
											)}
										</span>
										<div className="min-w-0">
											<p className="font-body text-body-sm text-on-surface">
												{flag.label}
												{flag.count > 1 ? (
													<span className="ms-1 text-on-surface-variant">
														{t("plugins.securityRepeated", {
															count: flag.count,
														})}
													</span>
												) : null}
											</p>
											<code className="block w-full truncate font-mono text-mono-technical text-on-surface-variant dir-ltr-isolate">
												{flag.evidence}
											</code>
										</div>
									</li>
								))}
							</ul>
							<p className="mt-2 font-body text-body-sm text-on-surface-variant">
								{t("plugins.securityDetailsHint")}
							</p>
						</div>
					) : null}
				</div>
				<div className="flex flex-none flex-col items-end gap-2">
					{plugin.locked ? (
						<span
							className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2.5 py-1 font-label text-label-sm text-on-surface-variant"
							title={t("plugins.alwaysOnHint")}
						>
							<Icon name="lock" className="text-[14px]" />
							{t("plugins.alwaysOn")}
						</span>
					) : (
						<button
							type="button"
							role="switch"
							aria-checked={plugin.enabled}
							aria-label={`${plugin.name} ${plugin.enabled ? t("plugins.enabled") : t("plugins.disabled")}`}
							disabled={busy}
							onClick={() => {
								const turningOn = !plugin.enabled;
								// Enabling a HIGH-flagged plugin asks once (per plugin)
								// unless the user already acknowledged it.
								if (turningOn && isHighRisk && !isHighAcknowledged(plugin.id)) {
									setConfirmEnable(true);
									return;
								}
								onToggle(turningOn);
							}}
							className={cn(
								"relative h-6 w-11 flex-none rounded-full transition-colors",
								plugin.enabled ? "bg-primary" : "bg-surface-variant",
							)}
						>
							<span
								className={cn(
									"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest transition-all",
									plugin.enabled ? "start-[22px]" : "start-0.5",
								)}
							/>
						</button>
					)}
					{onRemove ? (
						<button
							type="button"
							onClick={onRemove}
							disabled={busy}
							className="inline-flex items-center gap-1 rounded px-2 py-1 font-label text-label-sm text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
						>
							<Icon name="delete" className="text-[16px]" />
							{t("plugins.remove")}
						</button>
					) : null}
				</div>
			</div>

			{plugin.security && confirmEnable ? (
				<ConfirmDialog
					open={confirmEnable}
					title={t("plugins.enableRiskyTitle", { name: plugin.name })}
					message={
						<>
							{t("plugins.enableRiskyBody")}
							<br />
							{plugin.security.flags.map((flag) => (
								<span key={flag.id}>
									• {flag.label}
									<br />
								</span>
							))}
						</>
					}
					confirmLabel={t("plugins.enableAnyway")}
					cancelLabel={t("common.cancel")}
					danger={false}
					dontShowAgain
					onConfirm={(dontShow) => {
						acknowledgeHigh(plugin.id, dontShow ?? false);
						setConfirmEnable(false);
						onToggle(true);
					}}
					onCancel={() => setConfirmEnable(false)}
				/>
			) : null}
		</GhostCard>
	);
}
