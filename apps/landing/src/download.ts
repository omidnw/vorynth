import { VORYNTH_VERSION } from "@vorynth/types";

export interface DownloadTarget {
	url: string;
	label: string;
	platText: string;
}

export type DetectedOs = "windows" | "mac" | "linux" | "freebsd" | "other";
export type DetectedArch = "arm" | "x64" | "intel" | "unknown";

/** Structural type for `navigator.userAgentData` (Client Hints) so tests can
 *  inject a fake without touching the global. */
export interface ArchHints {
	getHighEntropyValues?: (
		hints: string[],
	) => Promise<{ architecture?: string; bitness?: string }>;
}

export const RELEASES_URL = "https://github.com/omidnw/vorynth/releases";

/** Map an OS + arch to the exact release asset. Asset names mirror the repo's
 *  packaging workflow (package.yml). */
export function buildTarget(
	os: DetectedOs,
	arch: DetectedArch,
	version: string,
): DownloadTarget {
	const tag = `v${version}`;
	const base = `https://github.com/omidnw/vorynth/releases/download/${tag}/`;
	let asset: string | null = null;
	let label = "See all downloads";
	let platText = "";

	if (os === "windows") {
		if (arch === "arm") {
			asset = `Vorynth_${version}_arm64-setup.exe`;
			label = "Download for Windows (ARM64)";
			platText = "Windows (ARM64)";
		} else {
			asset = `Vorynth_${version}_x64-setup.exe`;
			label = "Download for Windows";
			platText = "Windows";
		}
	} else if (os === "mac") {
		if (arch === "arm") {
			asset = `Vorynth_${version}_aarch64.dmg`;
			label = "Download for macOS (Apple Silicon)";
			platText = "macOS (Apple Silicon)";
		} else if (arch === "intel") {
			// DMG arch suffix is "x64" for Intel (tauri-bundler), "aarch64" for ARM.
			asset = `Vorynth_${version}_x64.dmg`;
			label = "Download for macOS (Intel)";
			platText = "macOS (Intel)";
		} else {
			label = "See all downloads";
			platText = "macOS \u2014 detection failed";
		}
	} else if (os === "linux") {
		if (arch === "arm") {
			asset = `Vorynth_${version}_arm64.deb`;
			label = "Download for Linux (ARM64)";
			platText = "Linux (ARM64)";
		} else {
			asset = `Vorynth_${version}_amd64.AppImage`;
			label = "Download for Linux (x86_64)";
			platText = "Linux (x86_64)";
		}
	} else if (os === "freebsd") {
		asset = "vorynth-freebsd-x64.tar";
		label = "Download for FreeBSD";
		platText = "FreeBSD";
	}

	return { url: asset ? `${base}${asset}` : RELEASES_URL, label, platText };
}

/** OS detection from the UA string + navigator.platform (port of the original
 *  landing-page script; Mac is detected by UA, the rest by platform). */
export function detectOs(ua: string, platform: string): DetectedOs {
	if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(ua)) return "mac";
	if (/Win/.test(platform)) return "windows";
	if (/Linux/.test(platform) && !/Android/.test(ua)) return "linux";
	if (/FreeBSD/.test(platform)) return "freebsd";
	return "other";
}

/** Apple Silicon detection: the ETC2 texture extension is only advertised on
 *  Apple Silicon in Safari/WebKit (port of the original canvas heuristic). */
export function detectMacArch(
	getExtensions: (() => string[] | null) | null,
): DetectedArch {
	if (!getExtensions) return "unknown";
	try {
		const extensions = getExtensions();
		// null context (headless / WebGL disabled) — cannot tell.
		if (extensions === null) return "unknown";
		return extensions.indexOf("WEBGL_compressed_texture_etc") !== -1
			? "arm"
			: "intel";
	} catch {
		return "unknown";
	}
}

/** ARM detection from the UA string (Firefox, Safari, older Chromium). */
export function detectArchFromUa(ua: string): "arm" | "x64" {
	return /arm|aarch64/i.test(ua) ? "arm" : "x64";
}

async function archFromClientHints(
	hints: ArchHints | undefined,
	fallback: "arm" | "x64",
): Promise<"arm" | "x64"> {
	if (hints?.getHighEntropyValues) {
		try {
			const h = await hints.getHighEntropyValues(["architecture", "bitness"]);
			if (h.architecture === "arm") return "arm";
			if (h.architecture === "x86" && h.bitness === "64") return "x64";
		} catch {
			/* hints unavailable — fall through to the UA heuristic */
		}
	}
	return fallback;
}

export interface DownloadEnv {
	ua: string;
	platform: string;
	hints?: ArchHints;
	/** Returns a canvas (or null when canvas is unavailable). The getContext
	 *  signature is loosened to string so test doubles and HTMLCanvasElement
	 *  both satisfy it. */
	makeCanvas: () => {
		getContext: (type: string) => {
			getSupportedExtensions: () => string[] | null;
		} | null;
	} | null;
}

/** Adapt a real HTMLCanvasElement to the minimal structural shape the
 *  detection code needs (avoids tightening DownloadEnv to the full DOM type
 *  just for a feature-detect). Returns null when the canvas/context is missing
 *  or isn't a WebGL context. */
export function adaptCanvas(
	canvas: HTMLCanvasElement | null,
): ReturnType<DownloadEnv["makeCanvas"]> {
	if (!canvas) return null;
	return {
		getContext: (type: string) => {
			const ctx = canvas.getContext(type);
			if (ctx && "getSupportedExtensions" in ctx) {
				return {
					getSupportedExtensions: () =>
						(ctx as WebGLRenderingContext).getSupportedExtensions(),
				};
			}
			return null;
		},
	};
}

/** Full pipeline: detect the platform, then resolve the concrete download. */
export async function resolveDownload(
	env: DownloadEnv,
): Promise<DownloadTarget> {
	const { ua, platform, hints, makeCanvas } = env;
	const os = detectOs(ua, platform);
	let arch: DetectedArch = "unknown";

	if (os === "windows") {
		arch = await archFromClientHints(hints, "x64");
	} else if (os === "mac") {
		const canvas = makeCanvas();
		arch = detectMacArch(
			() => canvas?.getContext("webgl")?.getSupportedExtensions() ?? null,
		);
	} else if (os === "linux") {
		arch = await archFromClientHints(hints, detectArchFromUa(ua));
	} else if (os === "freebsd") {
		arch = "x64";
	}

	return buildTarget(os, arch, VORYNTH_VERSION);
}

/** Platforms with native installers in the release assets. */
export type PlatformKey = "mac" | "windows" | "linux" | "freebsd";

export interface ReleaseAsset {
	name: string;
	url: string;
}

export interface LatestRelease {
	version: string;
	assets: ReleaseAsset[];
}

export interface DownloadLink {
	label: string;
	/** Direct download URL — omitted for command-based installs (Homebrew). */
	url?: string;
	/** Shell command to run instead of a download (e.g. the Homebrew cask). */
	command?: string;
	/** Short context line shown under the link (e.g. which distro family). */
	hint?: string;
}

const GITHUB_API_LATEST =
	"https://api.github.com/repos/omidnw/vorynth/releases/latest";

/** Fetch the latest release from the GitHub API (public repo, no auth). Returns
 *  null on any failure — network, non-2xx, or a malformed body — so callers
 *  can fall back to the bundled VORYNTH_VERSION. */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
	try {
		const res = await fetch(GITHUB_API_LATEST, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (!data || typeof data.tag_name !== "string" || !data.tag_name) {
			return null;
		}
		const assets: ReleaseAsset[] = Array.isArray(data.assets)
			? data.assets
					.filter(
						(a: { name?: unknown; browser_download_url?: unknown }) =>
							typeof a?.name === "string" &&
							typeof a?.browser_download_url === "string",
					)
					.map((a: { name: string; browser_download_url: string }) => ({
						name: a.name,
						url: a.browser_download_url,
					}))
			: [];
		return { version: data.tag_name.replace(/^v/, ""), assets };
	} catch {
		return null;
	}
}

/** Asset-name pattern per platform (asset names mirror the packaging workflow,
 *  package.yml). */
const PLATFORM_PATTERNS: Record<PlatformKey, RegExp> = {
	windows: /-setup\.exe$/i,
	mac: /\.dmg$/i,
	linux: /\.(AppImage|deb|rpm)$/i,
	freebsd: /^vorynth-freebsd/i,
};

/** Homebrew cask install — shown alongside the macOS DMG. */
const HOMEBREW_ENTRY: DownloadLink = {
	label: "Homebrew",
	command: "brew tap omidnw/vorynth\nbrew install --cask vorynth",
	hint: "Recommended — installs and auto-updates via Homebrew.",
};

/** Label + context hint for a release asset on a given platform. */
function labelAsset(
	name: string,
	key: PlatformKey,
): Pick<DownloadLink, "label" | "hint"> {
	if (key === "mac") {
		if (/aarch64|arm64/i.test(name)) {
			return {
				label: "macOS (Apple Silicon) — DMG",
				hint: "Drag the app to your Applications folder.",
			};
		}
		if (/x64|x86_64|amd64/i.test(name)) {
			return {
				label: "macOS (Intel) — DMG",
				hint: "Drag the app to your Applications folder.",
			};
		}
		return {
			label: "macOS — DMG",
			hint: "Drag the app to your Applications folder.",
		};
	}
	if (key === "windows") {
		return {
			label: /arm64/i.test(name)
				? "Windows (ARM64) — setup.exe"
				: "Windows (x86_64) — setup.exe",
			hint: "Runs the installer — auto-updates afterwards.",
		};
	}
	if (key === "linux") {
		const arch = /arm64|aarch64/i.test(name) ? "ARM64" : "x86_64";
		if (/\.AppImage$/i.test(name)) {
			return {
				label: "AppImage — any glibc-based distro",
				hint: `${arch} · no install — download, make executable, run.`,
			};
		}
		if (/\.rpm$/i.test(name)) {
			return {
				label: "RPM — Fedora & RHEL",
				hint: `${arch} · Fedora, RHEL, Rocky, AlmaLinux and more.`,
			};
		}
		return {
			label: "DEB — Debian & Ubuntu",
			hint: `${arch} · Debian, Ubuntu, Mint, Pop!_OS and more.`,
		};
	}
	return {
		label: "FreeBSD (x86_64) — tarball",
		hint: "Native FreeBSD build — extract and run.",
	};
}

/** Direct download URL for a named release asset (mirrors package.yml naming). */
function releaseAssetUrl(version: string, asset: string): string {
	return `https://github.com/omidnw/vorynth/releases/download/v${version}/${asset}`;
}

/** Linux is shipped three ways (AppImage + deb + rpm, each in two archs) — the
 *  fallback must show the same distro-family split the API path does. */
function linuxFallback(version: string): DownloadLink[] {
	const url = (asset: string) => releaseAssetUrl(version, asset);
	return [
		{
			label: "AppImage — any glibc-based distro",
			url: url(`Vorynth_${version}_amd64.AppImage`),
			hint: "x86_64 · no install — download, make executable, run.",
		},
		{
			label: "AppImage — any glibc-based distro",
			url: url(`Vorynth_${version}_aarch64.AppImage`),
			hint: "ARM64 · no install — download, make executable, run.",
		},
		{
			label: "DEB — Debian & Ubuntu",
			url: url(`Vorynth_${version}_amd64.deb`),
			hint: "x86_64 · Debian, Ubuntu, Mint, Pop!_OS and more.",
		},
		{
			label: "DEB — Debian & Ubuntu",
			url: url(`Vorynth_${version}_arm64.deb`),
			hint: "ARM64 · Debian, Ubuntu, Mint, Pop!_OS and more.",
		},
		{
			label: "RPM — Fedora & RHEL",
			url: url(`Vorynth-${version}-1.x86_64.rpm`),
			hint: "x86_64 · Fedora, RHEL, Rocky, AlmaLinux and more.",
		},
		{
			label: "RPM — Fedora & RHEL",
			url: url(`Vorynth-${version}-1.aarch64.rpm`),
			hint: "ARM64 · Fedora, RHEL, Rocky, AlmaLinux and more.",
		},
	];
}

/** Fallback links assembled from the bundled version when the GitHub API is
 *  unreachable. */
function fallbackLinks(key: PlatformKey, version: string): DownloadLink[] {
	const pair = (os: DetectedOs, arch: DetectedArch): DownloadLink => {
		const t = buildTarget(os, arch, version);
		return { label: t.label, url: t.url };
	};
	switch (key) {
		case "windows":
			return [pair("windows", "x64"), pair("windows", "arm")];
		case "mac":
			return [pair("mac", "arm"), pair("mac", "intel")];
		case "linux":
			return linuxFallback(version);
		case "freebsd":
			return [pair("freebsd", "x64")];
	}
}

/** Download links for a platform — filtered from the live GitHub release when
 *  available, otherwise built from the bundled VORYNTH_VERSION. */
export function platformDownloadLinks(
	key: PlatformKey,
	version: string,
	releaseAssets: ReleaseAsset[] | null,
): DownloadLink[] {
	let links: DownloadLink[];
	if (releaseAssets && releaseAssets.length > 0) {
		const hits = releaseAssets.filter((a) => PLATFORM_PATTERNS[key].test(a.name));
		links =
			hits.length > 0
				? hits.map((a) => ({
						label: labelAsset(a.name, key).label,
						url: a.url,
						hint: labelAsset(a.name, key).hint,
					}))
				: fallbackLinks(key, version);
	} else {
		links = fallbackLinks(key, version);
	}
	// macOS always offers the Homebrew cask alongside the DMG.
	return key === "mac" ? [...links, HOMEBREW_ENTRY] : links;
}
