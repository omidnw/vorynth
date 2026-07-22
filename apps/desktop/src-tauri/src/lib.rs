//! Vorynth native bridge library for HarmonyOS NEXT.
//!
//! Compiled as `cdylib` (`.so`) for loading from ArkTS via FFI.
//! This is the entry point for the native runtime; the actual
//! engine interaction logic (spawning the Node.js core engine,
//! IPC bridge, etc.) is implemented here over time.
//!
//! # Why a separate lib.rs?
//!
//! The existing `main.rs` depends on Tauri (webview, GTK, etc.)
//! which cannot compile for `aarch64-unknown-linux-ohos`.
//! This library has **zero Tauri dependencies** — it only uses
//! `core` / `std` — so it cross-compiles cleanly for OHOS.
//!
//! The binary target (`main.rs`) is unchanged; `cargo tauri build`
//! still produces the same desktop app as before.

/// Initialize the Vorynth native runtime.
///
/// Called by the ArkTS wrapper on app start. Returns 0 on success,
/// non-zero on failure.
#[no_mangle]
pub extern "C" fn vorynth_init() -> i32 {
    0
}
