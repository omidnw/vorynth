import { useState } from "react";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
	{ href: "#why", label: "Why Vorynth" },
	{ href: "#how-it-works", label: "How it works", mid: true },
	{ href: "#features", label: "Features", mid: true },
	{ href: "#faq", label: "FAQ" },
	{ href: "#platforms", label: "Platforms", mid: true },
	{ href: "https://github.com/omidnw/vorynth", label: "GitHub" },
];

export function Nav() {
	const base = import.meta.env.BASE_URL;
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	return (
		<nav className="nav">
			<div className="container">
				<a href="#top" className="logo" onClick={close}>
					<img
						src={`${base}logo-nav.png`}
						alt="Vorynth"
						width={28}
						height={28}
					/>
					Vorynth
				</a>
				<div className={`nav-links${open ? " nav-links--open" : ""}`}>
					{LINKS.map((link) => (
						<a
							key={link.label}
							href={link.href}
							className={link.mid ? "nav-mid" : undefined}
							onClick={close}
						>
							{link.label}
						</a>
					))}
				</div>
				<div className="nav-actions">
					<button
						type="button"
						className="nav-toggle"
						aria-expanded={open}
						aria-label="Toggle navigation menu"
						onClick={() => setOpen((v) => !v)}
					>
						<Icon name={open ? "close" : "menu"} size={22} />
					</button>
					<ThemeToggle />
				</div>
			</div>
		</nav>
	);
}
