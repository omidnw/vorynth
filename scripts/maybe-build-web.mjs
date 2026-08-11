// Gate for Tauri's `beforeBuildCommand` (v1.8.1 CI optimization).
//
// The release workflow builds the frontend ONCE (in `verify`) and shares the
// dist via an artifact; a `.vorynth-web-built` marker tells `cargo tauri
// build` to skip its own redundant `vite build`. Local builds never create the
// marker, so vite always runs there and the frontend is always fresh.
//
// Exit 0 → skip vite (CI pre-built the web). Exit 1 → run vite.
import { existsSync } from "node:fs";

const marker = new URL("../.vorynth-web-built", import.meta.url);
process.exit(existsSync(marker) ? 0 : 1);
