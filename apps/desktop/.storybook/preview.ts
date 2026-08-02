import type { Preview } from "@storybook/react-vite";
import "../src/styles/theme.css";
import "../src/styles/globals.css";

/**
 * Global Storybook preview — loads the app's Tailwind theme so stories render
 * with real Vorynth styling.
 */
const preview: Preview = {
	parameters: {
		controls: { expanded: true },
	},
};

export default preview;
