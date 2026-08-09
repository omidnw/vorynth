import i18n from "i18next";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { useUpdaterStore } from "@/features/updater/updater-store.js";
import { useNotificationsStore } from "./notifications-store.js";

/**
 * Notification sources (v1.8.0) — wires real events into the notification
 * center. Called once from the app root (next to the other bridges):
 *
 *   • jobs: watches the jobs store (polled every 2s while active) and pushes
 *     a notification the moment a job leaves `active` for a terminal state.
 *   • updates: pushes once per new version when the updater store reports one.
 *
 * Both respect the `notifications.*` master switches inside the store.
 */

let started = false;
/** Job ids already announced — a terminal job is only announced once. */
const announcedJobs = new Set<string>();
/** Versions already announced — the update ping fires once per version. */
let announcedVersion: string | null = null;

export function startNotificationWatchers(): void {
	if (started) return;
	started = true;

	// Seed with existing terminal jobs so a boot never re-announces old work.
	for (const job of useJobsStore.getState().jobs.recent) {
		announcedJobs.add(job.id);
	}

	useJobsStore.subscribe((state) => {
		for (const job of state.jobs.recent) {
			if (announcedJobs.has(job.id)) continue;
			announcedJobs.add(job.id);
			if (job.status === "canceled") continue;
			useNotificationsStore.getState().push(
				job.status === "error"
					? {
							kind: "job",
							title: i18n.t("notifications.jobFailedTitle"),
							body: `${job.label}: ${job.error ?? ""}`.trim(),
						}
					: {
							kind: "job",
							title: i18n.t("notifications.jobDoneTitle"),
							body: job.label,
						},
			);
		}
	});

	useUpdaterStore.subscribe((state) => {
		if (
			state.phase.kind === "available" &&
			state.available &&
			state.available.version !== announcedVersion
		) {
			announcedVersion = state.available.version;
			useNotificationsStore.getState().push({
				kind: "update",
				title: i18n.t("notifications.updateTitle", {
					version: state.available.version,
				}),
				body: i18n.t("notifications.updateBody"),
			});
		}
	});
}
