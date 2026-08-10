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

/** AppImage help — a clickable "?" row below the AppImage downloads that
 *  expands into the cause plus a copyable fix command (collapse/expand with a
 *  small animation, matching the app's motion language). */
function AppImageHelp({
	caveat,
	onCopy,
	copied,
}: {
	caveat: NonNullable<DownloadLink["caveat"]>;
	onCopy: (command: string) => void;
	copied: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="appimage-help">
			<button
				type="button"
				className="appimage-help-toggle"
				aria-expanded={open}
				aria-controls="appimage-help-panel"
				onClick={() => setOpen((v) => !v)}
			>
				<Icon name={open ? "help" : "help_outline"} size={16} />
				<span className="appimage-help-toggle-text">
					AppImage window won&apos;t open? Click here for how to run it and what
					causes the error.
				</span>
				<span className={`appimage-help-chevron${open ? " open" : ""}`}>
					<Icon name="expand_more" size={18} />
				</span>
			</button>
			{open ? (
				<div className="appimage-help-panel" id="appimage-help-panel">
					<p className="appimage-help-text">{caveat.summary}</p>
					<div className="modal-command-wrap">
						<div className="modal-command-label">
							<Icon name="terminal" size={16} />
							Fix
							<button
								type="button"
								className="modal-copy"
								onClick={() => onCopy(caveat.command)}
								aria-label="Copy the AppImage workaround command"
							>
								<Icon name={copied ? "check" : "content_copy"} size={14} />
								{copied ? "Copied" : "Copy"}
							</button>
						</div>
						<code className="modal-command">{caveat.command}</code>
					</div>
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
											<AppImageHelp
												caveat={link.caveat}
												onCopy={copyCommand}
												copied={copied}
											/>
										) : null}
									</div>
								))
							)}
						</div>
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
