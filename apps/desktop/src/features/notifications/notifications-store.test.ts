import { beforeEach, describe, expect, it, vi } from "vitest";
import { unreadCount, useNotificationsStore } from "./notifications-store.js";

const mocks = vi.hoisted(() => ({
	isTauriShell: vi.fn(),
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

// The OS mirror goes through the real plugin module — it's guarded by
// isTauriShell (false here), so no Tauri calls happen in tests.
vi.mock("@tauri-apps/plugin-notification", () => ({
	isPermissionGranted: vi.fn(async () => true),
	requestPermission: vi.fn(async () => "granted"),
	sendNotification: vi.fn(),
}));

describe("notifications store (v1.8.0)", () => {
	beforeEach(() => {
		mocks.isTauriShell.mockReturnValue(false);
		useNotificationsStore.setState({
			enabled: true,
			osEnabled: false,
			jobFinished: true,
			updateAvailable: true,
			items: [],
			osPermission: null,
		});
	});

	it("pushes a notification and marks it unread", () => {
		useNotificationsStore.getState().push({
			kind: "job",
			title: "Job finished",
			body: "Collect",
		});
		const s = useNotificationsStore.getState();
		expect(s.items).toHaveLength(1);
		expect(s.items[0]?.read).toBe(false);
		expect(unreadCount(s.items)).toBe(1);
	});

	it("respects the master switch and per-kind toggles", () => {
		const push = () =>
			useNotificationsStore.getState().push({
				kind: "job",
				title: "Job finished",
				body: "Collect",
			});
		useNotificationsStore.setState({ enabled: false });
		push();
		expect(useNotificationsStore.getState().items).toHaveLength(0);

		useNotificationsStore.setState({ enabled: true, jobFinished: false });
		push();
		expect(useNotificationsStore.getState().items).toHaveLength(0);
	});

	it("marks all read and clears", () => {
		useNotificationsStore.getState().push({
			kind: "info",
			title: "Hi",
			body: "There",
		});
		useNotificationsStore.getState().markAllRead();
		expect(unreadCount(useNotificationsStore.getState().items)).toBe(0);

		useNotificationsStore.getState().clear();
		expect(useNotificationsStore.getState().items).toHaveLength(0);
	});

	it("caps the list at 50 items", () => {
		const push = useNotificationsStore.getState().push;
		for (let i = 0; i < 60; i++) {
			push({ kind: "info", title: `n${i}`, body: "" });
		}
		expect(useNotificationsStore.getState().items.length).toBeLessThanOrEqual(
			50,
		);
	});
});
