mod config;

use serde::Serialize;
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    io::{BufRead, BufReader, Read},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const REQUIRED_GAMEDATA: [&str; 6] = [
    "SETUP.EXE",
    "EGA.CMN",
    "GAME.PRE",
    "GAME1.P3S",
    "GAME2.P3S",
    "SDMAIN.PVS",
];

#[cfg(not(debug_assertions))]
const PREPARE_HELPER: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/generated/playstuntsdx-prepare.exe"
));

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    let next = !fullscreen;
    window.set_fullscreen(next).map_err(|error| error.to_string())?;
    config::set_value("Display", "Fullscreen", if next { "true" } else { "false" })?;
    Ok(next)
}

#[tauri::command]
fn exit_game(app: tauri::AppHandle) {
    force_feedback::stop();
    app.exit(0);
}

fn application_root() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return std::env::current_dir().map_err(|error| error.to_string());
    }
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    executable
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Could not determine the PlayStunts DX directory.".to_string())
}

fn gamedata_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(executable) = std::env::current_exe() {
        if let Some(directory) = executable.parent() {
            roots.push(directory.join("Gamedata"));
        }
    }
    if let Ok(current) = std::env::current_dir() {
        roots.push(current.join("Gamedata"));
        if let Some(parent) = current.parent() {
            roots.push(parent.join("Gamedata"));
        }
    }
    roots.dedup();
    roots
}

fn preferred_gamedata_root() -> Result<PathBuf, String> {
    Ok(application_root()?.join("Gamedata"))
}

fn complete_gamedata(root: &Path) -> bool {
    REQUIRED_GAMEDATA.iter().all(|name| root.join(name).is_file())
}

fn runtime_root() -> Result<PathBuf, String> {
    Ok(application_root()?.join("Runtime"))
}

fn runtime_game_root() -> Result<PathBuf, String> {
    Ok(runtime_root()?.join("game"))
}

fn runtime_files_ready() -> Result<bool, String> {
    let root = runtime_root()?;
    Ok(root.join("desktop-preparation.json").is_file()
        && root.join("game").join("assets.json").is_file())
}

fn directory_has_files(directory: &Path) -> Result<bool, String> {
    if !directory.is_dir() {
        return Ok(false);
    }
    let mut pending = vec![directory.to_path_buf()];
    while let Some(current) = pending.pop() {
        for entry in fs::read_dir(&current)
            .map_err(|error| format!("Could not scan {}: {error}", current.display()))?
        {
            let entry = entry
                .map_err(|error| format!("Could not scan {}: {error}", current.display()))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
            if file_type.is_file() {
                return Ok(true);
            }
            if file_type.is_dir() {
                pending.push(path);
            }
        }
    }
    Ok(false)
}

fn copy_tree_missing(source: &Path, target: &Path) -> Result<usize, String> {
    if !source.is_dir() {
        return Ok(0);
    }
    let mut copied = 0usize;
    let mut pending = vec![source.to_path_buf()];
    while let Some(current) = pending.pop() {
        for entry in fs::read_dir(&current)
            .map_err(|error| format!("Could not scan {}: {error}", current.display()))?
        {
            let entry = entry
                .map_err(|error| format!("Could not scan {}: {error}", current.display()))?;
            let path = entry.path();
            let relative = path
                .strip_prefix(source)
                .map_err(|error| format!("Could not map {}: {error}", path.display()))?;
            let destination = target.join(relative);
            let file_type = entry
                .file_type()
                .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
            if file_type.is_dir() {
                pending.push(path);
                continue;
            }
            if !file_type.is_file() || destination.exists() {
                continue;
            }
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
            }
            fs::copy(&path, &destination).map_err(|error| {
                format!(
                    "Could not restore {} from {}: {error}",
                    destination.display(),
                    path.display()
                )
            })?;
            copied += 1;
        }
    }
    Ok(copied)
}

fn ensure_hires_fallbacks() -> Result<(), String> {
    let root = application_root()?;
    let hires = root.join("hires");
    let runtime_game = runtime_game_root()?;
    for category in ["backgrounds", "intro", "menu", "cockpit"] {
        let target = hires.join(category);
        if directory_has_files(&target)? {
            continue;
        }
        let source = runtime_game.join(category);
        if !source.is_dir() {
            continue;
        }
        fs::create_dir_all(&target)
            .map_err(|error| format!("Could not create {}: {error}", target.display()))?;
        copy_tree_missing(&source, &target)?;
        if !directory_has_files(&target)? {
            let _ = fs::remove_dir_all(&target);
        }
    }
    Ok(())
}

fn hash_content_tree(root: &Path, directory: &Path, hasher: &mut DefaultHasher) -> Result<(), String> {
    if !directory.is_dir() {
        "<missing>".hash(hasher);
        return Ok(());
    }

    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?;
    entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());

    for entry in entries {
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/")
            .to_lowercase();
        relative.hash(hasher);

        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
        if file_type.is_dir() {
            0u8.hash(hasher);
            hash_content_tree(root, &path, hasher)?;
        } else if file_type.is_file() {
            1u8.hash(hasher);
            let mut file = fs::File::open(&path)
                .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
            let mut buffer = [0u8; 64 * 1024];
            loop {
                let count = file
                    .read(&mut buffer)
                    .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
                if count == 0 {
                    break;
                }
                hasher.write(&buffer[..count]);
            }
        }
    }
    Ok(())
}

fn runtime_content_state(gamedata: &Path) -> Result<String, String> {
    let root = application_root()?;
    let mut hasher = DefaultHasher::new();
    "playstuntsdx-runtime-content-v2".hash(&mut hasher);
    "Gamedata".hash(&mut hasher);
    hash_content_tree(gamedata, gamedata, &mut hasher)?;
    for name in ["Custom Cars", "Custom Tracks", "High Res"] {
        name.hash(&mut hasher);
        hash_content_tree(&root.join(name), &root.join(name), &mut hasher)?;
    }
    Ok(format!("{:016x}\n", hasher.finish()))
}

fn runtime_state_path() -> Result<PathBuf, String> {
    Ok(application_root()?.join("Cache").join(".playstuntsdx-content.state"))
}

fn runtime_is_current(gamedata: &Path) -> Result<bool, String> {
    if !runtime_files_ready()? {
        return Ok(false);
    }
    let stored = match fs::read_to_string(runtime_state_path()?) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("Could not read runtime content state: {error}")),
    };
    Ok(stored == runtime_content_state(gamedata)?)
}

fn checked_runtime_path(path: &str) -> Result<PathBuf, String> {
    let input = Path::new(path);
    if input.is_absolute() {
        return Err("Runtime path must be relative.".to_string());
    }
    let mut clean = PathBuf::new();
    for component in input.components() {
        match component {
            Component::Normal(value) => clean.push(value),
            Component::CurDir => {}
            _ => return Err("Runtime path leaves the game data directory.".to_string()),
        }
    }
    if clean.as_os_str().is_empty() {
        return Err("Runtime path is empty.".to_string());
    }
    Ok(clean)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePreparationProgress {
    stage: String,
    detail: String,
}

fn runtime_progress_path() -> Result<PathBuf, String> {
    Ok(application_root()?.join("Cache").join("runtime-preparation.json"))
}

fn runtime_progress(stage: impl Into<String>, detail: impl Into<String>) {
    let progress = RuntimePreparationProgress {
        stage: stage.into(),
        detail: detail.into(),
    };
    let path = match runtime_progress_path() {
        Ok(path) => path,
        Err(_) => return,
    };
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }
    if let Ok(json) = serde_json::to_vec(&progress) {
        let _ = fs::write(path, json);
    }
}

#[tauri::command]
fn runtime_preparation_status() -> Result<RuntimePreparationProgress, String> {
    let path = runtime_progress_path()?;
    match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|error| format!("Could not read runtime preparation status: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(RuntimePreparationProgress {
            stage: "Starting PlayStunts DX".to_string(),
            detail: "Checking game data and custom content".to_string(),
        }),
        Err(error) => Err(format!("Could not read runtime preparation status: {error}")),
    }
}

#[cfg(not(debug_assertions))]
fn build_runtime(gamedata: &Path) -> Result<(), String> {
    let root = application_root()?;
    let runtime = runtime_root()?;
    let cache = root.join("Cache");
    runtime_progress("Preparing PlayStunts DX", "Custom content changed; rebuilding runtime");
    fs::create_dir_all(&cache)
        .map_err(|error| format!("Could not create {}: {error}", cache.display()))?;
    let log_path = cache.join("prepare-runtime.log");
    let _ = fs::remove_file(root.join("prepare-runtime.log"));
    if runtime.exists() {
        fs::remove_dir_all(&runtime)
            .map_err(|error| format!("Could not replace {}: {error}", runtime.display()))?;
    }

    let helper = std::env::temp_dir().join(format!(
        "playstuntsdx-prepare-{}.exe",
        std::process::id()
    ));
    fs::write(&helper, PREPARE_HELPER)
        .map_err(|error| format!("Could not unpack the PlayStunts DX runtime helper: {error}"))?;

    let mut command = Command::new(&helper);
    command
        .arg("--original")
        .arg(gamedata)
        .arg("--custom-cars")
        .arg(root.join("Custom Cars"))
        .arg("--output")
        .arg(&runtime)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let message = format!("Could not start the PlayStunts DX runtime helper: {error}");
            let _ = fs::write(&log_path, format!("PlayStunts DX runtime preparation\n\n{message}\n"));
            let _ = fs::remove_file(&helper);
            return Err(format!("{message}\nDetails: {}", log_path.display()));
        }
    };

    let stderr_reader = child.stderr.take().map(|stderr| std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    }));

    let mut stdout = String::new();
    if let Some(stdout_pipe) = child.stdout.take() {
        for line in BufReader::new(stdout_pipe).lines() {
            let line = line.map_err(|error| format!("Could not read runtime helper progress: {error}"))?;
            if let Some(progress) = line.strip_prefix("PLAYSTUNTS_PROGRESS\t") {
                let mut parts = progress.splitn(2, '\t');
                runtime_progress(
                    parts.next().unwrap_or("Preparing game"),
                    parts.next().unwrap_or(""),
                );
            } else {
                stdout.push_str(&line);
                stdout.push('\n');
            }
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("Could not finish the PlayStunts DX runtime helper: {error}"))?;
    let stderr = stderr_reader
        .map(|reader| reader.join().unwrap_or_else(|_| "Runtime helper stderr reader failed.".to_string()))
        .unwrap_or_default()
        .trim()
        .to_string();
    let stdout = stdout.trim().to_string();
    let _ = fs::remove_file(&helper);

    let exit_status = status
        .code()
        .map(|code| code.to_string())
        .unwrap_or_else(|| status.to_string());
    let diagnostic = format!(
        "PlayStunts DX runtime preparation\nExit status: {exit_status}\nGamedata: {}\nRuntime: {}\n\nSTDOUT\n------\n{}\n\nSTDERR\n------\n{}\n",
        gamedata.display(),
        runtime.display(),
        if stdout.is_empty() { "<empty>" } else { &stdout },
        if stderr.is_empty() { "<empty>" } else { &stderr },
    );

    if !status.success() {
        let _ = fs::write(&log_path, &diagnostic);
        let _ = fs::remove_dir_all(&runtime);
        let detail = stderr
            .lines()
            .find(|line| line.contains("PlayStunts DX asset preparation failed:"))
            .or_else(|| stderr.lines().find(|line| !line.trim().is_empty()))
            .or_else(|| stdout.lines().find(|line| !line.trim().is_empty()));
        return Err(match detail {
            Some(detail) => format!("{detail}\nDetails: {}", log_path.display()),
            None => format!(
                "The original Stunts files could not be prepared (helper exit status {exit_status}).\nDetails: {}",
                log_path.display()
            ),
        });
    }
    if !runtime_files_ready()? {
        let message = "The original Stunts files were prepared incompletely.";
        let _ = fs::write(&log_path, format!("{diagnostic}\n{message}\n"));
        let _ = fs::remove_dir_all(&runtime);
        return Err(format!("{message}\nDetails: {}", log_path.display()));
    }

    fs::write(runtime_state_path()?, runtime_content_state(gamedata)?)
        .map_err(|error| format!("Could not save runtime content state: {error}"))?;
    let _ = fs::remove_file(&log_path);
    runtime_progress("Runtime ready", "Starting PlayStunts DX");
    Ok(())
}

fn ensure_runtime(gamedata: &Path) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    #[cfg(not(debug_assertions))]
    {
        if runtime_is_current(gamedata)? {
            runtime_progress("Runtime cache ready", "No custom-content changes detected");
            return Ok(());
        }
        build_runtime(gamedata)?;
    }
    Ok(())
}

fn check_gamedata_blocking() -> Result<bool, String> {
    runtime_progress("Starting PlayStunts DX", "Checking original game data and custom content");
    for root in gamedata_roots() {
        if complete_gamedata(&root) {
            ensure_runtime(&root)?;
            ensure_hires_fallbacks()?;
            return Ok(true);
        }
    }

    let root = preferred_gamedata_root()?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
    Ok(false)
}

#[tauri::command]
async fn check_gamedata() -> Result<bool, String> {
    check_gamedata_blocking()
}

fn checked_track_filename(name: &str) -> Result<String, String> {
    let stem = name.trim().to_ascii_uppercase();
    if stem.is_empty() || stem.len() > 8 {
        return Err("Track name must contain between 1 and 8 characters.".to_string());
    }
    if !stem
        .bytes()
        .all(|value| value.is_ascii_alphanumeric() || value == b'_' || value == b'-')
    {
        return Err("Track name contains unsupported filename characters.".to_string());
    }
    Ok(format!("{stem}.TRK"))
}

fn collect_custom_replays(directory: &Path, root: &Path, output: &mut Vec<String>) -> Result<(), String> {
    if !directory.is_dir() {
        return Ok(());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?;
    entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    for entry in entries {
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
        if file_type.is_dir() {
            collect_custom_replays(&path, root, output)?;
        } else if file_type.is_file()
            && path
                .extension()
                .map(|extension| extension.to_string_lossy().eq_ignore_ascii_case("rpl"))
                .unwrap_or(false)
        {
            let relative = path
                .strip_prefix(root)
                .map_err(|error| format!("Could not relativize {}: {error}", path.display()))?;
            output.push(relative.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

#[tauri::command]
fn list_custom_replays() -> Result<Vec<String>, String> {
    let root = application_root()?.join("Custom Tracks");
    let mut replays = Vec::new();
    collect_custom_replays(&root, &root, &mut replays)?;
    replays.sort_by_key(|value| value.to_ascii_lowercase());
    Ok(replays)
}

fn checked_custom_replay_path(relative: &str) -> Result<PathBuf, String> {
    let input = Path::new(relative.trim());
    if input.as_os_str().is_empty()
        || input.is_absolute()
        || input.components().any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Replay path must stay inside Custom Tracks.".to_string());
    }
    if !input
        .extension()
        .map(|extension| extension.to_string_lossy().eq_ignore_ascii_case("rpl"))
        .unwrap_or(false)
    {
        return Err("Replay path must reference an .RPL file.".to_string());
    }
    let root = fs::canonicalize(application_root()?.join("Custom Tracks"))
        .map_err(|error| format!("Could not open Custom Tracks: {error}"))?;
    let path = fs::canonicalize(root.join(input))
        .map_err(|error| format!("Could not open custom replay {}: {error}", input.display()))?;
    if !path.starts_with(&root) || !path.is_file() {
        return Err("Replay path must reference a file inside Custom Tracks.".to_string());
    }
    Ok(path)
}

#[tauri::command]
fn read_custom_replay(path: String) -> Result<Vec<u8>, String> {
    let replay = checked_custom_replay_path(&path)?;
    fs::read(&replay)
        .map_err(|error| format!("Could not read custom replay {}: {error}", replay.display()))
}

fn find_custom_track(directory: &Path, filename: &str) -> Result<Option<PathBuf>, String> {
    if !directory.is_dir() {
        return Ok(None);
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?;
    entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    for entry in entries {
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
        if file_type.is_dir() {
            if let Some(found) = find_custom_track(&path, filename)? {
                return Ok(Some(found));
            }
        } else if file_type.is_file()
            && entry.file_name().to_string_lossy().eq_ignore_ascii_case(filename)
        {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

#[tauri::command]
fn custom_track_exists(name: String) -> Result<bool, String> {
    let filename = checked_track_filename(&name)?;
    Ok(find_custom_track(&application_root()?.join("Custom Tracks"), &filename)?.is_some())
}

#[tauri::command]
fn read_custom_track(name: String) -> Result<Vec<u8>, String> {
    let filename = checked_track_filename(&name)?;
    let root = application_root()?.join("Custom Tracks");
    let path = find_custom_track(&root, &filename)?
        .ok_or_else(|| format!("Custom track {filename} was not found."))?;
    fs::read(&path).map_err(|error| format!("Could not read custom track {}: {error}", path.display()))
}

#[tauri::command]
fn write_custom_track(name: String, data: Vec<u8>) -> Result<String, String> {
    // Bliss "one file" tracks keep the standard 1802-byte Stunts payload
    // first and append metadata. Stunts itself ignores the tail; the Bliss
    // manual documents 13802 bytes as the practical upper bound.
    if data.len() < 1802 || data.len() > 13802 {
        return Err(format!(
            "Custom Stunts/Bliss tracks must contain 1802 to 13802 bytes (got {}).",
            data.len()
        ));
    }
    let filename = checked_track_filename(&name)?;
    let root = application_root()?.join("Custom Tracks");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
    let path = match find_custom_track(&root, &filename)? {
        Some(existing) => existing,
        None => root.join(&filename),
    };
    fs::write(&path, data)
        .map_err(|error| format!("Could not write custom track {}: {error}", path.display()))?;
    Ok(path
        .strip_prefix(application_root()?)
        .unwrap_or(&path)
        .to_string_lossy()
        .replace('\\', "/"))
}

#[tauri::command]
fn write_track_shot(filename: String, data: Vec<u8>) -> Result<String, String> {
    let name = filename.trim();
    if name.is_empty() || name.len() > 96 {
        return Err("Track-shot filename is invalid.".to_string());
    }
    let lower = name.to_ascii_lowercase();
    if !(lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".bmp")) {
        return Err("Track-shot format must be PNG, JPEG or BMP.".to_string());
    }
    if name.chars().any(|value| matches!(value, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err("Track-shot filename contains unsupported characters.".to_string());
    }
    let root = application_root()?.join("Track Shots");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
    let path = root.join(name);
    fs::write(&path, data)
        .map_err(|error| format!("Could not write track shot {}: {error}", path.display()))?;
    Ok(path
        .strip_prefix(application_root()?)
        .unwrap_or(&path)
        .to_string_lossy()
        .replace('\\', "/"))
}

#[tauri::command]
fn bliss_http_get(url: String) -> Result<Vec<u8>, String> {
    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err("Tournament URL must use http:// or https://.".to_string());
    }
    let output = Command::new("curl.exe")
        .args([
            "--location",
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "20",
            "--max-filesize",
            "4194304",
            url.trim(),
        ])
        .output()
        .map_err(|error| format!("Could not start Windows curl: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("Tournament request failed with status {}.", output.status)
        } else {
            detail
        });
    }
    Ok(output.stdout)
}

#[tauri::command]
fn import_custom_car_package(filename: String, data: Vec<u8>) -> Result<(), String> {
    let name = filename.trim();
    if name.is_empty() || name.len() > 128 || !name.to_ascii_lowercase().ends_with(".zip") {
        return Err("Custom car import requires a ZIP package.".to_string());
    }
    if name.chars().any(|value| matches!(value, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err("Custom car ZIP filename contains unsupported characters.".to_string());
    }
    if data.is_empty() || data.len() > 64 * 1024 * 1024 {
        return Err("Custom car ZIP is empty or too large.".to_string());
    }
    let root = application_root()?.join("Custom Cars");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
    let path = root.join(name);
    fs::write(&path, data)
        .map_err(|error| format!("Could not write custom car package {}: {error}", path.display()))?;
    let gamedata = gamedata_roots().into_iter().find(|path| complete_gamedata(path))
        .ok_or_else(|| "Original Gamedata could not be found.".to_string())?;
    #[cfg(not(debug_assertions))]
    build_runtime(&gamedata)?;
    #[cfg(debug_assertions)]
    {
        let _ = gamedata;
    }
    Ok(())
}

#[tauri::command]
fn runtime_file_exists(path: String) -> Result<bool, String> {
    let path = runtime_game_root()?.join(checked_runtime_path(&path)?);
    Ok(path.is_file())
}

#[tauri::command]
fn read_runtime_file(path: String) -> Result<tauri::ipc::Response, String> {
    let path = runtime_game_root()?.join(checked_runtime_path(&path)?);
    let bytes = fs::read(&path)
        .map_err(|error| format!("Could not read runtime file {}: {error}", path.display()))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn write_runtime_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let path = runtime_game_root()?.join(checked_runtime_path(&path)?);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    fs::write(&path, data)
        .map_err(|error| format!("Could not write runtime file {}: {error}", path.display()))
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
        "MT-32 {kind} ROM not found. Put ctrl_mt32_1_07.rom and pcm_mt32.rom (or MT32_CONTROL.ROM and MT32_PCM.ROM) in the mt32 folder next to PlayStunts DX.exe."
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

// Retain the old command name for the existing FFB frontend, but return the
// unified config.ini. No separate ffb.ini is created or read anymore.
#[tauri::command]
fn native_force_feedback_config() -> Result<config::NativeConfigFile, String> {
    config::ensure()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeJoystick {
    id: String,
    name: String,
    axes: Vec<f64>,
    buttons: Vec<f64>,
    pov: Option<u32>,
}

#[cfg(target_os = "windows")]
mod winmm_joystick {
    use super::NativeJoystick;

    const MAXPNAMELEN: usize = 32;
    const MAX_JOYSTICKOEMVXDNAME: usize = 260;
    const JOYERR_NOERROR: u32 = 0;
    const JOY_RETURNALL: u32 = 0x0000_00ff;
    const JOY_POVCENTERED: u32 = 0xffff;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct JoyCapsW {
        wMid: u16,
        wPid: u16,
        szPname: [u16; MAXPNAMELEN],
        wXmin: u32,
        wXmax: u32,
        wYmin: u32,
        wYmax: u32,
        wZmin: u32,
        wZmax: u32,
        wNumButtons: u32,
        wPeriodMin: u32,
        wPeriodMax: u32,
        wRmin: u32,
        wRmax: u32,
        wUmin: u32,
        wUmax: u32,
        wVmin: u32,
        wVmax: u32,
        wCaps: u32,
        wMaxAxes: u32,
        wNumAxes: u32,
        wMaxButtons: u32,
        szRegKey: [u16; MAXPNAMELEN],
        szOEMVxD: [u16; MAX_JOYSTICKOEMVXDNAME],
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct JoyInfoEx {
        dwSize: u32,
        dwFlags: u32,
        dwXpos: u32,
        dwYpos: u32,
        dwZpos: u32,
        dwRpos: u32,
        dwUpos: u32,
        dwVpos: u32,
        dwButtons: u32,
        dwButtonNumber: u32,
        dwPOV: u32,
        dwReserved1: u32,
        dwReserved2: u32,
    }

    #[link(name = "winmm")]
    extern "system" {
        fn joyGetNumDevs() -> u32;
        fn joyGetDevCapsW(id: usize, caps: *mut JoyCapsW, size: u32) -> u32;
        fn joyGetPosEx(id: u32, info: *mut JoyInfoEx) -> u32;
    }

    fn wide_string(value: &[u16]) -> String {
        let end = value.iter().position(|&c| c == 0).unwrap_or(value.len());
        String::from_utf16_lossy(&value[..end])
    }

    fn normalize(value: u32, min: u32, max: u32) -> f64 {
        if max <= min {
            return 0.0;
        }
        (((value.saturating_sub(min)) as f64 / (max - min) as f64) * 2.0 - 1.0)
            .clamp(-1.0, 1.0)
    }

    pub fn read() -> Vec<NativeJoystick> {
        let mut devices = Vec::new();
        let count = unsafe { joyGetNumDevs() };
        for index in 0..count {
            let mut caps: JoyCapsW = unsafe { std::mem::zeroed() };
            if unsafe {
                joyGetDevCapsW(
                    index as usize,
                    &mut caps,
                    std::mem::size_of::<JoyCapsW>() as u32,
                )
            } != JOYERR_NOERROR
            {
                continue;
            }

            let mut info: JoyInfoEx = unsafe { std::mem::zeroed() };
            info.dwSize = std::mem::size_of::<JoyInfoEx>() as u32;
            info.dwFlags = JOY_RETURNALL;
            if unsafe { joyGetPosEx(index, &mut info) } != JOYERR_NOERROR {
                continue;
            }

            let raw_axes = [
                (info.dwXpos, caps.wXmin, caps.wXmax),
                (info.dwYpos, caps.wYmin, caps.wYmax),
                (info.dwZpos, caps.wZmin, caps.wZmax),
                (info.dwRpos, caps.wRmin, caps.wRmax),
                (info.dwUpos, caps.wUmin, caps.wUmax),
                (info.dwVpos, caps.wVmin, caps.wVmax),
            ];
            let axis_count = (caps.wNumAxes as usize).min(raw_axes.len());
            let axes = raw_axes[..axis_count]
                .iter()
                .map(|&(value, min, max)| normalize(value, min, max))
                .collect();
            let button_count = (caps.wNumButtons as usize).min(32);
            let buttons = (0..button_count)
                .map(|button| if info.dwButtons & (1u32 << button) != 0 { 1.0 } else { 0.0 })
                .collect();
            let name = wide_string(&caps.szPname);
            devices.push(NativeJoystick {
                id: format!("winmm:{:04x}:{:04x}:{index}", caps.wMid, caps.wPid),
                name: if name.is_empty() {
                    format!("Windows Joystick {index}")
                } else {
                    name
                },
                axes,
                buttons,
                pov: if info.dwPOV == JOY_POVCENTERED || info.dwPOV >= 36000 {
                    None
                } else {
                    Some(info.dwPOV)
                },
            });
        }
        devices
    }
}

#[tauri::command]
fn native_joysticks() -> Vec<NativeJoystick> {
    #[cfg(target_os = "windows")]
    {
        return winmm_joystick::read();
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
mod force_feedback {
    #[link(name = "stunts_ffb", kind = "static")]
    extern "C" {
        fn stunts_ffb_set_force(force: i32) -> i32;
        fn stunts_ffb_status() -> i32;
        fn stunts_ffb_stop();
    }

    pub fn set(force: f64) -> i32 {
        let normalized = force.clamp(-1.0, 1.0);
        unsafe { stunts_ffb_set_force((normalized * 10_000.0).round() as i32) }
    }

    pub fn status() -> i32 {
        unsafe { stunts_ffb_status() }
    }

    pub fn stop() {
        unsafe { stunts_ffb_stop(); }
    }
}

#[cfg(not(target_os = "windows"))]
mod force_feedback {
    pub fn set(_force: f64) -> i32 {
        -1
    }
    pub fn status() -> i32 {
        -1
    }
    pub fn stop() {}
}

#[tauri::command]
fn native_set_force_feedback(force: f64) -> i32 {
    force_feedback::set(force)
}

#[tauri::command]
fn native_force_feedback_status() -> i32 {
    force_feedback::status()
}

#[tauri::command]
fn native_stop_force_feedback() {
    force_feedback::stop();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            toggle_fullscreen,
            exit_game,
            check_gamedata,
            runtime_preparation_status,
            runtime_file_exists,
            read_runtime_file,
            write_runtime_file,
            custom_track_exists,
            read_custom_track,
            write_custom_track,
            list_custom_replays,
            read_custom_replay,
            write_track_shot,
            import_custom_car_package,
            bliss_http_get,
            toggle_mt32_panel,
            check_mt32_roms,
            read_mt32_rom,
            native_joysticks,
            native_force_feedback_config,
            config::native_config,
            config::native_config_set,
            native_set_force_feedback,
            native_force_feedback_status,
            native_stop_force_feedback
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlayStunts DX");
}
