import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsHeader } from "./DocsHeader";
import roadmapMd from "../../../../roadmap.md?raw";

/**
 * Roadmap page — renders the repo's live roadmap.md (bundled at build time via
 * `?raw`) with the app's design tokens. GFM (tables, task lists, strikethrough)
 * comes from remark-gfm; markdown HTML is escaped by react-markdown by default.
 */
export function RoadmapPage() {
	useEffect(() => {
		document.title = "Roadmap · Vorynth";
	}, []);

	return (
		<div className="docs-page">
			<DocsHeader />
			<main className="container docs-body">
				<div className="roadmap-prose">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{roadmapMd}</ReactMarkdown>
				</div>
			</main>
			<footer className="docs-footer">
				<p>
					This page mirrors the repo's{" "}
					<a href="https://github.com/omidnw/vorynth/blob/master/roadmap.md">
						roadmap.md
					</a>{" "}
					— updated as the project moves forward.
				</p>
			</footer>
		</div>
	);
}
