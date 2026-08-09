import { useEffect, useState } from "react";
import { App } from "./App";
import { ChangelogPage } from "./pages/ChangelogPage";
import { RoadmapPage } from "./pages/RoadmapPage";

/**
 * Minimal hash router for the static site. Two extra pages live alongside the
 * landing home page:
 *
 *   #/changelog → ChangelogPage  (release notes, from the app's own data)
 *   #/roadmap   → RoadmapPage    (renders the repo's roadmap.md)
 *   anything else → the home page (its #why / #faq anchors still scroll natively)
 *
 * GitHub Pages has no server rewrites, so hash routes (`#/…`) keep every URL
 * working without a fallback, and home-page anchors never collide because they
 * don't start with `#/`.
 */
type Route = "home" | "changelog" | "roadmap";

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

	if (route === "changelog") return <ChangelogPage />;
	if (route === "roadmap") return <RoadmapPage />;
	return <App />;
}
