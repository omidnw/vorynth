// Prevent additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Vorynth desktop shell (project-details.md §15 — "The user does not need to
//! install Node.js. Everything required runs locally").
//!
//! # Sidecar resolution strategy
//!
//! On startup the shell looks for the bundled core engine in this order:
//!
//!   1. A single executable next to the current binary named
//!      `vorynth-core[-.exe]` (the future Node-SEA output; true zero-install).
//!   2. A `vorynth-core-<triple>/` directory containing the ncc bundle +
//!      launcher.cjs. We run it via the system `node` if available.
//!      — This is the dev/alpha path; the user needs Node installed.
//!   3. Fall back to `pnpm dev` in apps/core-engine for live development.
//!
//! In all cases the shell:
//!   - picks a free TCP port,
//!   - spawns the sidecar with `--port <p>`,
//!   - polls `http://127.0.0.1:<p>/health` until 200 (30s timeout),
//!   - injects `window.__VORYNTH_CORE_PORT__` into the webview before React
//!     mounts, and
//!   - kills the sidecar when the window closes.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::Manager;
use tauri::WebviewWindowBuilder;
// autostart isn't compiled on FreeBSD (auto-launch has no FreeBSD backend) —
// the import, command, and plugin registration below are cfg-gated to match.
#[cfg(not(target_os = "freebsd"))]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};

/// OS shell integration — "Open plugins folder" (file manager) and
/// "Open in terminal" (see shell_ops.rs for the per-platform commands).
mod shell_ops;

/// macOS Dock integration (v1.8.0): when background mode hides the window to
/// the tray, the Dock icon must go with it — otherwise it lingers as a dead
/// icon that does nothing on click. `Accessory` removes it from the Dock and
/// the Cmd+Tab switcher (the menu bar status item keeps working — that's the
/// whole point of a tray app); `Regular` restores it when the window shows.
/// No-op on other platforms.
#[cfg(target_os = "macos")]
mod dock {
    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
    use objc2_foundation::MainThreadMarker;

    pub fn hide() {
        set_policy(NSApplicationActivationPolicy::Accessory);
    }

    pub fn show() {
        set_policy(NSApplicationActivationPolicy::Regular);
    }

    fn set_policy(policy: NSApplicationActivationPolicy) {
        // MainThreadMarker guarantees we're on the main thread (AppKit's only
        // requirement); in objc2 0.6 these methods are safe with it in hand.
        let Some(marker) = MainThreadMarker::new() else {
            return;
        };
        let app = NSApplication::sharedApplication(marker);
        app.setActivationPolicy(policy);
    }
}

/// Non-macOS stub — the Dock concept doesn't exist there; call sites stay
/// cfg-free.
#[cfg(not(target_os = "macos"))]
mod dock {
    pub fn hide() {}
    pub fn show() {}
}

const SIDECAR_BASENAME: &str = "vorynth-core";
/// Must match `bundle.productName` in tauri.conf.json — Tauri names the Linux
/// resource directory after it (`usr/lib/<productName>/` in AppImage/deb/rpm).
const PRODUCT_NAME: &str = "Vorynth";

/// Platform-appropriate app-data directory so the DB lives outside the .app
/// bundle in a persistent, user-owned location.
fn default_data_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    if cfg!(target_os = "macos") {
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("com.vorynth.desktop")
    } else if cfg!(target_os = "windows") {
        PathBuf::from(home)
            .join("AppData")
            .join("Roaming")
            .join("com.vorynth.desktop")
    } else if cfg!(target_os = "linux") {
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("com.vorynth.desktop")
    } else {
        PathBuf::from(home).join(".vorynth")
    }
}

/// Decide how to launch the engine. Returns the configured Command + a human
/// label for logging.
fn sidecar_command(port: u16) -> Option<(Command, String)> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    let dir = match exe_dir {
        Some(d) => d,
        None => return fallback_pnpm(port),
    };

    // 1. Native single-executable sidecar (future Node SEA — true zero-install).
    let exe_name = if cfg!(windows) {
        format!("{}.exe", SIDECAR_BASENAME)
    } else {
        SIDECAR_BASENAME.to_string()
    };
    let single = dir.join(&exe_name);
    if single.exists() {
        log::info!(
            "launching single-executable sidecar at {}",
            single.display()
        );
        let mut cmd = Command::new(single);
        cmd.arg("--port").arg(port.to_string());
        return Some((cmd, "sea-binary".into()));
    }

    // 2. Bundled directory form (ncc bundle + launcher.cjs).
    //    First try a bundled portable `node` binary inside the sidecar
    //    directory itself (shipped alongside the bundle for zero-install).
    //    Fall back to the system `node` on PATH.
    //
    //    Search sibling `binaries/` (Tauri's externalBin destination) and
    //    `resources/` next to the executable.
    //    On macOS, also search `../Resources/` and `../Resources/binaries/`
    //    because Tauri bundles resources inside the .app bundle at
    //    Contents/Resources/ (while the exe lives in Contents/MacOS/).
    //    On Linux, Tauri bundles resources at `usr/lib/<productName>/` while
    //    the exe lives in `usr/bin/` — search `../lib/<productName>/` too, or
    //    the packaged engine is never found (packaged Linux builds used to
    //    silently fall back to `pnpm dev`).
    #[allow(unused_mut)]
    let mut search_dirs: Vec<String> = vec!["binaries".into(), "resources".into()];
    if cfg!(target_os = "macos") {
        search_dirs.push("../Resources".into());
        search_dirs.push("../Resources/binaries".into());
    }
    if cfg!(target_os = "linux") {
        search_dirs.push(format!("../lib/{PRODUCT_NAME}/binaries"));
        search_dirs.push(format!("../lib/{PRODUCT_NAME}"));
    }
    for sub in &search_dirs {
        if let Some(found) = find_sidecar_dir(&dir.join(sub)) {
            let launcher = found.join("launcher.cjs");
            if launcher.exists() {
                // Try bundled portable node first (shipped with the app).
                let bundled_name = if cfg!(windows) { "node.exe" } else { "node" };
                let bundled_node = found.join(bundled_name);
                let (node, mode) = if bundled_node.exists() {
                    (bundled_node, "bundled-node")
                } else if let Some(system_node) = which_node() {
                    (system_node, "system-node")
                } else {
                    log::error!(
                        "bundled sidecar found at {} but neither bundled node nor \
                         system `node` is available — install Node or ship the \
                         portable binary",
                        found.display()
                    );
                    continue;
                };
                log::info!(
                    "launching bundled sidecar via {} ({}, bundle {})",
                    node.display(),
                    mode,
                    found.display()
                );
                let mut cmd = Command::new(node);
                cmd.arg(launcher).arg("--port").arg(port.to_string());
                return Some((cmd, mode.into()));
            }
        }
    }

    // 3. Dev fallback.
    fallback_pnpm(port)
}

/// Find a directory whose name starts with SIDECAR_BASENAME.
fn find_sidecar_dir(parent: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(parent).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(SIDECAR_BASENAME) && entry.path().is_dir() {
            return Some(entry.path());
        }
    }
    None
}

fn which_node() -> Option<PathBuf> {
    // PATH lookup that works cross-platform without a dep.
    let var = if cfg!(windows) { "Path" } else { "PATH" };
    let path = std::env::var_os(var)?;
    let target = if cfg!(windows) { "node.exe" } else { "node" };
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(target);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn fallback_pnpm(port: u16) -> Option<(Command, String)> {
    log::warn!("no bundled sidecar found; falling back to `pnpm dev`");
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let workspace_root = Path::new(manifest_dir)
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent());
    let core_dir = workspace_root
        .map(|r| r.join("apps").join("core-engine"))
        .unwrap_or_else(|| PathBuf::from("."));

    let mut cmd = Command::new("pnpm");
    cmd.current_dir(&core_dir)
        .arg("dev")
        .env("PORT", port.to_string());
    Some((cmd, "pnpm-dev".into()))
}

/// Port the engine listens on — a fixed high port so the frontend always
/// knows where to reach the engine without any runtime communication. When it
/// is already taken (another Vorynth instance, the dev engine, any other
/// process) the shell probes upward for the next free port and tells the
/// frontend via the `__VORYNTH_CORE_PORT__` init-script + `__vp` URL param.
const ENGINE_PORT: u16 = 34117;
/// How many ports to probe upward before giving up on a free one.
const PORT_PROBE_ATTEMPTS: u16 = 50;

/// Pick a free loopback port starting at `start`. The probe briefly binds the
/// port and immediately releases it (the sidecar binds it next), so there is
/// only a tiny transient race window — far better than a permanent conflict
/// with whatever already owns `start`.
fn pick_free_port(start: u16) -> u16 {
    for port in start..start.saturating_add(PORT_PROBE_ATTEMPTS) {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    // Last resort: let the OS assign an ephemeral port.
    if let Ok(listener) = std::net::TcpListener::bind(("127.0.0.1", 0)) {
        if let Ok(addr) = listener.local_addr() {
            return addr.port();
        }
    }
    start
}

async fn wait_for_health(port: u16, timeout: Duration) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);
    let start = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(1))
        .build()
        .unwrap();

    while start.elapsed() < timeout {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return true;
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    false
}

/// Read `ui.startHidden` from the engine's settings (v1.8.0) — the persisted
/// "start without a window" toggle. Runs after /health is green, so a single
/// GET with a short timeout is enough. Defaults to false: any fetch hiccup
/// must never hide the window (the safe fallback is a normal launch).
async fn fetch_start_hidden(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/settings", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    let Ok(resp) = client.get(&url).send().await else {
        return false;
    };
    if !resp.status().is_success() {
        return false;
    }
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return false;
    };
    body.get("ui.startHidden")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .init();

    // Probe for a free port instead of assuming 34117 is ours (v1.8.0): a
    // second Vorynth instance, the dev engine, or any other process may own it.
    let port = pick_free_port(ENGINE_PORT);
    if port != ENGINE_PORT {
        log::warn!(
            "port {} is busy — core engine will use {} instead",
            ENGINE_PORT,
            port
        );
    }
    log::info!("reserved port {} for the core engine", port);

    let (mut cmd, mode) = match sidecar_command(port) {
        Some(v) => v,
        None => {
            log::error!("no way to launch the core engine — continuing without it");
            run_tauri(port, None, false);
            return;
        }
    };
    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

    // On Windows, suppress the console window that Node.js would otherwise
    // open for the child process (CREATE_NO_WINDOW = 0x08000000).
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    // Point the engine at a persistent app-data directory so the SQLite DB
    // lives outside the .app bundle (e.g. ~/Library/Application Support/…).
    // Respect an explicit env var so dev workflows can override.
    if std::env::var_os("VORYNTH_DATA_DIR").is_none() {
        cmd.env("VORYNTH_DATA_DIR", default_data_dir());
    }

    let child = cmd.spawn().ok();
    if child.is_some() {
        log::info!("core engine sidecar spawned ({}) on port {}", mode, port);
    } else {
        log::error!("failed to spawn core engine sidecar — running without it");
    }

    // Block briefly on a sync thread until /health responds (or timeout).
    let port_for_wait = port;
    let ready = thread::scope(|s| {
        s.spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            runtime.block_on(wait_for_health(port_for_wait, Duration::from_secs(30)))
        })
        .join()
        .unwrap_or(false)
    });

    if ready {
        log::info!("core engine is ready on port {}", port);
    } else {
        log::warn!("core engine did not become ready within 30s — UI will show errors");
    }

    // "Start without a window" (v1.8.0): read the persisted setting now, so
    // the window can be created invisible from the very first frame — a
    // window that flashes for a moment and then hides is not silent.
    let start_hidden = thread::scope(|s| {
        s.spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            runtime.block_on(fetch_start_hidden(port))
        })
        .join()
        .unwrap_or(false)
    });
    if start_hidden {
        log::info!("start without a window: opening to the menu bar");
    }

    run_tauri(port, child, start_hidden);
}

/// Engine port state — exposed to the frontend via the `engine_port` IPC
/// command so the UI always talks to the port the shell actually picked
/// (v1.8.0: the fixed port may be taken — dev engine, a second instance, any
/// process — and the shell probes for a free one).
struct EnginePort(u16);

#[tauri::command]
fn engine_port(port: tauri::State<'_, EnginePort>) -> u16 {
    port.0
}

/// Background-mode state (v1.8.0): when true, closing the window hides it to
/// the system tray instead of quitting — the engine keeps collecting in the
/// background. Set by the frontend via `set_background_mode` on boot and on
/// toggle (the value itself persists in the engine's `ui.backgroundMode`).
struct BackgroundMode(std::sync::atomic::AtomicBool);

/// Launch-at-login (v1.8.0): toggled by the frontend via `set_autostart`. The
/// autostart plugin writes the OS-level hook — a LaunchAgent on macOS (shows
/// under System Settings → Login Items), the HKCU Run value on Windows
/// (Task Manager → Startup apps), an XDG .desktop on Linux (Startup
/// Applications). LaunchAgent (not SMAppService) is used on macOS because
/// SMAppService is brittle for ad-hoc-signed, non-notarized builds (Ventura+
/// relabels or blocks them). Not compiled on FreeBSD (no auto-launch backend).
#[cfg(not(target_os = "freebsd"))]
#[tauri::command]
fn set_autostart(enabled: bool, app: tauri::AppHandle) -> Result<(), String> {
    let autostart = app.autolaunch();
    // Idempotent: only touch the OS hook when the state actually changes.
    // Rewriting the LaunchAgent plist on every boot makes macOS re-register
    // the app's background item and re-notify "...added items that run in the
    // background" on every launch — the LaunchBehaviorBridge pushes this
    // setting on each start, so without this guard the registration would be
    // re-created (and re-notified) on every run (v1.8.0 bug).
    let already = autostart.is_enabled().map_err(|e| e.to_string())?;
    if already == enabled {
        log::info!(
            "launch at login already {} — skipping OS registration",
            if enabled { "enabled" } else { "disabled" }
        );
        return Ok(());
    }
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
        log::info!("launch at login enabled");
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
        log::info!("launch at login disabled");
    }
    Ok(())
}

/// FreeBSD stub: the autostart plugin isn't compiled there (auto-launch has no
/// FreeBSD backend), but the command must stay registered — the handler list
/// is shared across targets — so it answers with a clear error instead of a
/// silent no-op. The frontend swallows the failure (launch-behavior-bridge).
#[cfg(target_os = "freebsd")]
#[tauri::command]
fn set_autostart(_enabled: bool, _app: tauri::AppHandle) -> Result<(), String> {
    Err("launch at login is not supported on FreeBSD".to_string())
}

#[tauri::command]
fn set_background_mode(enabled: bool, mode: tauri::State<'_, BackgroundMode>) {
    mode.0.store(enabled, std::sync::atomic::Ordering::Relaxed);
    log::info!("background mode set to {}", enabled);
}

/// Whether this is a packaged (release) build. Dev builds (`tauri dev`) can't
/// self-replace, so the UI only offers update install in real builds — the
/// check-for-updates surface stays available everywhere. `cfg!(debug_assertions)`
/// is true in dev and false in release — the same signal the OS uses.
#[tauri::command]
fn app_packaged() -> bool {
    !cfg!(debug_assertions)
}

/// Size of the installed app itself (the `.app` bundle on macOS, the install
/// directory elsewhere) — the "App" row in Settings → Storage & Usage. Dev
/// builds have no install footprint, so the command returns `None` there and
/// the UI hides the row.
#[tauri::command]
fn app_install_size() -> Option<u64> {
    if cfg!(debug_assertions) {
        return None;
    }
    let root = app_root_dir()?;
    match dir_size(&root) {
        Ok(bytes) => {
            log::info!("app install size ({}): {} bytes", root.display(), bytes);
            Some(bytes)
        }
        Err(err) => {
            log::warn!("app install size failed for {}: {}", root.display(), err);
            None
        }
    }
}

/// The directory that represents the installed app: the `.app` bundle on
/// macOS, the AppImage's directory on Linux (AppImage self-update replaces the
/// image file there), the executable's own directory elsewhere.
fn app_root_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;

    if cfg!(target_os = "macos") {
        // current_exe → …/Vorynth.app/Contents/MacOS/vorynth-desktop. Walk up
        // to the first parent whose extension is "app" (the bundle root).
        let mut p = exe.as_path();
        while let Some(parent) = p.parent() {
            if parent.extension().map(|e| e == "app").unwrap_or(false) {
                return Some(parent.to_path_buf());
            }
            p = parent;
        }
        return exe.parent().map(|d| d.to_path_buf());
    }

    if cfg!(target_os = "linux") {
        // AppImage: the real image sits in the user's download/opt directory
        // (the executable path points at the mounted squashfs in /tmp).
        if let Ok(appimage) = std::env::var("APPIMAGE") {
            let image = PathBuf::from(appimage);
            if image.exists() {
                return image.parent().map(|d| d.to_path_buf());
            }
        }
    }

    exe.parent().map(|d| d.to_path_buf())
}

/// Recursive byte size of a directory (missing/unreadable dirs propagate as
/// Err — the caller degrades to None).
fn dir_size(dir: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        if ft.is_dir() {
            total += dir_size(&entry.path())?;
        } else if ft.is_file() {
            total += entry.metadata()?.len();
        }
    }
    Ok(total)
}

/// Kill the engine sidecar (idempotent — the Option is taken once).
fn kill_sidecar(holder: &std::sync::Arc<std::sync::Mutex<Option<Child>>>) {
    if let Ok(mut guard) = holder.lock() {
        if let Some(mut c) = guard.take() {
            let _ = c.kill();
            log::info!("core engine sidecar terminated");
        }
    }
}

fn run_tauri(port: u16, mut child: Option<Child>, start_hidden: bool) {
    let init_js = format!("window.__VORYNTH_CORE_PORT__ = {};", port);

    // Shared handle to the engine sidecar — killed on window close AND on app
    // exit, so a closed app never leaves an orphaned engine holding its port.
    let child_holder: std::sync::Arc<std::sync::Mutex<Option<Child>>> =
        std::sync::Arc::new(std::sync::Mutex::new(child.take()));

    // The setup closure moves its own clone; the original stays for app.run's
    // exit cleanup.
    let child_for_setup = child_holder.clone();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Launch-at-login hook. macOS uses a LaunchAgent plist (reliable for
        // ad-hoc-signed builds; SMAppService would be hidden/blocked by
        // Ventura+ for non-notarized apps). Boxed like the updater so the
        // builder chain is identical on FreeBSD, where the plugin doesn't
        // compile (auto-launch has no FreeBSD backend — see Cargo.toml).
        .plugin_boxed(autostart_plugin())
        // Auto-update (v1.8.0) — check GitHub releases, download + verify,
        // then install via a detached updater process that relaunches the app.
        // Not registered on FreeBSD (the plugin doesn't compile there — see
        // Cargo.toml; updater is a linux/macos/windows feature).
        .plugin_boxed(updater_plugin())
        // OS notifications (v1.8.0) — the Notification Center's system push.
        // Boxed for the same reason: not registered on FreeBSD.
        .plugin_boxed(notification_plugin())
        .invoke_handler(tauri::generate_handler![
            shell_ops::open_plugins_folder,
            shell_ops::open_plugins_folder_in_terminal,
            engine_port,
            set_background_mode,
            set_autostart,
            app_packaged,
            app_install_size,
        ])
        .setup(move |app| {
            // Hand the chosen port to the frontend via IPC state — the
            // authoritative path (init-script/URL-param fallbacks are kept for
            // safety but the shell always tells the UI the real port).
            app.manage(EnginePort(port));
            app.manage(BackgroundMode(std::sync::atomic::AtomicBool::new(false)));

            let window =
                WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                    .title("Vorynth — Personal Intelligence Engine")
                    .inner_size(1440.0, 900.0)
                    .min_inner_size(1024.0, 700.0)
                    .resizable(true)
                    .fullscreen(false)
                    .decorations(true)
                    // "Start without a window": created invisible so the user
                    // never sees a flash — the tray/Dock bring it back.
                    .visible(!start_hidden)
                    .initialization_script(&init_js)
                    .build()?;

            // "Start without a window" on macOS (v1.8.0): drop the Dock icon
            // too — a background app with no window shouldn't leave a dead
            // icon in the Dock (the menu-bar tray brings it back, and showing
            // the window restores the icon via dock::show()). No-op elsewhere.
            if start_hidden {
                dock::hide();
            }

            // System tray (v1.8.0): the app stays reachable here when it runs
            // in the background — "Show Vorynth" brings the window back, "Quit"
            // exits for real (the RunEvent::Exit hook then kills the sidecar).
            let show_item =
                tauri::menu::MenuItem::with_id(app, "show", "Show Vorynth", true, None::<&str>)?;
            let quit_item =
                tauri::menu::MenuItem::with_id(app, "quit", "Quit Vorynth", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_item, &quit_item])?;
            let _tray = tauri::tray::TrayIconBuilder::with_id("vorynth-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                // Left-click toggles the window (see on_tray_icon_event below);
                // the menu opens on right-click. Keeping the menu OFF the left
                // click avoids firing the toggle every time the menu opens.
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                            dock::show();
                        }
                    }
                    "quit" => app_handle.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // The tray icon only ever brings the window back — it
                    // never hides it. Hiding to the tray happens exclusively
                    // via the window's close button (with background mode on);
                    // a window that vanishes on its own is a surprise, not a
                    // feature.
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                            dock::show();
                        }
                    }
                })
                .build(app)?;

            // Window lifecycle: with background mode ON, closing hides the
            // window to the tray (engine keeps running); with it OFF the close
            // proceeds and the app quits (sidecar killed on Destroyed + Exit).
            let child_for_close = child_for_setup.clone();
            let app_handle = app.handle().clone();
            let window_for_events = window.clone();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let bg = app_handle
                        .state::<BackgroundMode>()
                        .0
                        .load(std::sync::atomic::Ordering::Relaxed);
                    if bg {
                        api.prevent_close();
                        let _ = window_for_events.hide();
                        // The Dock icon hides with the window — a dead icon
                        // that does nothing on click is worse than no icon.
                        dock::hide();
                        log::info!("background mode: window hidden to tray");
                    }
                }
                tauri::WindowEvent::Destroyed => kill_sidecar(&child_for_close),
                _ => {}
            });

            Ok(())
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Kill the sidecar when the whole app exits (Cmd+Q, Dock quit, code path
    // that bypasses window destroy) — the definitive cleanup hook.
    app.run(move |app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            kill_sidecar(&child_holder);
        }
        // macOS: clicking the Dock icon after a start-hidden launch (or a
        // close-to-tray hide) must bring the window back.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                    dock::show();
                }
            }
        }
    });
}

/// The auto-update plugin, boxed so the same builder chain compiles on every
/// target. On FreeBSD there is nothing to register (the plugin doesn't compile
/// there — `Env.appimage` only exists on Linux; see Cargo.toml). Everywhere
/// else it returns the real updater plugin.
#[cfg(not(target_os = "freebsd"))]
fn updater_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    Box::new(tauri_plugin_updater::Builder::new().build())
}

#[cfg(target_os = "freebsd")]
fn updater_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    // FreeBSD: no auto-update — the updater plugin does not compile here.
    // A no-op plugin keeps the builder chain identical on every target.
    Box::new(tauri::plugin::Builder::<tauri::Wry>::new().build())
}

/// The launch-at-login plugin, boxed so the same builder chain compiles on
/// every target. On FreeBSD there is nothing to register (the auto-launch
/// crate has no FreeBSD backend — see Cargo.toml). Everywhere else it returns
/// the real autostart plugin.
#[cfg(not(target_os = "freebsd"))]
fn autostart_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    Box::new(tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        None,
    ))
}

#[cfg(target_os = "freebsd")]
fn autostart_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    // FreeBSD: no launch-at-login — the autostart plugin does not compile
    // here. A no-op plugin keeps the builder chain identical on every target.
    Box::new(tauri::plugin::Builder::<tauri::Wry>::new().build())
}

/// The notification plugin, boxed so the same builder chain compiles on every
/// target. On FreeBSD there is nothing to register (it lives in the same
/// FreeBSD-excluded Cargo group as updater/autostart — see Cargo.toml).
#[cfg(not(target_os = "freebsd"))]
fn notification_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    Box::new(tauri_plugin_notification::init())
}

#[cfg(target_os = "freebsd")]
fn notification_plugin() -> Box<dyn tauri::plugin::Plugin<tauri::Wry>> {
    // FreeBSD: no OS notifications — the plugin does not compile here. A
    // no-op plugin keeps the builder chain identical on every target.
    Box::new(tauri::plugin::Builder::<tauri::Wry>::new().build())
}
