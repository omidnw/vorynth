/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CORE_HOST?: string;
	readonly VITE_CORE_PORT?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

/** Set by the Tauri shell before the bundle loads, when the sidecar binds. */
interface Window {
	__VORYNTH_CORE_PORT__?: number;
}
