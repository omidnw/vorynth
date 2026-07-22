fn main() {
    // The OHOS native bridge (lib.rs) doesn't use tauri::generate_context!(),
    // so skip Tauri's codegen entirely when cross-compiling for OHOS.
    // Build scripts compile for the HOST, so cfg!(target_env) can't see the
    // target — Cargo exposes it via CARGO_CFG_TARGET_ENV instead.
    if std::env::var("CARGO_CFG_TARGET_ENV").ok().as_deref() != Some("ohos") {
        tauri_build::build()
    }
}
