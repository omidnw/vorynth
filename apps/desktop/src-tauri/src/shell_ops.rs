//! OS shell integration for the Plugins page (v1.8.0) — "Open folder" and
//! "Open in terminal".
//!
//! The desktop owns OS integration (the engine is a headless sidecar), so these
//! two `#[tauri::command]`s do the platform-specific launching instead of the
//! shell plugin's `open()` — that API only opens files/URLs with their default
//! app and can't reliably launch terminals at a given working directory.
//!
//! File managers:
//!   Windows   `explorer.exe <dir>`       File Explorer
//!   macOS     `open <dir>`               Finder
//!   Linux     `xdg-open <dir>`           the distro's default file manager
//!
//! Terminals:
//!   Windows   `wt.exe -d <dir>`          Windows Terminal (Win11) when present,
//!            else `powershell.exe -NoExit -WorkingDirectory <dir>`
//!   macOS     `open -a Terminal <dir>`   Terminal.app with the folder as cwd
//!   Linux     `$TERMINAL` → a cascade over common emulators, each launched
//!            with its own working-directory flag (first spawn that succeeds
//!            wins).
//!
//! Every command first validates the path is a real directory and returns a
//! human-readable `Err` (surfaced by the frontend) instead of panicking.
//!
//! Note on Windows quoting: `std::process::Command` wraps arguments containing
//! spaces in double quotes and escapes internal quotes per the Windows rules —
//! we pass raw paths and never add literal quotes.

use std::path::Path;
#[cfg(target_os = "windows")]
use std::path::PathBuf;
use std::process::Command;

/// The engine resolves the plugins dir (data/plugins) and the frontend sends it
/// here; refuse anything that isn't an actual directory.
fn validate_dir(dir: &str) -> Result<(), String> {
    if dir.trim().is_empty() {
        return Err("plugins folder path is empty".into());
    }
    let p = Path::new(dir);
    if !p.is_dir() {
        return Err(format!("not a directory: {dir}"));
    }
    Ok(())
}

/// Spawn a detached child and map a launch failure to a friendly message.
fn spawn(cmd: &mut Command) -> Result<(), String> {
    let program = cmd.get_program().to_string_lossy().into_owned();
    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("couldn't launch {program}: {e}")),
    }
}

/// Open the plugins folder in the OS default file manager.
#[tauri::command]
pub fn open_plugins_folder(dir: String) -> Result<(), String> {
    validate_dir(&dir)?;
    #[cfg(target_os = "windows")]
    {
        spawn(Command::new("explorer.exe").arg(&dir))
    }
    #[cfg(target_os = "macos")]
    {
        spawn(Command::new("open").arg(&dir))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        spawn(Command::new("xdg-open").arg(&dir))
    }
}

/// Open the plugins folder in a terminal at that folder as the working
/// directory (PowerShell / Windows Terminal on Windows, Terminal.app on macOS,
/// the distro's default terminal on Linux).
#[tauri::command]
pub fn open_plugins_folder_in_terminal(dir: String) -> Result<(), String> {
    validate_dir(&dir)?;
    #[cfg(target_os = "windows")]
    {
        // Prefer Windows Terminal (the default on Windows 11); it accepts the
        // path as a single argument, spaces included.
        if let Some(wt) = windows_terminal() {
            if spawn(Command::new(wt).arg("-d").arg(&dir)).is_ok() {
                return Ok(());
            }
        }
        // Fall back to classic PowerShell. `-WorkingDirectory` takes the raw
        // path as its own argument, so no Set-Location quoting needed.
        spawn(
            Command::new("powershell.exe")
                .arg("-NoExit")
                .arg("-WorkingDirectory")
                .arg(&dir),
        )
    }
    #[cfg(target_os = "macos")]
    {
        // `open -a Terminal <dir>` opens Terminal.app with the folder as the
        // working directory (a new window/tab per the user's preferences).
        spawn(Command::new("open").arg("-a").arg("Terminal").arg(&dir))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        open_linux_terminal(&dir)
    }
}

/// Windows Terminal's well-known install location (Windows 11 ships it by
/// default at %LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe).
#[cfg(target_os = "windows")]
fn windows_terminal() -> Option<PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    let wt = PathBuf::from(local)
        .join("Microsoft")
        .join("WindowsApps")
        .join("wt.exe");
    wt.is_file().then_some(wt)
}

/// Linux terminal launch: honor `$TERMINAL` first, then try the common
/// emulators in order — whichever launches wins. Each has its own
/// working-directory flag; a failing spawn just moves to the next candidate.
#[cfg(all(unix, not(target_os = "macos")))]
fn open_linux_terminal(dir: &str) -> Result<(), String> {
    if let Ok(term) = std::env::var("TERMINAL") {
        if !term.trim().is_empty()
            && spawn(Command::new(&term).arg("--working-directory").arg(dir)).is_ok()
        {
            return Ok(());
        }
    }

    const CANDIDATES: &[(&str, &str)] = &[
        ("x-terminal-emulator", "--working-directory"),
        ("gnome-terminal", "--working-directory"),
        ("konsole", "--workdir"),
        ("xfce4-terminal", "--working-directory"),
        ("kitty", "--directory"),
        ("alacritty", "--working-directory"),
    ];
    for (bin, flag) in CANDIDATES {
        if spawn(Command::new(bin).arg(flag).arg(dir)).is_ok() {
            return Ok(());
        }
    }
    Err(
		"no terminal emulator found — install one (e.g. gnome-terminal) or set the $TERMINAL env var"
			.into(),
	)
}
