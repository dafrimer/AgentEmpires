pub mod adapters;
pub mod model;
pub mod monitor;

use model::{Settings, Snapshot};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State,
};

struct AppState {
    snapshot: Arc<Mutex<Snapshot>>,
    settings: Arc<Mutex<Settings>>,
    settings_path: PathBuf,
    companion_positioned: AtomicBool,
}
#[tauri::command]
fn get_snapshot(state: State<AppState>) -> Result<Snapshot, String> {
    state
        .snapshot
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "Monitor unavailable".into())
}
#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    state
        .settings
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "Settings unavailable".into())
}
#[tauri::command]
fn save_settings(settings: Settings, state: State<AppState>) -> Result<(), String> {
    if !(1..=168).contains(&settings.history_hours) || settings.roots.len() != 4 {
        return Err("Choose all four journal roots and 1–168 hours of history".into());
    }
    for path in settings.roots.values() {
        if !std::path::Path::new(path).is_absolute() {
            return Err("Journal roots must be absolute paths".into());
        }
    }
    let encoded = serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&state.settings_path, encoded).map_err(|e| e.to_string())?;
    *state.settings.lock().map_err(|_| "Settings unavailable")? = settings;
    Ok(())
}
#[tauri::command]
fn reveal_source(id: String, state: State<AppState>) -> Result<(), String> {
    let path = state
        .snapshot
        .lock()
        .map_err(|_| "Monitor unavailable")?
        .sessions
        .iter()
        .find(|s| s.id == id)
        .map(|s| s.source_path.clone())
        .ok_or("Session is no longer available")?;
    if !std::path::Path::new(&path).is_file() {
        return Err("The source journal no longer exists".into());
    }
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("/usr/bin/open")
        .args(["-R", &path])
        .status();
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("explorer.exe")
        .arg(format!("/select,{}", path))
        .spawn()
        .map(|_| ());
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let status = std::process::Command::new("xdg-open")
        .arg(
            std::path::Path::new(&path)
                .parent()
                .ok_or("No parent directory")?,
        )
        .status();
    status.map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn set_view(compact: bool, app: tauri::AppHandle) -> Result<(), String> {
    switch_view(&app, compact)
}
fn switch_view(app: &tauri::AppHandle, compact: bool) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or("Map window unavailable")?;
    let buddy = app
        .get_webview_window("buddy")
        .ok_or("Companion unavailable")?;
    if compact {
        // Place the companion once. Its native window retains a dragged position
        // while hidden, including when the user switches back to the full map.
        let state = app.state::<AppState>();
        if !state.companion_positioned.load(Ordering::Acquire) {
            if let Ok(Some(monitor)) = main.current_monitor() {
                let size = monitor.size();
                let pos = monitor.position();
                let scale = monitor.scale_factor();
                buddy
                    .set_position(tauri::PhysicalPosition::new(
                        pos.x + (size.width as f64 - 370. * scale) as i32,
                        pos.y + (size.height as f64 - 350. * scale) as i32,
                    ))
                    .map_err(|e| e.to_string())?;
            }
            state.companion_positioned.store(true, Ordering::Release);
        }
        buddy.show().map_err(|e| e.to_string())?;
        main.hide().map_err(|e| e.to_string())?;
    } else {
        main.show().map_err(|e| e.to_string())?;
        main.unminimize().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
        buddy.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn run() {
    let smoke_test = std::env::args().any(|arg| arg == "--smoke-test");
    tauri::Builder::default()
        .setup(move |app| {
            let dir = if smoke_test {
                std::env::temp_dir().join(format!("agentempires-smoke-{}", std::process::id()))
            } else {
                app.path().app_config_dir()?
            };
            std::fs::create_dir_all(&dir)?;
            let path = dir.join("settings.json");
            let mut settings = std::fs::read(&path)
                .ok()
                .and_then(|s| serde_json::from_slice::<Settings>(&s).ok())
                .unwrap_or_default();
            if smoke_test {
                for (harness, root) in &mut settings.roots {
                    *root = dir.join(harness.key()).to_string_lossy().into_owned();
                }
            }
            let snapshot = Arc::new(Mutex::new(Snapshot {
                scanning: true,
                ..Default::default()
            }));
            let settings = Arc::new(Mutex::new(settings));
            app.manage(AppState {
                snapshot: snapshot.clone(),
                settings: settings.clone(),
                settings_path: path,
                companion_positioned: AtomicBool::new(false),
            });
            std::thread::spawn(move || {
                let mut monitor = monitor::Monitor::new();
                loop {
                    let config = match settings.lock() {
                        Ok(s) => s.clone(),
                        Err(_) => break,
                    };
                    let next = monitor.scan(&config);
                    if let Ok(mut state) = snapshot.lock() {
                        *state = next;
                    }
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            });
            let map = MenuItem::with_id(app, "map", "Open world map", true, None::<&str>)?;
            let buddy =
                MenuItem::with_id(app, "buddy", "Show desktop companion", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit AgentEmpires", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&map, &buddy, &quit])?;
            let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
                tauri::image::Image::new_owned(vec![174, 203, 143, 255].repeat(32 * 32), 32, 32)
            });
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("AgentEmpires")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "map" => {
                        let _ = switch_view(app, false);
                    }
                    "buddy" => {
                        let _ = switch_view(app, true);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            if smoke_test {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    let (send, receive) = std::sync::mpsc::sync_channel(1);
                    let app = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let result = switch_view(&app, true).and_then(|_| {
                            let main = app.get_webview_window("main").ok_or("Missing map")?;
                            let buddy =
                                app.get_webview_window("buddy").ok_or("Missing companion")?;
                            if main.is_visible().map_err(|e| e.to_string())?
                                || !buddy.is_visible().map_err(|e| e.to_string())?
                            {
                                return Err("Companion visibility failed".into());
                            }
                            let original = buddy.outer_position().map_err(|e| e.to_string())?;
                            let moved =
                                tauri::PhysicalPosition::new(original.x - 40, original.y - 40);
                            buddy.set_position(moved).map_err(|e| e.to_string())?;
                            Ok(moved)
                        });
                        let _ = send.send(result);
                    });
                    let first = receive
                        .recv_timeout(std::time::Duration::from_secs(5))
                        .unwrap_or_else(|_| Err("Companion move timed out".into()));
                    // Native move events complete on the main event loop. Give the OS
                    // one turn before checking the retained position.
                    std::thread::sleep(std::time::Duration::from_millis(350));
                    let app = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let result = first.and_then(|moved| {
                            let main = app.get_webview_window("main").ok_or("Missing map")?;
                            let buddy =
                                app.get_webview_window("buddy").ok_or("Missing companion")?;
                            let actual = buddy.outer_position().map_err(|e| e.to_string())?;
                            if actual != moved {
                                return Err(format!(
                                    "Companion move failed: expected ({}, {}), got ({}, {})",
                                    moved.x, moved.y, actual.x, actual.y
                                ));
                            }
                            switch_view(&app, false)?;
                            if !main.is_visible().map_err(|e| e.to_string())?
                                || buddy.is_visible().map_err(|e| e.to_string())?
                            {
                                return Err("Map visibility failed".into());
                            }
                            switch_view(&app, true)?;
                            let restored = buddy.outer_position().map_err(|e| e.to_string())?;
                            if restored != moved {
                                return Err(format!(
                                    "Companion position was reset: expected ({}, {}), got ({}, {})",
                                    moved.x, moved.y, restored.x, restored.y
                                ));
                            }
                            switch_view(&app, false)?;
                            Ok(())
                        });
                        if let Err(error) = &result {
                            eprintln!("Native smoke test: {error}");
                        }
                        let _ = std::fs::remove_dir_all(&dir);
                        app.exit(if result.is_ok() { 0 } else { 1 });
                    });
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = switch_view(window.app_handle(), true);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            get_settings,
            save_settings,
            reveal_source,
            set_view
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start AgentEmpires");
}
