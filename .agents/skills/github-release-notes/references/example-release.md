# Style reference — the v1.5.0 GitHub release

The fallback style anchor when the user can't provide the previous release's notes.
This is what "the established release style" looks like. A new draft must mirror its
section names, section order, bullet granularity, and tone.

---

**Title**

```
Vorynth v1.5.0 — Knowledge Paths
```

**Body**

```
Vorynth tells its own story now — the name origin, the build system, and every supported
platform are documented end-to-end. CI pipelines for HarmonyOS, FreeBSD, and Windows have been
hardened, and the favicon finally carries the actual Vorynth logo.

What's new

- Name origin — "Why Vorynth?" section on the landing page and README explaining the Vor
  (vision/voyage) + Yn (intelligence network) + Th (thought/depth) construction.
- HarmonyOS setup guide — completely rewritten with real SDK URLs, toolchain table, DevEco
  Studio steps, and honest limitations.
- Built with ZCode — a personal note crediting the tools (GLM 5.2, DeepSeek V4 Flash, ChatGPT)
  used during development, explicitly framed as experience rather than promotion.

Improvements

- CI no longer runs on doc-only changes — saves runner time when only README, docs, or
  AGENTS.md are updated.
- Favicon regenerated from the actual Vorynth logo (not a generic brain) at 4 resolutions in a
  single .ico.
- Version sync — a new pnpm version:sync script reads the version from a single source (root
  package.json) and updates all 5 version files; CI validates they stay in sync.
- Release artifacts — HarmonyOS raw bundle and FreeBSD tarball are now attached to the GitHub
  release draft alongside the desktop installers, so every supported platform is represented in
  a single release.

Fixes

- HarmonyOS CI — fixed glib-sys cross-compilation failure by making Tauri and desktop-only Rust
  dependencies conditional (cfg(not(target_env = "ohos"))).
- FreeBSD CI — replaced cargo install tauri-cli with plain cargo build + manual sidecar staging.
- Windows CI — spawn() with shell: true caused ncc to hang on Node 24 on Windows; fixed by
  invoking ncc directly through process.execPath.
- Engine port drift — the default fallback port now matches between frontend (34117) and engine.
- YAML syntax — invalid indentation in package.yml matrix block fixed.

Known issues

- HarmonyOS CI requires downloading a ~2.3 GiB SDK on cache miss. The NDK setup will be
  streamlined in a follow-up release.
- FreeBSD build is experimental: WebKit on FreeBSD is still maturing. The Linux x86_64 binary
  (runs via the FreeBSD Linux ABI compatibility layer) is the recommended fallback.

Full changelog

See changelog-data.ts for the complete release history.
```
