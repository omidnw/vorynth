import { Suspense, lazy, useEffect, useState } from "react";
import { App } from "./App";

/**
 * Router for the HOME document only. Changelog, roadmap, and the curated
 * source-list pages are now REAL pages — each has its own index.html served at
 * a directory path (changelog/, roadmap/, sources/…), so index.html never
 * renders them directly.
 *
 * The hash switch below is kept as a LEGACY fallback for old `#/changelog` /
 * `#/roadmap` links that predate the multi-page build — those still render
 * inline instead of breaking. The pages are lazy so the home bundle never pays
 * for the markdown/release-notes chunks it doesn't need. Home anchors (#why,
 * #faq, …) keep scrolling natively, and they never collide because they don't
 * start with `#/`.
 */
type Route = "home" | "changelog" | "roadmap";

const ChangelogPage = lazy(() =>
	import("./pages/ChangelogPage").then((m) => ({ default: m.ChangelogPage })),
);
const RoadmapPage = lazy(() =>
	import("./pages/RoadmapPage").then((m) => ({ default: m.RoadmapPage })),
);

function routeFromHash(hash: string): Route {
	if (hash.startsWith("#/changelog")) return "changelog";
	if (hash.startsWith("#/roadmap")) return "roadmap";
	return "home";
}

export function Root() {
	const [route, setRoute] = useState<Route>(() =>
		routeFromHash(window.location.hash),
	);

	useEffect(() => {
		const onHashChange = () => setRoute(routeFromHash(window.location.hash));
		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, []);

	if (route === "changelog")
		return (
			<Suspense fallback={null}>
				<ChangelogPage />
			</Suspense>
		);
	if (route === "roadmap")
		return (
			<Suspense fallback={null}>
				<RoadmapPage />
			</Suspense>
		);
	return <App />;
}
