import { useEffect, useRef, useState } from "react";
import { VORYNTH_VERSION } from "@vorynth/types";
import { RELEASES_URL, type Platform } from "../content";
import {
	fetchLatestRelease,
	platformDownloadLinks,
	type DownloadLink,
	type PlatformKey,
} from "../download";
import { Icon } from "./Icon";

const GUIDE_URL = "https://github.com/omidnw/vorynth/blob/master/docs/GUIDE.md";

const APPLE_GATEKEEPER_URL =
	"https://support.apple.com/en-ie/guide/mac-help/mh40616/mac";

/** macOS Gatekeeper caveat — Vorynth is distributed free by an individual
 *  without a paid Apple Developer account, so macOS can't verify the developer
 *  and shows "unknown developer". Shown as the "?" toggle in the macOS box. */
const MACOS_GATEKEEPER_CAVEAT = {
	label:
		'macOS shows an "unknown developer" warning? Click here for what to do and why.',
	summary:
		"Vorynth is developed and distributed for free by an individual. Opening without this warning normally requires a paid Apple Developer account — which Vorynth doesn't have yet — so macOS can't verify the developer. The warning does NOT mean the app is broken or unsafe.",
	link: {
		href: APPLE_GATEKEEPER_URL,
		text: "Open a Mac app from an unidentified developer (Apple Support)",
	},
};

/** Expandable "?" help row — used below the AppImage downloads (Wayland caveat
 *  with a copyable fix) and in the macOS box (Gatekeeper "unknown developer"
 *  explanation with an Apple Support link). Collapse/expand with a small
 *  animation, matching the app's motion language. */
function HelpToggle({
	label,
	summary,
	command,
	link,
	onCopy,
	copied,
}: {
	label: string;
	summary: string;
	command?: string;
	link?: { href: string; text: string };
	onCopy?: (command: string) => void;
	copied?: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="help-toggle">
			<button
				type="button"
				className="help-toggle-row"
				aria-expanded={open}
				aria-controls="help-toggle-panel"
				onClick={() => setOpen((v) => !v)}
			>
				<Icon name={open ? "help" : "help_outline"} size={16} />
				<span className="help-toggle-text">{label}</span>
				<span className={`help-toggle-chevron${open ? " open" : ""}`}>
					<Icon name="expand_more" size={18} />
				</span>
			</button>
			{open ? (
				<div className="help-toggle-panel" id="help-toggle-panel">
					<p className="help-toggle-summary">{summary}</p>
					{link ? (
						<a
							className="help-toggle-link"
							href={link.href}
							target="_blank"
							rel="noreferrer"
						>
							{link.text}
							<Icon name="open_in_new" size={14} />
						</a>
					) : null}
					{command && onCopy ? (
						<div className="modal-command-wrap">
							<div className="modal-command-label">
								<Icon name="terminal" size={16} />
								Fix
								<button
									type="button"
									className="modal-copy"
									onClick={() => onCopy(command)}
									aria-label="Copy the workaround command"
								>
									<Icon name={copied ? "check" : "content_copy"} size={14} />
									{copied ? "Copied" : "Copy"}
								</button>
							</div>
							<code className="modal-command">{command}</code>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

/** Download dialog shown when a platform card is clicked. Links come from the
 *  latest GitHub release when reachable (so they always match what's actually
 *  published), falling back to the bundled VORYNTH_VERSION offline. */
export function DownloadModal({
	platform,
	onClose,
}: {
	platform: Platform;
	onClose: () => void;
}) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const [links, setLinks] = useState<DownloadLink[] | null>(null);
	const [version, setVersion] = useState(VORYNTH_VERSION);
	const [copied, setCopied] = useState(false);

	// Source-only platforms (Harmony OS) have no installer — nothing to fetch.
	const sourceOnly = platform.key === "harmony";

	/** Copy a shell command to the clipboard and flash "Copied" for 2s. */
	const copyCommand = async (command: string) => {
		try {
			if (!navigator.clipboard?.writeText) return;
			await navigator.clipboard.writeText(command);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard blocked — leave the button as-is.
		}
	};

	useEffect(() => {
		dialogRef.current?.focus();
		// Lock page scroll while the dialog is open.
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	useEffect(() => {
		if (sourceOnly) return;
		let cancelled = false;
		setLinks(null);
		fetchLatestRelease().then((release) => {
			if (cancelled) return;
			if (release) {
				setVersion(release.version);
				setLinks(
					platformDownloadLinks(
						platform.key as PlatformKey,
						release.version,
						release.assets,
					),
				);
			} else {
				setLinks(
					platformDownloadLinks(
						platform.key as PlatformKey,
						VORYNTH_VERSION,
						null,
					),
				);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [platform, sourceOnly]);

	// The AppImage caveat help row renders once, below the last AppImage link.
	const lastCaveatIndex = links
		? links.map((l) => Boolean(l.caveat)).lastIndexOf(true)
		: -1;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				ref={dialogRef}
				className="modal"
				role="dialog"
				aria-modal="true"
				aria-label={`Download Vorynth for ${platform.name}`}
				tabIndex={-1}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					className="modal-close"
					onClick={onClose}
					aria-label="Close download dialog"
				>
					<Icon name="close" size={20} />
				</button>

				<h3 className="modal-title">
					<Icon name={platform.icon} size={20} />
					Download Vorynth for {platform.name}
				</h3>

				{sourceOnly ? (
					<>
						<p className="modal-desc">
							{platform.name} is experimental and ships as a raw bundle — there
							is no one-click installer yet.
						</p>
						<div className="modal-links">
							<a className="btn btn-primary" href={GUIDE_URL}>
								<Icon name="menu_book" size={20} />
								Build from source
							</a>
						</div>
					</>
				) : (
					<>
						<p className="modal-desc">
							Latest release: <strong>v{version}</strong>
						</p>

						{platform.key === "linux" ? (
							<details className="distro-guide">
								<summary>
									<Icon name="memory" size={16} />
									<span>Which package for your distro?</span>
									<span className="distro-guide-chevron">
										<Icon name="expand_more" size={18} />
									</span>
								</summary>
								<ul className="distro-guide-list">
									<li>
										<span className="dot dot--appimage" aria-hidden="true" />
										<strong>AppImage</strong>
										<span>Any glibc-based distro — no install</span>
									</li>
									<li>
										<span className="dot dot--deb" aria-hidden="true" />
										<strong>.deb</strong>
										<span>Debian &amp; Ubuntu (Mint, Pop!_OS, …)</span>
									</li>
									<li>
										<span className="dot dot--rpm" aria-hidden="true" />
										<strong>.rpm</strong>
										<span>Fedora &amp; RHEL (Rocky, AlmaLinux, …)</span>
									</li>
								</ul>
							</details>
						) : null}

						{platform.key === "freebsd" ? (
							<p className="modal-note">
								Other BSDs can run the Linux build through the FreeBSD ABI.
							</p>
						) : null}

						<div className="modal-links">
							{links === null ? (
								<span className="modal-loading">Checking GitHub…</span>
							) : (
								links.map((link, index) => (
									<div key={link.url ?? link.command} className="modal-link">
										{link.url ? (
											<a className="btn btn-primary" href={link.url}>
												<Icon name="download" size={20} />
												{link.label}
											</a>
										) : (
											<div className="modal-command-wrap">
												<div className="modal-command-label">
													<Icon name="terminal" size={16} />
													{link.label}
													<button
														type="button"
														className="modal-copy"
														onClick={() => copyCommand(link.command ?? "")}
														aria-label={`Copy ${link.label} command`}
													>
														<Icon
															name={copied ? "check" : "content_copy"}
															size={14}
														/>
														{copied ? "Copied" : "Copy"}
													</button>
												</div>
												<code className="modal-command">{link.command}</code>
											</div>
										)}
										{link.hint ? (
											<span className="modal-hint">{link.hint}</span>
										) : null}
										{link.caveat && index === lastCaveatIndex ? (
											<HelpToggle
												label="AppImage window won't open? Click here for how to run it and what causes the error."
												summary={link.caveat.summary}
												command={link.caveat.command}
												onCopy={copyCommand}
												copied={copied}
											/>
										) : null}
									</div>
								))
							)}
						</div>
						{platform.key === "mac" ? (
							<HelpToggle
								label={MACOS_GATEKEEPER_CAVEAT.label}
								summary={MACOS_GATEKEEPER_CAVEAT.summary}
								link={MACOS_GATEKEEPER_CAVEAT.link}
							/>
						) : null}
						<a className="modal-more" href={RELEASES_URL}>
							See all releases
							<Icon name="open_in_new" size={14} />
						</a>
					</>
				)}
			</div>
		</div>
	);
}
