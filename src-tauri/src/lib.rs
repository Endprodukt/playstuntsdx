use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
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

fn runtime_is_ready() -> Result<bool, String> {
    let root = runtime_root()?;
    Ok(root.join("desktop-preparation.json").is_file()
        && root.join("game").join("assets.json").is_file())
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

#[cfg(not(debug_assertions))]
fn build_runtime(gamedata: &Path) -> Result<(), String> {
    let runtime = runtime_root()?;
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
        .arg("--output")
        .arg(&runtime);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let output = command.output();
    let _ = fs::remove_file(&helper);
    let output = output.map_err(|error| format!("Could not start the PlayStunts DX runtime helper: {error}"))?;
    if !output.status.success() {
        let _ = fs::remove_dir_all(&runtime);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            "The original Stunts files could not be prepared.".to_string()
        } else {
            detail
        });
    }
    if !runtime_is_ready()? {
        let _ = fs::remove_dir_all(&runtime);
        return Err("The original Stunts files were prepared incompletely.".to_string());
    }
    Ok(())
}

fn ensure_runtime(gamedata: &Path) -> Result<(), String> {
    if cfg!(debug_assertions) || runtime_is_ready()? {
        return Ok(());
    }
    #[cfg(not(debug_assertions))]
    {
        build_runtime(gamedata)?;
    }
    Ok(())
}

#[tauri::command]
fn check_gamedata() -> Result<bool, String> {
    for root in gamedata_roots() {
        if complete_gamedata(&root) {
            ensure_runtime(&root)?;
            return Ok(true);
        }
    }

    let root = preferred_gamedata_root()?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
    Ok(false)
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

const DEFAULT_FFB_INI: &str = r#"; ============================================================
; PlayStunts DX - Force Feedback Configuration
; ============================================================
;
; Percent values describe the effect's share of full DirectInput force.
; Example: 15 = 15%, 0.8 = 0.8%.
;
; Range       = accepted technical range. Values outside it are clamped.
; Recommended = useful tuning range for most wheels.
; Default     = current PlayStunts DX tuning.
;
; Missing or invalid values fall back to the built-in default for that value.
; Delete this file to have PlayStunts DX generate a fresh default file.
; Use "Reload ffb.ini" in Wheel Setup [F8] after editing; no restart is needed.
; ============================================================

[General]
; Base multiplier for steering/slide/grass physics.
; Range: 0 - 300 %
; Recommended: 100 - 240 %
; Default: 180
PhysicsStrength=180

; Limit applied to the continuous physics force before transient bumps.
; Range: 10 - 100 %
; Recommended: 70 - 95 %
; Default: 90
PhysicsLimit=90

; Absolute final DirectInput force limit for all effects combined.
; Range: 10 - 100 %
; Recommended: 80 - 100 %
; Default: 98
MaxForce=98

[Centering]
; Low-speed self-aligning force at full steering input.
; Range: 0 - 100 %
; Recommended: 2 - 15 %
; Default: 5.5
BaseForce=5.5

; Additional self-aligning force added as road speed increases.
; Range: 0 - 100 %
; Recommended: 10 - 40 %
; Default: 24.5
SpeedForce=24.5

; On the starting truck the car is stationary, so BaseForce is used directly.

[Slide]
; Counter-steer contribution from signed tyre slip.
; Range: 0 - 100 %
; Recommended: 15 - 55 %
; Default: 34
SlipForce=34

; Counter-steer contribution from vehicle spin/yaw.
; Range: 0 - 100 %
; Recommended: 10 - 40 %
; Default: 20
SpinForce=20

[Grass]
; Per-wheel grass/off-road vibration strength.
; Range: 0 - 100 %
; Recommended: 5 - 30 %
; Default: 13
Strength=13

; Grass vibration frequency at low speed.
; Range: 1 - 30 Hz
; Recommended: 8 - 20 Hz
; Default: 15
FrequencyMin=15

; Grass vibration frequency at high speed.
; Range: 1 - 40 Hz
; Recommended: 20 - 35 Hz
; Default: 33
FrequencyMax=33

[Landing]
; Original wheel-contact fall speed needed before a landing bump starts.
; Range: 0 - 1000
; Recommended: 150 - 300
; Original Stunts hard-impact threshold: 190
; Default: 190
MinFallSpeed=190

; Fall speed at which landing strength reaches MaxStrength.
; Range: 1 - 2000
; Recommended: 400 - 1000
; Default: 593 (matches the current PlayStunts DX tuning saturation)
MaxFallSpeed=593

; Landing bump strength at MinFallSpeed.
; Range: 0 - 100 %
; Recommended: 15 - 45 %
; Default: 28
MinStrength=28

; Landing bump strength at or above MaxFallSpeed.
; Range: 0 - 100 %
; Recommended: 50 - 95 %
; Default: 90
MaxStrength=90

; Complete landing pulse duration.
; Range: 30 - 300 ms
; Recommended: 70 - 180 ms
; Default: 120
DurationMs=120

[GearShift]
; Short bump when the real Stunts engine changes gear.
; Range: 0 - 100 %
; Recommended: 5 - 35 %
; Default: 15
Strength=15

; Complete gear-shift pulse duration.
; Range: 30 - 250 ms
; Recommended: 70 - 150 ms
; Default: 110
DurationMs=110

[Engine]
; Engine wobble at idle, as percent of full force.
; Range: 0 - 30 %
; Recommended: 0 - 3 %
; Default: 0.8
MinStrength=0.8

; Engine wobble near maximum RPM.
; Range: 0 - 30 %
; Recommended: 0.5 - 5 %
; Default: 2.0
MaxStrength=2.0

; Deliberately slow tactile frequency at low RPM.
; Range: 1 - 10 Hz
; Recommended: 2 - 5 Hz
; Default: 3
FrequencyMin=3

; Deliberately slow tactile frequency at high RPM.
; Range: 2 - 12 Hz
; Recommended: 4 - 8 Hz
; Default: 6
FrequencyMax=6

[Crash]
; Minimum crash kick strength at low collision speed.
; Range: 0 - 100 %
; Recommended: 40 - 85 %
; Default: 72
MinStrength=72

; Maximum crash kick strength.
; Range: 0 - 100 %
; Recommended: 70 - 100 %
; Default: 100
MaxStrength=100

; Speed where the crash kick reaches MaxStrength.
; Range: 10 - 200 mph
; Recommended: 40 - 100 mph
; Default: 70
SpeedForMaxMph=70

; Opposite-direction rebound after the main crash kick.
; Range: 0 - 100 % of the crash kick
; Recommended: 10 - 50 %
; Default: 32
ReboundStrength=32

; Duration of the strong first part of the crash kick.
; Range: 30 - 300 ms
; Recommended: 80 - 220 ms
; Default: 150
MainDurationMs=150

; Total crash effect duration, including rebound.
; Range: 60 - 500 ms
; Recommended: 150 - 350 ms
; Default: 240
TotalDurationMs=240

[Menu]
; Selection detent strength in the original Stunts menus.
; Range: 0 - 100 %
; Recommended: 5 - 35 %
; Default: 24
DetentStrength=24

; Duration of one menu detent.
; Range: 20 - 200 ms
; Recommended: 50 - 120 ms
; Default: 90
DetentDurationMs=90

; Spacing between detents while a wheel/menu direction is held.
; Range: 80 - 500 ms
; Recommended: 120 - 300 ms
; Default: 190
RepeatMs=190
"#;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeForceFeedbackConfigFile {
    content: String,
    path: String,
    created: bool,
}

fn force_feedback_config_path() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Could not locate PlayStunts DX executable: {error}"))?;
    let directory = executable
        .parent()
        .ok_or_else(|| "Could not locate PlayStunts DX executable directory".to_string())?;
    Ok(directory.join("ffb.ini"))
}

#[tauri::command]
fn native_force_feedback_config() -> Result<NativeForceFeedbackConfigFile, String> {
    let path = force_feedback_config_path()?;
    let created = if path.exists() {
        false
    } else {
        fs::write(&path, DEFAULT_FFB_INI)
            .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
        true
    };
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    Ok(NativeForceFeedbackConfigFile {
        content,
        path: path.to_string_lossy().into_owned(),
        created,
    })
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
                name: if name.is_empty() {
                    format!("Windows Joystick {index}")
                } else {
                    name
                },
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
            runtime_file_exists,
            read_runtime_file,
            write_runtime_file,
            toggle_mt32_panel,
            check_mt32_roms,
            read_mt32_rom,
            native_joysticks,
            native_force_feedback_config,
            native_set_force_feedback,
            native_force_feedback_status,
            native_stop_force_feedback
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlayStunts DX");
}
