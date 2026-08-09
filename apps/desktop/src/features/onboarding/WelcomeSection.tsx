import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
	getOnboardingStatus,
	markOnboardingSkipped,
	resetOnboarding,
	type OnboardingStatus,
} from "./onboarding-store.js";

/**
 * Welcome & Setup (v1.8.0) — the Settings home for the onboarding flow.
 *
 * The toggle controls whether the welcome screen shows on startup (OFF =
 * skipped → default settings apply). The button re-opens the welcome flow any
 * time, so skipping never locks anyone out.
 */
export function WelcomeSection() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [status, setStatus] = useState<OnboardingStatus>(() =>
		getOnboardingStatus(),
	);

	const showOnLaunch = status === "pending";

	const setShowOnLaunch = (on: boolean) => {
		if (on) {
			// Back to "show the welcome on next launch".
			resetOnboarding();
			setStatus("pending");
		} else {
			markOnboardingSkipped();
			setStatus("skipped");
		}
	};

	const statusLabel =
		status === "done"
			? t("settings.welcomeStatusDone")
			: status === "skipped"
				? t("settings.welcomeStatusSkipped")
				: t("settings.welcomeStatusPending");

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="rocket_launch" className="text-base" />
				{t("settings.welcome")}
			</h3>
			<Toggle
				icon="rocket_launch"
				label={t("settings.showWelcome")}
				hint={t("settings.showWelcomeHint")}
				checked={showOnLaunch}
				onChange={setShowOnLaunch}
			/>
			<div className="mt-2 flex flex-wrap items-center justify-between gap-3">
				<p className="font-body text-body-sm text-on-tertiary-container">
					{statusLabel}
				</p>
				<Button
					variant="secondary"
					size="sm"
					icon="rocket_launch"
					onClick={() => navigate("/onboarding")}
				>
					{t("settings.openWelcome")}
				</Button>
			</div>
		</GhostCard>
	);
}
