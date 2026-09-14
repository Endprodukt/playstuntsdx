use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    let next = !fullscreen;
    window.set_fullscreen(next).map_err(|error| error.to_string())?;
    Ok(next)
}

#[tauri::command]
fn exit_game(app: tauri::AppHandle) {
    force_feedback::stop();
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeJoystick {
    id: String,
    name: String,
    axes: Vec<f64>,
    buttons: Vec<f64>,
}

#[cfg(target_os = "windows")]
mod winmm_joystick {
    use super::NativeJoystick;

    const MAXPNAMELEN: usize = 32;
    const MAX_JOYSTICKOEMVXDNAME: usize = 260;
    const JOYERR_NOERROR: u32 = 0;
    const JOY_RETURNALL: u32 = 0x0000_00ff;

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
                name: if name.is_empty() { format!("Windows Joystick {index}") } else { name },
                axes,
                buttons,
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
        unsafe { stunts_ffb_stop() }
    }
}

#[cfg(not(target_os = "windows"))]
mod force_feedback {
    pub fn set(_force: f64) -> i32 { -1 }
    pub fn status() -> i32 { -1 }
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
            toggle_mt32_panel,
            check_mt32_roms,
            read_mt32_rom,
            native_joysticks,
            native_set_force_feedback,
            native_force_feedback_status,
            native_stop_force_feedback
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlayStunts DX");
}
