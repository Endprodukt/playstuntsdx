# PlayStunts DX

**PlayStunts DX** is a native Windows desktop version and extension of the reconstructed **Stunts / 4D Sports Driving** runtime from [PlayStunts](https://github.com/ACatWithEbola/playstunts).

The DX version keeps the reconstructed game logic but adds a dedicated Windows/Tauri frontend and native desktop features such as gamepad and steering-wheel support, native Windows force feedback, desktop configuration, high-resolution asset overrides, custom car and track folders, and a portable release layout.

> The current integrated Windows desktop version is on the **`master`** branch. The repository default branch may still open on `main`, so switch to `master` before building the DX version.

**No original Stunts game files or Roland MT-32 ROMs are distributed in this repository.** You must supply your own compatible game data.

## Windows requirements

PlayStunts DX currently targets **64-bit Windows 10/11**.

Install the following before building:

- **Git**
- **Node.js 24 or newer** with npm
- **Python 3.11 or newer**, 64-bit recommended
- **Rust stable** with the `x86_64-pc-windows-msvc` target
- **Microsoft Visual Studio 2022 Build Tools** or Visual Studio 2022 with the **Desktop development with C++** workload
  - MSVC x64 build tools
  - Windows 10 or Windows 11 SDK
- **Tauri CLI 2**
- **Microsoft Edge WebView2 Runtime** (normally already installed on current Windows 10/11 systems)

Install/update Rust and Tauri from PowerShell:

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustup update
cargo install tauri-cli --version "^2.0.0" --locked
```

## Clone the DX version

```powershell
git clone https://github.com/Endprodukt/playstuntsdx.git
cd playstuntsdx
git switch master
npm.cmd ci
```

Using `npm.cmd` avoids the common PowerShell execution-policy problem with `npm.ps1`. If normal `npm` commands already work on your system, you can use them instead.

## Run the development build

```powershell
git pull
npm.cmd run desktop:dev
```

This starts the Vite desktop frontend and launches the game through Tauri in a normal Windows application window.

The desktop development build does not use the browser/Cloudflare frontend.

## Compile PlayStunts DX

### Raw release executable

For a normal optimized Tauri release build:

```powershell
npm.cmd run desktop:build
```

This command:

1. builds the embedded Windows asset-preparation helper,
2. builds the desktop Vite frontend,
3. compiles the Rust/Tauri application in release mode.

The executable is produced in:

```text
src-tauri\target\release\playstuntsdx.exe
```

The first build can take longer because Rust crates, Python packages and the custom PyInstaller helper must be built locally.

### Recommended portable build

To create the complete folder that can be copied to another Windows PC, run:

```powershell
npm.cmd run desktop:portable
```

This performs the complete release process and assembles the result here:

```text
release\PlayStunts DX\
```

The folder contains:

```text
PlayStunts DX.exe
config.ini
Cache\
Custom Cars\
Custom Tracks\
Gamedata\
High Res\
mt32\
```

Put your original supported Stunts / 4D Sports Driving files in **`Gamedata`** before starting the portable build.

Optional content can be placed in the matching folders:

- `Custom Cars` — custom car files; nested folders are supported
- `Custom Tracks` — custom tracks; nested folders are supported
- `High Res` — high-resolution replacement assets
- `mt32` — user-supplied compatible MT-32 ROMs

Desktop, controller and force-feedback settings are stored in `config.ini`.

`desktop:portable` also downloads the enhanced artwork/music files used by the DX presentation from `playstunts.com`, so an internet connection is required when those files are not already present locally.

## Original game data

PlayStunts DX does not download or redistribute the original game.

The reconstruction expects a compatible complete installation of **Mindscape's 4D Sports Driving 1.1, finalized 13 December 1990** (MS 1990). Other Stunts releases are not automatically interchangeable.

For development asset preparation you can still use the original PlayStunts tooling:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r tools\requirements.txt
python tools\prepare_assets.py --original "C:\Games\Stunts" --output public
python tools\check_assets.py
```

The portable DX release normally handles runtime asset preparation from the files placed in `Gamedata` through its embedded helper.

## Useful build commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run desktop:dev` | Run the Windows DX version from source |
| `npm.cmd run desktop:web:build` | Build only the desktop frontend |
| `npm.cmd run desktop:build` | Build the optimized Windows executable |
| `npm.cmd run desktop:portable` | Build the complete portable release folder |
| `npm.cmd run typecheck` | Run TypeScript type checking |
| `npm.cmd run lint` | Run the source linter |

## Common build problems

### `cargo tauri` is not found

Install the Tauri CLI:

```powershell
cargo install tauri-cli --version "^2.0.0" --locked
```

Then open a new terminal if Cargo's `bin` directory was only just added to `PATH`.

### `cl.exe`, linker or Windows SDK errors

Open **Visual Studio Installer** and make sure **Desktop development with C++** is installed, including the x64 MSVC tools and a current Windows SDK.

The embedded asset helper also deliberately locates the Visual Studio x64 developer environment during the portable/release build.

### PowerShell blocks `npm.ps1`

Use the Windows command shim instead:

```powershell
npm.cmd ci
npm.cmd run desktop:dev
```

### WebView2 is missing

Install the current Microsoft Edge WebView2 Runtime. Tauri uses WebView2 to render the desktop UI, but the finished DX build runs as a normal Windows application and does not require a browser window or localhost server.

## Project layout

- `desktop/` — Windows desktop React entry point and desktop UI
- `src-tauri/` — native Rust/Tauri shell, configuration and Windows FFB bridge
- `lib/game/` — reconstructed game/runtime code
- `lib/physics/` — reconstructed physics and force-feedback calculations
- `tools/` — asset preparation, build helper and portable packaging tools
- `public/` — generated/runtime assets used by the frontend
- `release/PlayStunts DX/` — assembled portable release output

The browser/Cloudflare version inherited from the original PlayStunts project remains in the repository, but the DX Windows build uses the separate Vite + Tauri desktop path.

For additional desktop notes see [docs/WINDOWS_DESKTOP.md](docs/WINDOWS_DESKTOP.md).

## Credits

PlayStunts DX is based on the PlayStunts reconstruction of **Stunts / 4D Sports Driving**. The original reconstruction and the original game remain the work of their respective authors and rights holders.

This DX fork contains additional Windows desktop, input, force-feedback, presentation and packaging work developed in this repository.

## License and original-game rights

Unless a file carries a separate third-party notice, source code contributed to this project is licensed under the **GNU General Public License, version 3 only (GPL-3.0-only)**. See [LICENSE](LICENSE).

Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and notices in `vendor/` where applicable.

The GPL license for this repository does **not** grant rights to the original Stunts executables, artwork, game data, Roland ROMs or other copyrighted original-game material. Those files are not included and must be supplied legally by the user.
