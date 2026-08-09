import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import {
	pushBackgroundMode,
	pushLaunchAtLogin,
} from "@/features/settings/launch-behavior-bridge.js";
import type { AppSettings } from "@vorynth/types";

/**
 * Launch behavior (v1.8.0) — how Vorynth starts and stays alive:
 *
 * - "Launch at login": starts automatically when the user signs in to the
 *   computer. The shell writes the OS-level hook (macOS Login Items via a
 *   LaunchAgent, Windows Startup apps via the Run key, Linux Startup
 *   Applications via an XDG .desktop file).
 * - "Start without a window": the window is created invisible (read by the
 *   shell from `ui.startHidden` at launch, so there is no flash) — Vorynth
 *   starts in the menu bar and the tray or Dock brings the window back.
 * - "Run in background": closing the window hides Vorynth to the system tray
 *   instead of quitting — the engine keeps collecting in the background, and
 *   the tray (or a new launch) brings the window back. Quit from the tray to
 *   fully exit.
 *
 * The first and third persist in the engine's settings (`ui.launchAtStartup`,
 * `ui.backgroundMode`) and are pushed to the shell at boot + on toggle
 * (`set_autostart` / `set_background_mode` IPC); `ui.startHidden` is read by
 * the shell at launch (see LaunchBehaviorBridge for the boot pushes).
 */

/** What the OS calls the autostart location — macOS "Login Items", Windows
 * "Startup apps", Linux "Startup Applications" (confirmed via external
 * consult: the neutral label stays "Launch at login"). */
function autostartHint(t: (key: string) => string): string {
	const platform = typeof navigator !== "undefined" ? navigator.platform : "";
	if (/mac/i.test(platform)) return t("settings.launchHintMac");
	if (/win/i.test(platform)) return t("settings.launchHintWindows");
	return t("settings.launchHintLinux");
}

export function LaunchSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const launchAtLogin = settings?.["ui.launchAtStartup"] === true;
	const startHidden = settings?.["ui.startHidden"] === true;
	const backgroundMode = settings?.["ui.backgroundMode"] === true;

	// Tell the shell the persisted values as soon as settings are known — a
	// session that ended with either on must keep its behavior on close/next
	// launch. (The root LaunchBehaviorBridge covers the never-opened-Settings
	// case.)
	useEffect(() => {
		if (settings === undefined) return;
		void pushBackgroundMode(backgroundMode);
		void pushLaunchAtLogin(launchAtLogin);
	}, [settings, backgroundMode, launchAtLogin]);

	const setLaunchAtLogin = (on: boolean) => {
		patch.mutate({ "ui.launchAtStartup": on });
		void pushLaunchAtLogin(on);
	};

	// Start-without-a-window is read by the shell at launch (it creates the
	// window invisible); toggling here only persists the value — no IPC.
	const setStartHidden = (on: boolean) => {
		patch.mutate({ "ui.startHidden": on });
	};

	const setBackgroundMode = (on: boolean) => {
		patch.mutate({ "ui.backgroundMode": on });
		void pushBackgroundMode(on);
	};

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="rocket_launch" className="text-base" />
				{t("settings.launchTitle")}
			</h3>
			<Toggle
				icon="login"
				label={t("settings.launchAtLogin")}
				hint={autostartHint(t)}
				checked={launchAtLogin}
				onChange={setLaunchAtLogin}
			/>
			<Toggle
				icon="visibility_off"
				label={t("settings.startHiddenLabel")}
				hint={t("settings.startHiddenHint")}
				checked={startHidden}
				onChange={setStartHidden}
			/>
			<Toggle
				icon="hide_image"
				label={t("settings.backgroundLabel")}
				hint={t("settings.backgroundHint")}
				checked={backgroundMode}
				onChange={setBackgroundMode}
			/>
			<p className="mt-3 flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
				<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
				<span>{t("settings.backgroundTip")}</span>
			</p>
		</GhostCard>
	);
}
