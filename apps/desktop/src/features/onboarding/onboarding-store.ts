/**
 * Onboarding state — purely a frontend concern (whether the welcome flow has
 * been completed or skipped), so it lives in localStorage like the theme and
 * locale.
 *
 *   absent / "pending" → the welcome screen shows on next launch
 *   "done"             → the user finished all three steps
 *   "skipped"          → the user chose to skip — default settings apply
 *                        (news mode, no AI provider, seeded sources)
 */
const KEY = "vorynth.onboarding";

export type OnboardingStatus = "pending" | "done" | "skipped";

/**
 * Where the landing route (`/`) should go: the welcome flow owns first launch,
 * so a never-decided user sees the onboarding; anyone else goes straight to
 * their Brief.
 */
export function resolveHomePath(status: OnboardingStatus): string {
	return status === "pending" ? "/onboarding" : "/brief";
}

export function getOnboardingStatus(): OnboardingStatus {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === "done" || raw === "skipped") return raw;
	} catch {
		/* storage blocked or unavailable — treat as pending */
	}
	return "pending";
}

export function markOnboardingDone(): void {
	localStorage.setItem(KEY, "done");
}

export function markOnboardingSkipped(): void {
	localStorage.setItem(KEY, "skipped");
}

/** Back to "show the welcome on next launch" (the Settings toggle turned ON). */
export function resetOnboarding(): void {
	localStorage.removeItem(KEY);
}
