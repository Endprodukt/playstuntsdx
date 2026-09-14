# PlayStunts DX — Windows desktop build

This branch adds a native Windows desktop shell around the reconstructed PlayStunts runtime. The existing browser/Cloudflare build remains separate and unchanged.

The desktop UI is built with Vite and embedded into a Tauri 2 application. On Windows Tauri uses WebView2 for rendering, but the user launches a normal `playstuntsdx.exe`: there is no browser window, address bar or local web server in the release build. The Rust/Tauri layer is also the intended home for native wheel and force-feedback support later.

## Requirements

- Windows 10 or Windows 11
- Node.js 24 or newer
- Python 3.11 or newer
- Rust stable with the MSVC target
- Microsoft Visual Studio Build Tools with **Desktop development with C++**
- Tauri CLI 2 installed through Cargo:

```powershell
cargo install tauri-cli --version "^2.0.0" --locked
```

WebView2 is normally already present on current Windows 10/11 systems.

## Prepare the original Stunts assets

The desktop build follows the same asset rules as the browser version. Original game data is not stored in this repository.

```powershell
npm ci
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r tools\requirements.txt
python tools\prepare_assets.py --original "C:\Games\Stunts" --output public
python tools\check_assets.py
```

Use the supported Mindscape 4D Sports Driving 1.1 installation described in the main README.

## Run the Windows app in development

```powershell
npm run desktop:dev
```

Tauri starts the Vite desktop frontend automatically and opens PlayStunts DX in its own Windows application window.

## Build the Windows executable

```powershell
npm run desktop:build
```

The first milestone deliberately disables installer bundling. The executable is produced at approximately:

```text
src-tauri\target\release\playstuntsdx.exe
```

The release build embeds `dist-desktop` in the application and does not require a localhost server.

## Architecture

- `desktop/` — desktop-only React entry point and Next Image compatibility shim
- `vite.desktop.config.ts` — standalone desktop frontend build
- `src-tauri/` — native Windows/Rust application shell
- `app/`, `lib/game/`, `lib/physics/` — shared existing PlayStunts game/runtime code

The next planned stage is native Windows controller access, using the original reconstructed analog joystick path for steering before force feedback is added.
