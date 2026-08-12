import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { DocsHeader } from "./DocsHeader";
import { SCREENSHOTS, type Screenshot } from "../content";

/**
 * Screenshot gallery — every real app screenshot the project ships
 * (apps/landing/public/screenshots/), in a lazy-loaded grid. Clicking an image
 * opens a full-size preview (lightbox) with enter + exit animation, Escape /
 * backdrop / close-button dismissal, and a body scroll lock.
 */
export function ScreenshotsPage() {
	const base = import.meta.env.BASE_URL;
	const [selected, setSelected] = useState<Screenshot | null>(null);
	const [closing, setClosing] = useState(false);
	const closeRef = useRef<HTMLButtonElement>(null);

	// Enter + exit animation: keep the overlay mounted one frame while it fades.
	const open = (shot: Screenshot) => {
		setClosing(false);
		setSelected(shot);
	};
	const close = () => {
		if (closing) return;
		setClosing(true);
		window.setTimeout(() => {
			setSelected(null);
			setClosing(false);
		}, 160);
	};

	// Escape closes; focus lands on the close button while open.
	useEffect(() => {
		if (!selected) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		closeRef.current?.focus();
		return () => window.removeEventListener("keydown", onKey);
	}, [selected]);

	// Lock body scroll while the preview is open.
	useEffect(() => {
		if (!selected) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [selected]);

	return (
		<div className="docs-page">
			<DocsHeader />
			<main className="container docs-body">
				<header className="docs-title">
					<div className="section-label">
						<Icon name="photo_library" size={16} />
						Gallery
					</div>
					<h1>Vorynth Screenshots</h1>
					<p className="section-sub">
						The local-first personal intelligence engine, in action — the ranked
						brief, sources, reading views, AI insights, the archive, and more.
						Click any screenshot to enlarge it.
					</p>
				</header>

				<div className="shot-grid">
					{SCREENSHOTS.map((shot) => (
						<figure className="shot-card" key={shot.src}>
							<button
								type="button"
								className="shot-open"
								aria-label={`Preview: ${shot.caption}`}
								onClick={() => open(shot)}
							>
								<img
									src={`${base}screenshots/${shot.src}`}
									alt={shot.alt}
									loading="lazy"
									width={1404}
									height={1012}
								/>
								<span className="shot-zoom">
									<Icon name="zoom_in" size={28} />
								</span>
							</button>
							<figcaption>{shot.caption}</figcaption>
						</figure>
					))}
				</div>
			</main>
			<footer className="docs-footer">
				<p>
					Real screenshots of the Vorynth desktop app.{" "}
					<a href={base}>Back to the home page</a>.
				</p>
			</footer>

			{selected ? (
				<div
					className={`shot-lightbox${closing ? " shot-lightbox--closing" : ""}`}
					role="dialog"
					aria-modal="true"
					aria-label={`Preview: ${selected.caption}`}
					onClick={close}
				>
					<figure
						className="shot-lightbox-card"
						onClick={(e) => e.stopPropagation()}
					>
						<img
							src={`${base}screenshots/${selected.src}`}
							alt={selected.alt}
							width={1404}
							height={1012}
						/>
						<figcaption>{selected.caption}</figcaption>
					</figure>
					<button
						ref={closeRef}
						type="button"
						className="shot-lightbox-close"
						aria-label="Close preview"
						onClick={close}
					>
						<Icon name="close" size={22} />
					</button>
				</div>
			) : null}
		</div>
	);
}
