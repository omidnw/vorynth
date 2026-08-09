import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildTarget,
	detectMacArch,
	detectOs,
	fetchLatestRelease,
	platformDownloadLinks,
	resolveDownload,
	type ReleaseAsset,
} from "./download";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("buildTarget", () => {
	const base = "https://github.com/omidnw/vorynth/releases/download/v1.8.0/";

	it("windows x64 → x64 setup executable", () => {
		const t = buildTarget("windows", "x64", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_x64-setup.exe`);
		expect(t.label).toBe("Download for Windows");
		expect(t.platText).toBe("Windows");
	});

	it("windows arm → arm64 setup executable", () => {
		const t = buildTarget("windows", "arm", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_arm64-setup.exe`);
		expect(t.label).toBe("Download for Windows (ARM64)");
		expect(t.platText).toBe("Windows (ARM64)");
	});

	it("macOS Apple Silicon → aarch64 dmg", () => {
		const t = buildTarget("mac", "arm", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_aarch64.dmg`);
		expect(t.label).toBe("Download for macOS (Apple Silicon)");
	});

	it("macOS Intel → x64 dmg", () => {
		const t = buildTarget("mac", "intel", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_x64.dmg`);
		expect(t.label).toBe("Download for macOS (Intel)");
		expect(t.platText).toBe("macOS (Intel)");
	});

	it("macOS unknown arch → fall back to releases page", () => {
		const t = buildTarget("mac", "unknown", "1.8.0");
		expect(t.url).toBe("https://github.com/omidnw/vorynth/releases");
		expect(t.label).toBe("See all downloads");
	});

	it("Linux x86_64 → AppImage", () => {
		const t = buildTarget("linux", "x64", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_amd64.AppImage`);
		expect(t.label).toBe("Download for Linux (x86_64)");
	});

	it("Linux ARM64 → deb", () => {
		const t = buildTarget("linux", "arm", "1.8.0");
		expect(t.url).toBe(`${base}Vorynth_1.8.0_arm64.deb`);
		expect(t.label).toBe("Download for Linux (ARM64)");
	});

	it("FreeBSD → tarball", () => {
		const t = buildTarget("freebsd", "x64", "1.8.0");
		expect(t.url).toBe(`${base}vorynth-freebsd-x64.tar`);
		expect(t.label).toBe("Download for FreeBSD");
	});

	it("unknown OS → releases page", () => {
		const t = buildTarget("other", "x64", "1.8.0");
		expect(t.url).toBe("https://github.com/omidnw/vorynth/releases");
		expect(t.label).toBe("See all downloads");
	});
});

describe("detectOs", () => {
	it("detects each platform from UA/platform strings", () => {
		expect(detectOs("MacIntel", "")).toBe("mac");
		expect(detectOs("", "Win32")).toBe("windows");
		expect(detectOs("", "Linux x86_64")).toBe("linux");
		expect(detectOs("Mozilla", "FreeBSD x86_64")).toBe("freebsd");
		expect(detectOs("", "unknown")).toBe("other");
	});

	it("excludes Android from Linux detection", () => {
		expect(detectOs("Mozilla Android", "Linux")).toBe("other");
	});
});

describe("detectMacArch", () => {
	it("ETC2 extension → Apple Silicon", () => {
		expect(detectMacArch(() => ["WEBGL_compressed_texture_etc"])).toBe("arm");
	});
	it("no ETC2 extension → Intel", () => {
		expect(detectMacArch(() => ["WEBGL_compressed_texture_s3tc"])).toBe(
			"intel",
		);
	});
	it("null WebGL context → unknown", () => {
		expect(detectMacArch(() => null)).toBe("unknown");
	});
	it("missing canvas → unknown", () => {
		expect(detectMacArch(null)).toBe("unknown");
	});
});

describe("resolveDownload", () => {
	const canvasWith = (extensions: string[]) => () => ({
		getContext: () => ({ getSupportedExtensions: () => extensions }),
	});

	it("Mac Apple Silicon → aarch64 dmg", async () => {
		const t = await resolveDownload({
			ua: "MacIntel",
			platform: "MacIntel",
			makeCanvas: canvasWith(["WEBGL_compressed_texture_etc"]),
		});
		expect(t.url).toContain("aarch64.dmg");
	});

	it("Windows ARM via client hints → arm64 exe", async () => {
		const t = await resolveDownload({
			ua: "",
			platform: "Win32",
			hints: { getHighEntropyValues: async () => ({ architecture: "arm" }) },
			makeCanvas: () => null,
		});
		expect(t.url).toContain("arm64-setup.exe");
	});

	it("Windows without hints → x64 exe", async () => {
		const t = await resolveDownload({
			ua: "",
			platform: "Win32",
			makeCanvas: () => null,
		});
		expect(t.url).toContain("x64-setup.exe");
	});

	it("Linux aarch64 UA → arm64 deb", async () => {
		const t = await resolveDownload({
			ua: "aarch64",
			platform: "Linux",
			makeCanvas: () => null,
		});
		expect(t.url).toContain("arm64.deb");
	});

	it("Linux x86-64 via client hints → AppImage", async () => {
		const t = await resolveDownload({
			ua: "",
			platform: "Linux",
			hints: {
				getHighEntropyValues: async () => ({
					architecture: "x86",
					bitness: "64",
				}),
			},
			makeCanvas: () => null,
		});
		expect(t.url).toContain("amd64.AppImage");
	});

	it("FreeBSD → tarball", async () => {
		const t = await resolveDownload({
			ua: "",
			platform: "FreeBSD",
			makeCanvas: () => null,
		});
		expect(t.url).toContain("vorynth-freebsd-x64.tar");
	});

	it("unknown platform → releases page", async () => {
		const t = await resolveDownload({
			ua: "Mozilla/5.0",
			platform: "",
			makeCanvas: () => null,
		});
		expect(t.url).toBe("https://github.com/omidnw/vorynth/releases");
	});
});

describe("fetchLatestRelease", () => {
	it("returns the tagged version and asset list from the GitHub API", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					tag_name: "v1.9.0",
					assets: [
						{
							name: "Vorynth_1.9.0_x64-setup.exe",
							browser_download_url: "https://d/x.exe",
						},
						{ name: "broken", browser_download_url: null },
					],
				}),
			}),
		);
		const release = await fetchLatestRelease();
		expect(release?.version).toBe("1.9.0");
		expect(release?.assets).toEqual([
			{ name: "Vorynth_1.9.0_x64-setup.exe", url: "https://d/x.exe" },
		]);
	});

	it("returns null on a non-2xx response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 403 }),
		);
		expect(await fetchLatestRelease()).toBeNull();
	});

	it("returns null on a malformed body (no tag_name)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ items: [] }),
			}),
		);
		expect(await fetchLatestRelease()).toBeNull();
	});

	it("returns null when fetch throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		expect(await fetchLatestRelease()).toBeNull();
	});
});

describe("platformDownloadLinks", () => {
	const ASSETS: ReleaseAsset[] = [
		{ name: "Vorynth_1.9.0_x64-setup.exe", url: "https://d/x64.exe" },
		{ name: "Vorynth_1.9.0_arm64-setup.exe", url: "https://d/arm64.exe" },
		{ name: "Vorynth_1.9.0_amd64.AppImage", url: "https://d/appimage" },
		{ name: "Vorynth_1.9.0_arm64.deb", url: "https://d/arm64.deb" },
		{ name: "Vorynth_1.9.0_amd64.deb", url: "https://d/amd64.deb" },
		{ name: "Vorynth_1.9.0_aarch64.dmg", url: "https://d/arm.dmg" },
		{ name: "vorynth-freebsd-x64.tar.gz", url: "https://d/freebsd" },
		// updater signatures must not surface as downloads
		{ name: "Vorynth_1.9.0_x64-setup.exe.sig", url: "https://d/x64.exe.sig" },
		{ name: "Vorynth_1.9.0_aarch64.dmg.sig", url: "https://d/arm.dmg.sig" },
	];

	it("windows → both setups, labeled by arch, no .sig files", () => {
		const links = platformDownloadLinks("windows", "1.8.0", ASSETS);
		expect(links).toEqual([
			{
				label: "Windows (x86_64) — setup.exe",
				url: "https://d/x64.exe",
				hint: "Runs the installer — auto-updates afterwards.",
			},
			{
				label: "Windows (ARM64) — setup.exe",
				url: "https://d/arm64.exe",
				hint: "Runs the installer — auto-updates afterwards.",
			},
		]);
	});

	it("linux → AppImage, deb, and rpm flavours with distro-family labels", () => {
		const links = platformDownloadLinks("linux", "1.8.0", [
			...ASSETS,
			{ name: "Vorynth_1.9.0_arm64.rpm", url: "https://d/arm64.rpm" },
		]);
		expect(links.map((l) => l.label)).toEqual([
			"AppImage — any glibc-based distro",
			"DEB — Debian & Ubuntu",
			"DEB — Debian & Ubuntu",
			"RPM — Fedora & RHEL",
		]);
	});

	it("linux hints separate deb vs rpm vs AppImage by distro family + arch", () => {
		const links = platformDownloadLinks("linux", "1.8.0", [
			{ name: "Vorynth_1.9.0_amd64.AppImage", url: "https://d/appimage" },
			{ name: "Vorynth_1.9.0_arm64.deb", url: "https://d/arm64.deb" },
			{ name: "Vorynth_1.9.0_x64.rpm", url: "https://d/x64.rpm" },
		]);
		expect(links.map((l) => l.hint)).toEqual([
			"x86_64 · no install — download, make executable, run.",
			"ARM64 · Debian, Ubuntu, Mint, Pop!_OS and more.",
			"x86_64 · Fedora, RHEL, Rocky, AlmaLinux and more.",
		]);
	});

	it("mac → both DMGs (Apple Silicon + Intel) plus the Homebrew cask command", () => {
		const links = platformDownloadLinks("mac", "1.8.0", [
			...ASSETS,
			{ name: "Vorynth_1.9.0_x64.dmg", url: "https://d/intel.dmg" },
		]);
		expect(links).toEqual([
			{
				label: "macOS (Apple Silicon) — DMG",
				url: "https://d/arm.dmg",
				hint: "Drag the app to your Applications folder.",
			},
			{
				label: "macOS (Intel) — DMG",
				url: "https://d/intel.dmg",
				hint: "Drag the app to your Applications folder.",
			},
			{
				label: "Homebrew",
				command: "brew tap omidnw/vorynth\nbrew install --cask vorynth",
				hint: "Recommended — installs and auto-updates via Homebrew.",
			},
		]);
	});

	it("freebsd → the tarball", () => {
		const links = platformDownloadLinks("freebsd", "1.8.0", ASSETS);
		expect(links).toEqual([
			{
				label: "FreeBSD (x86_64) — tarball",
				url: "https://d/freebsd",
				hint: "Native FreeBSD build — extract and run.",
			},
		]);
	});

	it("falls back to the bundled-version links when the API has no assets", () => {
		const links = platformDownloadLinks("windows", "1.8.0", null);
		expect(links).toEqual([
			{
				label: "Download for Windows",
				url: "https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_x64-setup.exe",
			},
			{
				label: "Download for Windows (ARM64)",
				url: "https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_arm64-setup.exe",
			},
		]);
	});

	it("falls back when the release has no matching asset (e.g. no dmg published)", () => {
		const links = platformDownloadLinks("mac", "1.8.0", [
			{ name: "Vorynth_1.9.0_x64-setup.exe", url: "https://d/x64.exe" },
		]);
		expect(links).toEqual([
			{
				label: "Download for macOS (Apple Silicon)",
				url: "https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_aarch64.dmg",
			},
			{
				label: "Download for macOS (Intel)",
				url: "https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_x64.dmg",
			},
			{
				label: "Homebrew",
				command: "brew tap omidnw/vorynth\nbrew install --cask vorynth",
				hint: "Recommended — installs and auto-updates via Homebrew.",
			},
		]);
	});

	it("linux fallback still separates AppImage / deb / rpm by distro family", () => {
		const links = platformDownloadLinks("linux", "1.8.0", null);
		expect(links.map((l) => l.label)).toEqual([
			"AppImage — any glibc-based distro",
			"AppImage — any glibc-based distro",
			"DEB — Debian & Ubuntu",
			"DEB — Debian & Ubuntu",
			"RPM — Fedora & RHEL",
			"RPM — Fedora & RHEL",
		]);
		expect(links.map((l) => l.url)).toEqual([
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_amd64.AppImage",
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_aarch64.AppImage",
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_amd64.deb",
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth_1.8.0_arm64.deb",
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth-1.8.0-1.x86_64.rpm",
			"https://github.com/omidnw/vorynth/releases/download/v1.8.0/Vorynth-1.8.0-1.aarch64.rpm",
		]);
	});
});
