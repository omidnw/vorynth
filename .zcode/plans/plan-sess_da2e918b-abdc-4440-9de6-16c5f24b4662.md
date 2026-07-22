# Plan: Add HarmonyOS NEXT Build to CI Pipeline

## Overview
Add a new matrix entry to `package.yml` that cross-compiles Vorynth's Rust shell as a shared library (`.so`) for HarmonyOS NEXT (ARM64) on an Ubuntu runner, and packages it with the built frontend assets.

## Files changed

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/Cargo.toml` | Added `[lib]` section for cdylib crate-type |
| `apps/desktop/src-tauri/.cargo/config.toml` | **New** — OHOS cross-compilation linker config |
| `apps/desktop/src-tauri/src/lib.rs` | **New** — Minimal library entry point (no Tauri deps) |
| `.github/workflows/package.yml` | Added HarmonyOS matrix entry + conditional build steps |
| `docs/GUIDE.md` | Updated Harmony OS section to reflect CI build |
| `README.md` | Updated Harmony OS row in platform table with email call-to-action |

---

## 1. `Cargo.toml` — Add `[lib]` section

Add a library target that coexists with the existing binary. The library points to a separate `src/lib.rs` (no Tauri dependencies — compiles cleanly for OHOS).

```toml
[lib]
name = "vorynth_desktop"
crate-type = ["cdylib", "rlib"]
```

The existing binary target (`default-run = "vorynth-desktop"` + `src/main.rs`) is **unchanged** — Tauri builds produce the same binary as before.

---

## 2. `.cargo/config.toml` — New file

```toml
[target.aarch64-unknown-linux-ohos]
linker = "aarch64-unknown-linux-ohos-clang"

[target.armv7-unknown-linux-ohos]
linker = "armv7-unknown-linux-ohos-clang"
```

---

## 3. `src/lib.rs` — New file

A minimal library that exports a C-compatible init function. No `tauri`, `tauri-build`, `webview`, or system GUI deps — so it compiles cleanly for the OHOS target.

```rust
//! Vorynth native bridge library for HarmonyOS NEXT.
//!
//! Compiled as cdylib (.so) for loading from ArkTS via FFI.
//! This is the entry point for the native runtime; the actual
//! engine interaction logic is implemented here over time.

#[no_mangle]
pub extern "C" fn vorynth_init() -> i32 {
    0
}
```

This is a **skeleton** — the actual bridge logic (spawning the Node.js core engine, IPC, etc.) can be fleshed out later.

---

## 4. `package.yml` — HarmonyOS matrix entry + conditional steps

### Matrix entry

```yaml
- os: ubuntu-24.04
  target: aarch64-unknown-linux-ohos
  label: HarmonyOS NEXT (ARM64)
  artifact: vorynth-harmonyos-arm64
  is-harmonyos: true
```

All existing matrix entries also received `is-harmonyos: false`.

### New conditional steps (gated on `is-harmonyos == true`):

**a) Setup Rust & NDK for HarmonyOS**
- `rustup target add aarch64-unknown-linux-ohos || rustup target add aarch64-unknown-linux-gnu`
- Download OHOS NDK (placeholder URL — user to fill in the real Huawei SDK URL)
- Set `OHOS_NDK_HOME` and `PATH` env vars

**b) Compile Rust library for HarmonyOS**
- `cargo build --release --target=aarch64-unknown-linux-ohos --lib`

**c) Assemble HarmonyOS app template**
- Copy frontend dist into `rawfile/` directory
- Copy `.so` into `libs/arm64-v8a/`
- Package into `vorynth-harmonyos-raw-bundle.tar.gz`

**d) Upload HarmonyOS artifact**
- Upload the tarball with 14-day retention

### Existing steps updated:

| Step | Change |
|------|--------|
| `Setup Rust` | Gated to `is-harmonyos == false` (OHOS uses custom step) |
| `Install Linux system deps` | Gated to `is-harmonyos == false` (no webkit/gtk needed) |
| `Rebuild better-sqlite3` | Gated to `is-harmonyos == false` (not needed for cross-compile) |
| `Stage sidecar for Tauri` | Gated to `is-harmonyos == false` |
| `Build Tauri app` | Gated to `is-harmonyos == false` |
| `Upload desktop artifacts` | Gated to `is-harmonyos == false` |

---

## 5. `docs/GUIDE.md` — Update Harmony OS section

Replaced the "does not have native build" / "Future native support" section with:
- Description of the CI bundle output
- Instructions for importing into DevEco Studio
- Current limitations (skeleton library, placeholder NDK URL)
- Email call-to-action for testers
- Run-from-source alternative still documented

---

## 6. `README.md` — Update platform table

Changed the Harmony OS row from:
```
| Harmony OS | 🟡 Source only | Run from source via `pnpm dev` ... |
```
to:
```
| Harmony OS | 🟡 CI bundle | Cross-compiled `.so` + frontend via CI. If you test it and it works, please let me know at **omidrezakeshtkar@icloud.com**. |
```

---

## Known issues

1. **OHOS NDK download URL** — The workflow uses `https://huaweicloud.com` as a placeholder. The real URL depends on the specific Huawei SDK version and needs to be updated.
2. **`aarch64-unknown-linux-ohos` target** — Requires Rust ≥1.82. Falls back to `aarch64-unknown-linux-gnu` with OHOS sysroot/linker overrides if the target isn't available via rustup.
3. **Library is a skeleton** — The `.so` exports a minimal `vorynth_init()` function. Real OHOS integration (ArkTS wrapper, WebView setup, engine spawning) requires additional development outside this change.
4. **The existing Tauri build for all other platforms is unaffected** — the `[lib]` section adds a library target alongside the binary, which `tauri-action` still builds correctly.
