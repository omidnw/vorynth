import { useState } from "react";
import { Icon } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";

/** Top bar for the standalone changelog/roadmap/sources pages — they don't use
 *  the landing home nav (whose links are home-section anchors). The pages live
 *  at real paths (directory index files), so links are base-aware. */
export function DocsHeader() {
	const base = import.meta.env.BASE_URL;
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	const links = [
		{ href: base, label: "Home" },
		{ href: `${base}changelog/`, label: "Changelog" },
		{ href: `${base}roadmap/`, label: "Roadmap" },
		{ href: "https://github.com/omidnw/vorynth", label: "GitHub" },
	];

	return (
		<header className="docs-header">
			<div className="container docs-header-inner">
				<a href={base} className="docs-logo" onClick={close}>
					<img
						src={`${base}logo-nav.png`}
						alt="Vorynth"
						width={28}
						height={28}
					/>
					Vorynth
				</a>
				<div
					className={`docs-header-links${open ? " docs-header-links--open" : ""}`}
				>
					{links.map((link) => (
						<a key={link.label} href={link.href} onClick={close}>
							{link.label}
						</a>
					))}
				</div>
				<div className="docs-header-actions">
					<button
						type="button"
						className="docs-toggle"
						aria-expanded={open}
						aria-label="Toggle navigation menu"
						onClick={() => setOpen((v) => !v)}
					>
						<Icon name={open ? "close" : "menu"} size={22} />
					</button>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
