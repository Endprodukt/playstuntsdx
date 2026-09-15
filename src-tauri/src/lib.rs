use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GameDataStatus {
    ready: bool,
    path: String,
}

fn executable_directory() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|executable| executable.parent().map(Path::to_path_buf))
}

fn gamedata_candidates() -> Vec<PathBuf> {
    let executable = executable_directory().map(|directory| directory.join("Gamedata"));
    let working = std::env::current_dir().ok().map(|directory| directory.join("Gamedata"));

    let mut roots = if cfg!(debug_assertions) {
        [working, executable].into_iter().flatten().collect::<Vec<_>>()
    } else {
        [executable, working].into_iter().flatten().collect::<Vec<_>>()
    };
    roots.dedup();
    roots
}

fn gamedata_ready(root: &Path) -> bool {
    ["GAME.PRE", "GAME1.P3S", "MAIN.RES"]
        .iter()
        .all(|name| root.join(name).is_file())
}

#[tauri::command]
fn check_gamedata() -> GameDataStatus {
    let roots = gamedata_candidates();
    if let Some(root) = roots.iter().find(|root| gamedata_ready(root)) {
        return GameDataStatus {
            ready: true,
            path: root.to_string_lossy().into_owned(),
        };
    }

    let root = roots.into_iter().next().unwrap_or_else(|| PathBuf::from("Gamedata"));
    let _ = fs::create_dir_all(&root);
    GameDataStatus {
        ready: false,
        path: root.to_string_lossy().into_owned(),
    }
}

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    let next = !fullscreen;
    window.set_fullscreen(next).map_err(|error| error.to_string())?;
    Ok(next)
}

#[tauri::command]
fn exit_game(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn toggle_mt32_panel(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(panel) = app.get_webview_window("mt32-panel") {
        let visible = panel.is_visible().map_err(|error| error.to_string())?;
        if visible {
            panel.hide().map_err(|error| error.to_string())?;
            if let Some(main) = app.get_webview_window("main") {
                main.set_focus().map_err(|error| error.to_string())?;
            }
            return Ok(false);
        }
        panel.show().map_err(|error| error.to_string())?;
        panel.set_focus().map_err(|error| error.to_string())?;
        return Ok(true);
    }

    let panel = WebviewWindowBuilder::new(
        &app,
        "mt32-panel",
        WebviewUrl::App("index.html".into()),
    )
    .title("Roland MT-32 - PlayStunts DX")
    .inner_size(1180.0, 470.0)
    .resizable(true)
    .center()
    .devtools(false)
    .initialization_script("window.__PLAYSTUNTS_DX_WINDOW__ = 'mt32';")
    .build()
    .map_err(|error| error.to_string())?;
    panel.set_focus().map_err(|error| error.to_string())?;
    Ok(true)
}

fn mt32_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(executable) = std::env::current_exe() {
        if let Some(directory) = executable.parent() {
            roots.push(directory.join("mt32"));
        }
    }
    if let Ok(current) = std::env::current_dir() {
        roots.push(current.join("mt32"));
        if let Some(parent) = current.parent() {
            roots.push(parent.join("mt32"));
        }
    }
    roots.dedup();
    roots
}

fn mt32_names(kind: &str) -> Result<&'static [&'static str], String> {
    match kind {
        "control" => Ok(&["ctrl_mt32_1_07.rom", "MT32_CONTROL.ROM"]),
        "pcm" => Ok(&["pcm_mt32.rom", "MT32_PCM.ROM"]),
        _ => Err(format!("Unknown MT-32 ROM kind: {kind}")),
    }
}

fn find_mt32_rom(kind: &str) -> Result<PathBuf, String> {
    let names = mt32_names(kind)?;
    for root in mt32_roots() {
        for name in names {
            let path = root.join(name);
            if path.is_file() {
                return Ok(path);
            }
        }
    }
    Err(format!(
        "MT-32 {kind} ROM not found. Put ctrl_mt32_1_07.rom and pcm_mt32.rom (or MT32_CONTROL.ROM and MT32_PCM.ROM) in the mt32 folder next to PlayStuntsDX.exe."
    ))
}

#[tauri::command]
fn check_mt32_roms() -> Result<(), String> {
    find_mt32_rom("control")?;
    find_mt32_rom("pcm")?;
    Ok(())
}

#[tauri::command]
fn read_mt32_rom(kind: String) -> Result<Vec<u8>, String> {
    let path = find_mt32_rom(&kind)?;
    fs::read(&path).map_err(|error| format!("Could not read {}: {error}", path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_gamedata,
            toggle_fullscreen,
            exit_game,
            toggle_mt32_panel,
            check_mt32_roms,
            read_mt32_rom
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlayStunts DX");
}
