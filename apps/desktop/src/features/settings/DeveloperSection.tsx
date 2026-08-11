import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import { fetchNetworkInfo } from "@/features/network/network-api.js";
import { CORE_BASE_URL } from "@/lib/api/config";
import type { AppSettings, NetworkAccessMode } from "@vorynth/types";

/**
 * Developer settings (v1.8.1) — revealed when "Show advanced features" is on.
 *
 * A technical user building their own frontend against the local engine needs
 * three things this section provides: the backend URL, the frontend (app)
 * origin, and control over who may call the engine:
 * - "Local only": loopback (127.0.0.1) — the default, fully private.
 * - "Allow all": binds 0.0.0.0 and opens CORS — the engine is reachable from
 *   every device on the network (both backend and frontend).
 * - "Custom IPs": binds 0.0.0.0 so the listed IPs can reach the socket, but
 *   CORS only allows those IPs alongside 127.0.0.1 (e.g. 192.168.9.160,10.0.0.5).
 *
 * CORS/IP rules apply immediately (the engine evaluates them per request);
 * the listening HOST is read at startup, so it changes on the next launch.
 * The engine has no login — exposing it to the network is a real security
 * decision, and the UI says so.
 */
export function DeveloperSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const { data: network } = useQuery({
		queryKey: ["network"],
		queryFn: fetchNetworkInfo,
		// Only reach for the engine's network info once this section is visible.
		enabled: settings?.["ui.showAdvancedFeatures"] === true,
	});
	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const showAdvanced = settings?.["ui.showAdvancedFeatures"] === true;
	const mode =
		(settings?.["network.accessMode"] as NetworkAccessMode | undefined) ??
		"local";
	const [ips, setIps] = useState(settings?.["network.allowedIps"] ?? "");
	// Keep the input in sync when settings load or a patch refetches.
	useEffect(() => {
		setIps(settings?.["network.allowedIps"] ?? "");
	}, [settings?.["network.allowedIps"]]);

	if (!showAdvanced) return null;

	const commitIps = () => {
		// Trim stray spaces; keep the raw value otherwise (the engine splits on
		// commas and drops empties).
		const next = ips.replace(/,\s*$/g, "").trim();
		if (next !== (settings?.["network.allowedIps"] ?? "")) {
			patch.mutate({ "network.allowedIps": next });
		}
	};

	const accessModes: {
		value: NetworkAccessMode;
		icon: string;
		label: string;
	}[] = [
		{ value: "local", icon: "lock", label: t("settings.accessLocal") },
		{ value: "all", icon: "public", label: t("settings.accessAll") },
		{ value: "custom", icon: "lan", label: t("settings.accessCustom") },
	];

	return (
		<GhostCard>
			<h3 className="mb-1 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="dns" className="text-base" />
				{t("settings.developerTitle")}
			</h3>
			<p className="mb-4 font-body text-body-sm text-on-surface-variant">
				{t("settings.developerHint")}
			</p>

			{/* The two endpoints a builder cares about. v1.8.1 — the engine ALSO
			    serves the built app at its root, so the frontend URL is the same
			    http://ip:port address as the backend (not the webview-only
			    tauri://… origin). */}
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="rounded border border-outline-variant bg-surface-container-lowest p-3">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.backendUrl")}
					</p>
					<p className="mt-1 truncate font-mono text-mono-technical text-primary">
						{CORE_BASE_URL}
					</p>
				</div>
				<div className="rounded border border-outline-variant bg-surface-container-lowest p-3">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.frontendUrl")}
					</p>
					<p className="mt-1 truncate font-mono text-mono-technical text-primary">
						{CORE_BASE_URL}
					</p>
				</div>
			</div>
			<p className="mt-2 flex items-start gap-1.5 font-body text-body-sm text-on-tertiary-container">
				<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
				<span>{t("settings.sameOriginNote")}</span>
			</p>

			{/* Access mode — who may call the engine. */}
			<div className="mt-5">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("settings.networkAccess")}
				</p>
				<div className="mt-2 grid grid-cols-3 gap-2">
					{accessModes.map((m) => (
						<button
							key={m.value}
							type="button"
							aria-pressed={mode === m.value}
							onClick={() => patch.mutate({ "network.accessMode": m.value })}
							className={`flex flex-col items-center gap-1 border p-3 transition-all ${
								mode === m.value
									? "border-primary bg-surface-container-lowest"
									: "border-outline-variant hover:border-primary"
							}`}
						>
							<Icon
								name={m.icon}
								className={
									mode === m.value
										? "text-primary"
										: "text-on-tertiary-container"
								}
							/>
							<span className="font-label text-label-sm">{m.label}</span>
						</button>
					))}
				</div>
				<p className="mt-2 font-body text-body-sm text-on-surface-variant">
					{mode === "local"
						? t("settings.accessLocalHint")
						: mode === "all"
							? t("settings.accessAllHint")
							: t("settings.accessCustomHint")}
				</p>
			</div>

			{/* Custom IP allowlist. */}
			{mode === "custom" ? (
				<div className="mt-4">
					<label className="font-label text-label-sm uppercase text-on-surface-variant">
						{t("settings.allowedIps")}
					</label>
					<Input
						value={ips}
						onChange={(e) => setIps(e.target.value)}
						onBlur={commitIps}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								(e.target as HTMLInputElement).blur();
							}
						}}
						placeholder="192.168.9.160,10.0.0.5"
						icon="lan"
					/>
					<p className="mt-1 font-body text-body-sm text-on-surface-variant">
						{t("settings.allowedIpsHint")}
					</p>
				</div>
			) : null}

			{/* Where the engine is reachable when it leaves loopback. */}
			{mode !== "local" ? (
				<div className="mt-4 rounded border border-outline-variant bg-surface-container-lowest p-3">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.reachableAt")}
					</p>
					<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
						{network && network.lanIps.length > 0 ? (
							network.lanIps.map((ip) => (
								<span
									key={ip}
									className="font-mono text-mono-technical text-on-surface"
								>
									http://{ip}:{network.port}
								</span>
							))
						) : (
							<span className="font-mono text-mono-technical text-on-surface-variant">
								{network ? "http://0.0.0.0" : "…"}
								{network ? `:${network.port}` : ""}
							</span>
						)}
					</div>
				</div>
			) : null}

			{/* Honest security + restart framing. */}
			{mode !== "local" ? (
				<p className="mt-3 flex items-start gap-2 font-body text-body-sm text-on-surface-variant">
					<Icon name="warning" className="mt-0.5 text-[16px] text-error" />
					<span>{t("settings.networkSecurityNote")}</span>
				</p>
			) : null}
			<p className="mt-2 flex items-start gap-2 font-body text-body-sm text-on-tertiary-container">
				<Icon name="tips_and_updates" className="mt-0.5 text-[16px]" />
				<span>{t("settings.networkRestartNote")}</span>
			</p>
		</GhostCard>
	);
}
