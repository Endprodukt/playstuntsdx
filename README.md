# PlayStunts DX

**PlayStunts DX** is a native Windows desktop fork of [PlayStunts](https://github.com/ACatWithEbola/playstunts), the reconstructed **Stunts / 4D Sports Driving** runtime.

The original PlayStunts reconstruction was created by **Sven (@ACatWithEbola)**. PlayStunts DX builds on that work and adds a Windows/Tauri frontend, gamepad and steering-wheel support, native force feedback, high-resolution assets, custom cars and tracks, and a portable Windows release.

The original **Stunts / 4D Sports Driving** game was developed by **Distinctive Software**.

**No original Stunts game files or Roland MT-32 ROMs are included.** You must supply those yourself.

## Requirements

- Windows 10/11 64-bit
- Git
- Node.js 24+
- Python 3.11+
- Rust stable with the MSVC target
- Visual Studio 2022 Build Tools with **Desktop development with C++** and a Windows SDK
- Tauri CLI 2
- Microsoft Edge WebView2 Runtime

Install Tauri if needed:

```powershell
cargo install tauri-cli --version "^2.0.0" --locked
```

## Clone and build

```powershell
git clone https://github.com/Endprodukt/playstuntsdx.git
cd playstuntsdx
git switch master
npm.cmd ci
```

### Run the development version

```powershell
git pull
npm.cmd run desktop:dev
```

### Build the complete portable version

This is the recommended build:

```powershell
npm.cmd run desktop:portable
```

The finished build is created in:

```text
release\PlayStunts DX\
```

For only the compiled release executable:

```powershell
npm.cmd run desktop:build
```

Output:

```text
src-tauri\target\release\playstuntsdx.exe
```

## Game files and folders

The portable build creates the important folders automatically:

```text
PlayStunts DX.exe
config.ini
Gamedata\
Custom Cars\
Custom Tracks\
High Res\
mt32\
```

Put your compatible original **Stunts / 4D Sports Driving** files in `Gamedata` before launching the game.

- `Custom Cars` — custom car files
- `Custom Tracks` — custom tracks
- `High Res` — high-resolution replacement assets
- `mt32` — optional user-supplied MT-32 ROMs
- `config.ini` — desktop, controller and force-feedback settings

The supported original game data is based on the **Mindscape 4D Sports Driving 1.1 release from 13 December 1990**.

## Credits

**Original PlayStunts reconstruction:** Sven / [@ACatWithEbola](https://github.com/ACatWithEbola)

**PlayStunts DX:** Windows desktop, input, force-feedback, graphics and packaging extensions developed in this fork.

**Original game:** Stunts / 4D Sports Driving by Distinctive Software.

## License

Source code in this repository is licensed under **GPL-3.0-only** unless a file states otherwise. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The license does not cover the original Stunts executables, artwork, game data or Roland ROMs. Those files are not distributed with PlayStunts DX.
