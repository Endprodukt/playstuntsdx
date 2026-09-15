use serde::Serialize;
use std::{fs, path::{Path, PathBuf}, time::UNIX_EPOCH};

const DEFAULT_CONFIG: &str = include_str!("../config.default.ini");
const CUSTOM_CARS_STATE: &str = ".playstuntsdx-custom-cars.state";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeConfigFile {
    pub content: String,
    pub path: String,
    pub created: bool,
}

fn application_root() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return std::env::current_dir().map_err(|error| error.to_string());
    }
    let executable = std::env::current_exe()
        .map_err(|error| format!("Could not locate PlayStunts DX executable: {error}"))?;
    executable
        .parent()
        .map(|path| path.to_path_buf())
        .ok_or_else(|| "Could not locate PlayStunts DX executable directory".to_string())
}

fn collect_custom_car_state(root: &Path, directory: &Path, rows: &mut Vec<String>) -> Result<(), String> {
    if !directory.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Could not scan {}: {error}", directory.display()))?
    {
        let entry = entry.map_err(|error| format!("Could not scan {}: {error}", directory.display()))?;
        let path = entry.path();
        if path.is_dir() {
            collect_custom_car_state(root, &path, rows)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| format!("{}.{}", value.as_secs(), value.subsec_nanos()))
            .unwrap_or_else(|| "unknown".to_string());
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        rows.push(format!("{}\t{}\t{}", relative, metadata.len(), modified));
    }
    Ok(())
}

fn refresh_runtime_for_custom_cars() -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    let root = application_root()?;
    let custom_root = root.join("Custom Cars");
    let state_path = root.join(CUSTOM_CARS_STATE);
    let mut rows = Vec::new();
    collect_custom_car_state(&custom_root, &custom_root, &mut rows)?;
    rows.sort_by_key(|row| row.to_ascii_lowercase());
    let current = rows.join("\n");
    let previous = fs::read_to_string(&state_path).ok();
    if previous.as_deref() == Some(current.as_str()) {
        return Ok(());
    }

    let runtime = root.join("Runtime");
    if runtime.exists() {
        fs::remove_dir_all(&runtime)
            .map_err(|error| format!("Could not refresh {} after Custom Cars changed: {error}", runtime.display()))?;
    }
    fs::write(&state_path, current)
        .map_err(|error| format!("Could not save Custom Cars state {}: {error}", state_path.display()))?;
    Ok(())
}

pub fn path() -> Result<PathBuf, String> {
    Ok(application_root()?.join("config.ini"))
}

pub fn ensure() -> Result<NativeConfigFile, String> {
    refresh_runtime_for_custom_cars()?;
    let path = path()?;
    let created = if path.exists() {
        false
    } else {
        fs::write(&path, DEFAULT_CONFIG)
            .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
        true
    };
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    Ok(NativeConfigFile {
        content,
        path: path.to_string_lossy().into_owned(),
        created,
    })
}

fn find_value(content: &str, wanted_section: &str, wanted_key: &str) -> Option<String> {
    let mut section = String::new();
    for raw in content.trim_start_matches('\u{feff}').lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if let Some(name) = line.strip_prefix('[').and_then(|value| value.strip_suffix(']')) {
            section = name.trim().to_ascii_lowercase();
            continue;
        }
        if !section.eq_ignore_ascii_case(wanted_section) {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim().eq_ignore_ascii_case(wanted_key) {
            return Some(value.trim().to_string());
        }
    }
    None
}

pub fn value(section: &str, key: &str) -> Result<Option<String>, String> {
    let file = ensure()?;
    Ok(find_value(&file.content, section, key))
}

pub fn bool_value(section: &str, key: &str, fallback: bool) -> Result<bool, String> {
    let Some(value) = value(section, key)? else {
        return Ok(fallback);
    };
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => Ok(fallback),
    }
}

fn validate_name(kind: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.contains(['\r', '\n', '[', ']', '=']) {
        return Err(format!("Invalid config {kind}."));
    }
    Ok(())
}

pub fn set_value(section: &str, key: &str, value: &str) -> Result<(), String> {
    validate_name("section", section)?;
    validate_name("key", key)?;
    if value.contains(['\r', '\n']) {
        return Err("Config values cannot contain line breaks.".to_string());
    }

    let file = ensure()?;
    let newline = if file.content.contains("\r\n") { "\r\n" } else { "\n" };
    let had_final_newline = file.content.ends_with('\n');
    let mut lines: Vec<String> = file.content.lines().map(str::to_string).collect();
    let mut current_section = String::new();
    let mut target_section_start: Option<usize> = None;
    let mut target_section_end = lines.len();
    let mut target_key: Option<usize> = None;

    for (index, raw) in lines.iter().enumerate() {
        let line = raw.trim();
        if let Some(name) = line.strip_prefix('[').and_then(|entry| entry.strip_suffix(']')) {
            let next_section = name.trim().to_ascii_lowercase();
            if target_section_start.is_some() && target_section_end == lines.len() {
                target_section_end = index;
            }
            current_section = next_section;
            if current_section.eq_ignore_ascii_case(section) && target_section_start.is_none() {
                target_section_start = Some(index);
            }
            continue;
        }
        if !current_section.eq_ignore_ascii_case(section) {
            continue;
        }
        if let Some((candidate, _)) = line.split_once('=') {
            if candidate.trim().eq_ignore_ascii_case(key) {
                target_key = Some(index);
                break;
            }
        }
    }

    if let Some(index) = target_key {
        let existing_key = lines[index]
            .split_once('=')
            .map(|(name, _)| name.trim())
            .unwrap_or(key);
        lines[index] = format!("{existing_key}={value}");
    } else if target_section_start.is_some() {
        lines.insert(target_section_end, format!("{key}={value}"));
    } else {
        if !lines.is_empty() && !lines.last().is_some_and(|line| line.trim().is_empty()) {
            lines.push(String::new());
        }
        lines.push(format!("[{section}]"));
        lines.push(format!("{key}={value}"));
    }

    let mut output = lines.join(newline);
    if had_final_newline || !output.is_empty() {
        output.push_str(newline);
    }
    let path = path()?;
    fs::write(&path, output)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}

#[tauri::command]
pub fn native_config() -> Result<NativeConfigFile, String> {
    ensure()
}

#[tauri::command]
pub fn native_config_set(section: String, key: String, value: String) -> Result<(), String> {
    set_value(&section, &key, &value)
}
