import { useState } from "react";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { DownloadModal } from "./DownloadModal";
import {
	AUDIENCE,
	FAQ,
	FEATURES,
	MODES,
	NOT_AI,
	ORIGIN_IDEA,
	ORIGIN_INTRO,
	ORIGIN_OUTRO,
	ORIGIN_STEPS,
	PLATFORMS,
	RELEASES_URL,
	STATS,
	STEPS,
	WHY,
	type Platform,
} from "../content";

const DELAYS = [1, 2, 3, 4] as const;

const GUIDE_URL = "https://github.com/omidnw/vorynth/blob/master/docs/GUIDE.md";

function delayFor(i: number) {
	return DELAYS[i % DELAYS.length] ?? 1;
}

/** Render `**bold**` segments in a content string as <strong>. */
function renderRich(text: string) {
	const parts = text.split(/\*\*(.+?)\*\*/g);
	return parts.map((part, i) =>
		i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
	);
}

function SectionHead({
	icon,
	label,
	title,
	sub,
}: {
	icon: string;
	label: string;
	title: string;
	sub: string;
}) {
	return (
		<Reveal>
			<div className="section-head">
				<div className="section-label">
					<Icon name={icon} size={16} />
					{label}
				</div>
				<h2>{title}</h2>
				<p className="section-sub">{sub}</p>
			</div>
		</Reveal>
	);
}

export function OriginSection() {
	return (
		<section id="story" className="section">
			<div className="container">
				<SectionHead
					icon="auto_awesome"
					label="The story"
					title="Built for people who need to stay informed"
					sub="Why Vorynth exists — and how a simple idea grew into an intelligence engine."
				/>
				<div className="story-wrap">
					{ORIGIN_INTRO.map((line, i) => (
						<Reveal key={line} delay={i === 2 ? 2 : i === 1 ? 1 : undefined}>
							<p className={i === 0 ? "story-lead" : "story-line"}>{line}</p>
						</Reveal>
					))}
					<Reveal>
						<blockquote className="story-quote">“{ORIGIN_IDEA}”</blockquote>
					</Reveal>
					<div className="story-steps">
						{ORIGIN_STEPS.map((step, i) => (
							<Reveal key={step.title} delay={delayFor(i)}>
								<div className="story-step">
									<div className="icon-wrap">
										<Icon name={step.icon} size={19} />
									</div>
									<h3>{step.title}</h3>
									<p>{step.body}</p>
								</div>
							</Reveal>
						))}
					</div>
					<Reveal>
						<p className="story-outro">{ORIGIN_OUTRO}</p>
					</Reveal>
				</div>
			</div>
		</section>
	);
}

export function WhySection() {
	return (
		<section id="why" className="section">
			<div className="container">
				<SectionHead
					icon="explore"
					label="Why Vorynth"
					title="Signal over noise."
					sub="Four principles shape everything the app does — from the ranker to the reading layout."
				/>
				<div className="why-grid">
					{WHY.map((item, i) => (
						<Reveal key={item.title} delay={delayFor(i)}>
							<div className="why-item">
								<div className="icon-wrap">
									<Icon name={item.icon} size={19} />
								</div>
								<div>
									<h3>{item.title}</h3>
									<p>{item.body}</p>
								</div>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function NotAiSection() {
	return (
		<section id="not-ai" className="section">
			<div className="container">
				<SectionHead
					icon="chat"
					label="Positioning"
					title="Not another AI chat window"
					sub="Vorynth isn't a replacement for ChatGPT, Claude, or Gemini. AI assistants answer questions; Vorynth helps you know which questions are worth asking — and builds understanding over time from your own sources."
				/>
				<div className="notai-grid">
					{NOT_AI.points.map((point, i) => (
						<Reveal key={point.text} delay={delayFor(i)}>
							<div className="notai-card">
								<div className="icon-wrap">
									<Icon name={point.icon} size={19} />
								</div>
								<p>{point.text}</p>
							</div>
						</Reveal>
					))}
				</div>
				<Reveal>
					<p className="notai-closing">{NOT_AI.closing}</p>
				</Reveal>
			</div>
		</section>
	);
}

export function HowItWorks() {
	return (
		<section id="how-it-works" className="section">
			<div className="container">
				<SectionHead
					icon="route"
					label="Workflow"
					title="From firehose to brief"
					sub="Four steps sit between the source and your morning read — and all of them run on your device."
				/>
				<div className="pipeline-grid">
					{STEPS.map((step, i) => (
						<Reveal key={step.step} delay={delayFor(i)}>
							<div className="pipeline-step">
								<div className="icon-wrap">
									<Icon name={step.icon} size={21} />
								</div>
								<span className="step-num">{step.step}</span>
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function AudienceSection() {
	return (
		<section id="audience" className="section">
			<div className="container">
				<SectionHead
					icon="groups"
					label="Who it's for"
					title="Designed for different minds"
					sub="One engine, many ways to use it — the way you think determines what you get out of it."
				/>
				<div className="audience-grid">
					{AUDIENCE.map((aud, i) => (
						<Reveal key={aud.name} delay={delayFor(i)}>
							<div className="audience-card">
								<div className="audience-card-head">
									<div className="icon-wrap">
										<Icon name={aud.icon} size={22} />
									</div>
									<h3>{aud.name}</h3>
								</div>
								<p className="audience-label">{aud.label}</p>
								<ul className="audience-list">
									{aud.items.map((item) => (
										<li key={item}>
											<Icon name="check" size={16} />
											{item}
										</li>
									))}
								</ul>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function Features() {
	return (
		<section id="features" className="section">
			<div className="container">
				<SectionHead
					icon="stars"
					label="Capabilities"
					title="Stop hunting for news. Let it come to you."
					sub="Define your sources once. Vorynth collects the updates, ranks what matters, explains it, and keeps every byte searchable on your machine."
				/>
				<div className="features-grid">
					{FEATURES.map((feature, i) => (
						<Reveal key={feature.title} delay={delayFor(i)}>
							<div className="feature-card">
								<div className="icon-wrap">
									<Icon name={feature.icon} size={22} />
								</div>
								<h3>{feature.title}</h3>
								<p>{feature.body}</p>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

export function Modes() {
	return (
		<section id="modes" className="section">
			<div className="container">
				<SectionHead
					icon="tune"
					label="Modes"
					title="Run it your way"
					sub="Start with nothing but your sources. Add AI understanding any time — no key, no account, no lock-in."
				/>
				<div className="modes-grid">
					{MODES.map((mode, i) => (
						<Reveal key={mode.title} delay={delayFor(i)}>
							<div
								className={`mode-card${mode.featured ? " mode-card--featured" : ""}`}
							>
								<span
									className={`mode-tag ${mode.tone === "news" ? "mode-tag--news" : "mode-tag--ai"}`}
								>
									{mode.tag}
								</span>
								<h3>{mode.title}</h3>
								<p className="mode-desc">{mode.desc}</p>
								<ul className="mode-list">
									{mode.bullets.map((bullet) => (
										<li key={bullet}>
											<Icon name="check" size={17} />
											{bullet}
										</li>
									))}
								</ul>
							</div>
						</Reveal>
					))}
				</div>
				<p className="mode-footnote">
					Switch between modes any time from Settings — your choice is
					remembered.
				</p>
			</div>
		</section>
	);
}

export function StatsSection() {
	return (
		<section className="section">
			<div className="container">
				<div className="stats-grid">
					{STATS.map((stat, i) => (
						<Reveal key={stat.label} delay={delayFor(i)}>
							<div className="stat-card">
								<div className="icon-wrap">
									<Icon name={stat.icon} size={20} />
								</div>
								<div className="stat-value">{stat.value}</div>
								<div className="stat-label">{stat.label}</div>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

const ARCH_TEXT = `Vorynth
├── Desktop App    the window you open — briefs, archive, search, and settings.
└── Core Engine    runs on your machine — collects, ranks, understands, and indexes.

How data flows
  1. Collect — 6 adapters: RSS · GitHub releases · arXiv · HTML · Sitemap · JSON API
  2. Normalize & rank — dedup, classify, importance-score each item
  3. Understand — the AI triad: why it matters · impact · recommended action
  4. Index — every article searchable (FTS5 full-text, Persian-safe)
  5. Deliver — your daily brief, your archive, your answers — all on-device

And none of it leaves your computer.`;

export function Architecture() {
	return (
		<section id="architecture" className="section">
			<div className="container">
				<SectionHead
					icon="code"
					label="Under the hood"
					title="A local engine, explained"
					sub="Two parts, one purpose: collect what matters and put it in front of you — all on your machine."
				/>
				<Reveal>
					<div className="arch-wrap">
						<pre className="arch-diagram">{ARCH_TEXT}</pre>
					</div>
				</Reveal>
			</div>
		</section>
	);
}

export function Platforms() {
	const [selected, setSelected] = useState<Platform | null>(null);

	return (
		<section id="platforms" className="section">
			<div className="container">
				<SectionHead
					icon="devices"
					label="Compatibility"
					title="Platform Support"
					sub="Pick your platform below to download the latest release — no GitHub browsing needed."
				/>
				<div className="platform-tip">
					<Icon name="touch_app" size={18} />
					<span>
						<strong>Tip:</strong> click any platform box to see its download
						links.
					</span>
				</div>
				<div className="platform-grid">
					{PLATFORMS.map((platform, i) => (
						<Reveal key={platform.name} delay={delayFor(i)}>
							<button
								type="button"
								className="platform-card"
								onClick={() => setSelected(platform)}
								aria-label={`Download Vorynth for ${platform.name}`}
							>
								<span className="download-hint">
									<Icon name="download" size={14} />
									Download
								</span>
								<div className="icon-wrap">
									<Icon name={platform.icon} size={24} />
								</div>
								<div className="name">{platform.name}</div>
								<div className="status">{platform.status}</div>
								<div className={`tag tag--${platform.tone}`}>
									{platform.tone === "native" ? "Native" : "Source"}
								</div>
							</button>
						</Reveal>
					))}
				</div>
			</div>
			{selected ? (
				<DownloadModal platform={selected} onClose={() => setSelected(null)} />
			) : null}
		</section>
	);
}

export function CtaSection() {
	return (
		<section className="section">
			<div className="container">
				<Reveal>
					<div className="cta-wrap">
						<div className="cta-icon">
							<Icon name="download" size={40} />
						</div>
						<h2>Start reading less today</h2>
						<p className="cta-copy">
							Download the release for your platform, or clone the repo and run
							from source. Your first brief is minutes away.
						</p>
						<div className="hero-buttons">
							<a href="#platforms" className="btn btn-primary">
								<Icon name="download" size={20} />
								Download the latest release
							</a>
							<a href={GUIDE_URL} className="btn btn-outline">
								<Icon name="menu_book" size={20} />
								Setup Guide
							</a>
						</div>
						<p className="cta-copy">
							<span className="homebrew-hint">macOS:</span>{" "}
							<code className="homebrew-code">
								brew tap omidnw/vorynth &amp;&amp; brew install --cask vorynth
							</code>
						</p>
					</div>
				</Reveal>
			</div>
		</section>
	);
}

export function FaqSection() {
	// All items start closed — nothing is open until the visitor clicks.
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	return (
		<section id="faq" className="section">
			<div className="container">
				<SectionHead
					icon="question_answer"
					label="FAQ"
					title="Frequently asked questions"
					sub="The questions people ask most — answered plainly."
				/>
				<div className="faq-list">
					{FAQ.map((item, i) => {
						const isOpen = openIndex === i;
						const num = String(i + 1).padStart(2, "0");
						return (
							<Reveal key={item.q} delay={delayFor(i)}>
								<div className={`faq-item${isOpen ? " faq-item--open" : ""}`}>
									<button
										type="button"
										id={`faq-button-${i}`}
										className="faq-question"
										aria-expanded={isOpen}
										aria-controls={`faq-panel-${i}`}
										onClick={() => setOpenIndex(isOpen ? null : i)}
									>
										<span className="faq-num">{num}</span>
										<span className="faq-q">{item.q}</span>
										<Icon name="expand_more" size={20} />
									</button>
									<div
										id={`faq-panel-${i}`}
										role="region"
										aria-labelledby={`faq-button-${i}`}
										className="faq-panel"
									>
										<div className="faq-body">
											<p>{renderRich(item.a)}</p>
											{item.key ? <p className="faq-key">{item.key}</p> : null}
										</div>
									</div>
								</div>
							</Reveal>
						);
					})}
				</div>
			</div>
		</section>
	);
}

const FOOTER_LINKS = [
	{ href: "https://github.com/omidnw/vorynth", icon: "code", label: "Source" },
	{ href: RELEASES_URL, icon: "download", label: "Releases" },
	{
		href: "https://github.com/omidnw/vorynth/issues",
		icon: "bug_report",
		label: "Issues",
	},
	{ href: GUIDE_URL, icon: "menu_book", label: "Guide" },
	{ href: "#/changelog", icon: "new_releases", label: "Changelog" },
	{ href: "#/roadmap", icon: "map", label: "Roadmap" },
];

export function Footer() {
	return (
		<footer className="footer">
			<div className="container">
				<div className="footer-links">
					{FOOTER_LINKS.map((link) => (
						<a key={link.label} href={link.href}>
							<Icon name={link.icon} size={16} />
							{link.label}
						</a>
					))}
				</div>
				<p className="copyright">
					Built with <span style={{ color: "var(--accent)" }}>♥</span> by{" "}
					<a href="https://github.com/omidnw">Omid Reza Keshtkar</a> · MIT
					Licensed · <a href="mailto:omidrezakeshtkar@icloud.com">Contact</a>
				</p>
			</div>
		</footer>
	);
}
