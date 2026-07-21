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

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use tauri::WebviewWindowBuilder;

const SIDECAR_BASENAME: &str = "vorynth-core";

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
        log::info!("launching single-executable sidecar at {}", single.display());
        let mut cmd = Command::new(single);
        cmd.arg("--port").arg(port.to_string());
        return Some((cmd, "sea-binary".into()));
    }

    // 2. Bundled directory form (ncc bundle + launcher.cjs).
    //    Search sibling `binaries/` (Tauri's externalBin destination) and
    //    `resources/` next to the executable.
    //    On macOS, also search `../Resources/` and `../Resources/binaries/`
    //    because Tauri bundles resources inside the .app bundle at
    //    Contents/Resources/ (while the exe lives in Contents/MacOS/).
    #[allow(unused_mut)]
    let mut search_dirs = vec!["binaries", "resources"];
    if cfg!(target_os = "macos") {
        search_dirs.push("../Resources");
        search_dirs.push("../Resources/binaries");
    }
    for sub in &search_dirs {
        if let Some(found) = find_sidecar_dir(&dir.join(sub)) {
            let launcher = found.join("launcher.cjs");
            if launcher.exists() {
                if let Some(node) = which_node() {
                    log::info!(
                        "launching bundled sidecar via node at {} (bundle {})",
                        node.display(),
                        found.display()
                    );
                    let mut cmd = Command::new(node);
                    cmd.arg(launcher).arg("--port").arg(port.to_string());
                    return Some((cmd, "bundled".into()));
                } else {
                    log::error!(
                        "bundled sidecar found at {} but `node` is not on PATH — \
                         install Node or ship the single-executable build",
                        found.display()
                    );
                }
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

/// Port the engine listens on. A fixed high port avoids the need for
/// init-script / URL-param communication between Rust and the webview.
/// If the fixed port is already in use we fall back to an OS-assigned one.
const ENGINE_PORT: u16 = 34117;

fn pick_free_port() -> u16 {
    // Try the fixed port first so the frontend can rely on a known default.
    if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", ENGINE_PORT)) {
        let port = listener.local_addr().unwrap().port();
        // Drop the listener immediately — the engine will bind it later.
        // We only need to know the port.
        return port;
    }
    // Fall back to OS-assigned if the fixed port is taken.
    TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind a free port")
        .local_addr()
        .unwrap()
        .port()
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

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .init();

    let port = pick_free_port();
    log::info!("reserved port {} for the core engine", port);

    let (mut cmd, mode) = match sidecar_command(port) {
        Some(v) => v,
        None => {
            log::error!("no way to launch the core engine — continuing without it");
            run_tauri(port, None);
            return;
        }
    };
    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

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

    run_tauri(port, child);
}

	fn run_tauri(port: u16, mut child: Option<Child>) {
	    let init_js = format!("window.__VORYNTH_CORE_PORT__ = {};", port);

	    tauri::Builder::default()
	        .plugin(tauri_plugin_shell::init())
	        .setup(move |app| {
	            // When the engine binds the fixed port (34117, the common case)
	            // the frontend already knows it — no runtime communication needed.
	            // When the port differs (fixed port was busy) we pass it via a
	            // URL query param so the frontend can discover it.
	            let page = if port == ENGINE_PORT {
	                "index.html".to_string()
	            } else {
	                format!("index.html?__vp={}", port)
	            };
	            let window = WebviewWindowBuilder::new(
	                app,
	                "main",
	                tauri::WebviewUrl::App(page.into()),
	            )
	            .title("Vorynth — Personal Intelligence Engine")
	            .inner_size(1440.0, 900.0)
	            .min_inner_size(1024.0, 700.0)
	            .resizable(true)
	            .fullscreen(false)
	            .decorations(true)
	            .initialization_script(&init_js)
	            .build()?;

            // Kill the sidecar when the window is destroyed.
            let child_holder = std::sync::Arc::new(std::sync::Mutex::new(child.take()));
            let child_for_close = child_holder.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Destroyed = event {
                    if let Ok(mut guard) = child_for_close.lock() {
                        if let Some(mut c) = guard.take() {
                            let _ = c.kill();
                            log::info!("core engine sidecar terminated");
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
