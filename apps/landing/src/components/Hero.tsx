import { useEffect, useState } from "react";
import { AppMockup } from "./AppMockup";
import { Icon } from "./Icon";
import { CODENAME, RELEASES_URL, VERSION } from "../content";
import {
	resolveDownload,
	adaptCanvas,
	type DownloadEnv,
	type DownloadTarget,
} from "../download";

const GUIDE_URL = "https://github.com/omidnw/vorynth/blob/master/docs/GUIDE.md";

const NAME_ORIGIN = [
	{ part: "Vor", meaning: "vision · voyage · forward" },
	{ part: "Yn", meaning: "intelligence network" },
	{ part: "Th", meaning: "thought · depth" },
];

export function Hero() {
	const [target, setTarget] = useState<DownloadTarget>({
		url: RELEASES_URL,
		label: "Download",
		platText: "Detecting your platform…",
	});

	useEffect(() => {
		let cancelled = false;
		const nav = navigator as Navigator & {
			userAgentData?: DownloadEnv["hints"];
		};
		resolveDownload({
			ua: navigator.userAgent,
			platform: navigator.platform || "",
			hints: nav.userAgentData,
			makeCanvas: () => adaptCanvas(document.createElement("canvas")),
		})
			.then((t) => {
				if (!cancelled) setTarget(t);
			})
			.catch(() => {
				if (!cancelled)
					setTarget({
						url: RELEASES_URL,
						label: "See all downloads",
						platText: "",
					});
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<header className="hero" id="top">
			<div className="container">
				<div className="hero-badge">
					<Icon name="new_releases" size={16} />v{VERSION} · {CODENAME}
				</div>

				<h1>Vorynth</h1>
				<p className="name-origin">
					{NAME_ORIGIN.map((o, i) => (
						<span key={o.part}>
							{i > 0 ? <span className="origin-sep"></span> : null}
							<strong>{o.part}</strong> <span className="origin-arrow">→</span>{" "}
							{o.meaning}
						</span>
					))}
				</p>
				<p className="tagline">
					<strong>Stay informed without spending hours reading.</strong> Vorynth
					is a local-first personal intelligence engine: it collects the news
					from the sources you trust — journals, blogs, releases, and more —
					ranks what actually matters, and explains each story. All on your
					device, no account, nothing shared.
				</p>
				<p className="tagline tagline--brand">
					The internet is full of knowledge.{" "}
					<strong>Vorynth helps you keep the signal.</strong>
				</p>

				<div className="hero-buttons">
					<a id="download-btn" href={target.url} className="btn btn-primary">
						<Icon name="download" size={20} />
						<span>{target.label}</span>
					</a>
					<a
						href="https://github.com/omidnw/vorynth"
						className="btn btn-outline"
					>
						View on GitHub
						<Icon name="arrow_right_alt" size={20} />
					</a>
				</div>
				<div
					id="platform-detect"
					style={{
						marginTop: 10,
						fontSize: "0.82rem",
						color: "var(--fg-dim)",
						minHeight: "1.2em",
					}}
				>
					{target.platText ? `Detected: ${target.platText}` : ""}
				</div>

				<div className="hero-links">
					<a href={GUIDE_URL}>
						<Icon name="menu_book" size={14} /> Setup Guide
					</a>
					<span className="sep">·</span>
					<a href="https://github.com/omidnw/vorynth/blob/master/README.md">
						<Icon name="article" size={14} /> README
					</a>
				</div>

				<AppMockup />
			</div>
		</header>
	);
}
