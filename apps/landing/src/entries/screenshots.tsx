import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ScreenshotsPage } from "../pages/ScreenshotsPage";

// Self-host Material Symbols so icons render where Google Fonts is unreachable.
import "@fontsource/material-symbols-outlined/400.css";

// Same CSS chain as main.tsx (minus preview.css, which only frames the home
// page's embedded app preview). Theme tokens first, then the desktop Tailwind
// globals, then the landing's own layout styles.
import "../theme.css";
import "@/styles/globals.css";
import "../site.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<ScreenshotsPage />
	</StrictMode>,
);
