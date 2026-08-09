import { create } from "zustand";
import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";

/**
 * Notification center (v1.8.0) — the bell in the top bar.
 *
 * In-app notifications (a persisted, capped list in localStorage) for the
 * events that matter: jobs finishing, a new version being available. When the
 * user opts in, the same events also go to the OS notification center via
 * `tauri-plugin-notification`.
 *
 * Settings (`notifications.*` engine app-settings) are applied to the store by
 * the NotificationCenter component after `fetchSettings` resolves; the
 * watchers (`startNotificationWatchers`) only push when the master switches
 * are on.
 */

export type NotificationKind = "job" | "update" | "info";

export interface AppNotification {
	id: string;
	kind: NotificationKind;
	title: string;
	body: string;
	/** ISO timestamp. */
	time: string;
	read: boolean;
}

const STORAGE_KEY = "vorynth.notifications";
const MAX_ITEMS = 50;

function loadItems(): AppNotification[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
	} catch {
		return [];
	}
}

function persistItems(items: AppNotification[]): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify(items.slice(0, MAX_ITEMS)),
	);
}

export interface NotificationSettings {
	/** Master switch — the whole center is off. */
	enabled: boolean;
	/** Mirror events to the OS notification center too. */
	osEnabled: boolean;
	/** Notify when a background job finishes (done or failed). */
	jobFinished: boolean;
	/** Notify when a new version is available. */
	updateAvailable: boolean;
}

interface NotificationsState extends NotificationSettings {
	items: AppNotification[];
	/** Lazily-known OS permission state ("granted" | "denied" | null). */
	osPermission: "granted" | "denied" | null;

	/** Apply persisted app-settings to the store (called on boot/settings load). */
	applySettings: (patch: Partial<NotificationSettings>) => void;
	push: (n: { kind: NotificationKind; title: string; body: string }) => void;
	markRead: (id: string) => void;
	markAllRead: () => void;
	clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
	enabled: true,
	osEnabled: false,
	jobFinished: true,
	updateAvailable: true,
	items: loadItems(),
	osPermission: null,

	applySettings: (patch) => set(patch),

	push: ({ kind, title, body }) => {
		const s = get();
		if (!s.enabled) return;
		if (kind === "job" && !s.jobFinished) return;
		if (kind === "update" && !s.updateAvailable) return;

		const notification: AppNotification = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			kind,
			title,
			body,
			time: new Date().toISOString(),
			read: false,
		};
		const items = [notification, ...s.items].slice(0, MAX_ITEMS);
		persistItems(items);
		set({ items });

		// OS mirror — opt-in, packaged shell only.
		if (s.osEnabled && isTauriShell()) {
			void (async () => {
				try {
					let granted = await isPermissionGranted();
					if (!granted) {
						granted = (await requestPermission()) === "granted";
					}
					set({ osPermission: granted ? "granted" : "denied" });
					if (granted) {
						sendNotification({ title, body });
					}
				} catch {
					// Never crash the app over a system notification.
				}
			})();
		}
	},

	markRead: (id) =>
		set((s) => {
			const items = s.items.map((n) =>
				n.id === id ? { ...n, read: true } : n,
			);
			persistItems(items);
			return { items };
		}),

	markAllRead: () =>
		set((s) => {
			const items = s.items.map((n) => ({ ...n, read: true }));
			persistItems(items);
			return { items };
		}),

	clear: () => {
		persistItems([]);
		set({ items: [] });
	},
}));

/** Unread count helper (kept as a selector-friendly accessor). */
export function unreadCount(items: AppNotification[]): number {
	return items.filter((n) => !n.read).length;
}
